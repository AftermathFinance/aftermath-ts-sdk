import { AftermathTransportError, isAftermathTransportError } from "@sdk";
import { Caller } from "@sdk/general/utils/caller";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

class TestCaller extends Caller {
	call<Output>(
		body?: unknown,
		signal?: AbortSignal,
		options?: { disableBigIntJsonParsing?: boolean }
	): Promise<Output> {
		return this.fetchApi<Output, unknown>("test", body, signal, options);
	}
}

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function installFetch(handler: FetchHandler): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(handler(input, init));
	}) as typeof fetch;
	return calls;
}

function makeResponse(
	body: string,
	status = 200,
	headers?: HeadersInit
): Response {
	return new Response(body, { status, headers });
}

function makeCaller(baseUrl = "https://sdk.test"): TestCaller {
	return new TestCaller({ baseUrl });
}

async function expectTransportError(
	operation: Promise<unknown>
): Promise<AftermathTransportError> {
	let caught: unknown;
	try {
		await operation;
	} catch (error) {
		caught = error;
	}

	if (!isAftermathTransportError(caught)) {
		throw new Error("Expected an AftermathTransportError");
	}
	return caught as AftermathTransportError;
}

interface AbortState {
	observedAborted: boolean;
	settled: boolean;
}

function installAbortAwareFetch(state: AbortState): FetchCall[] {
	return installFetch((_input, init) => {
		const signal = init?.signal;
		if (!signal) {
			return Promise.reject(new Error("missing signal"));
		}

		return new Promise<Response>((_resolve, reject) => {
			const onAbort = () => {
				if (state.settled) {
					return;
				}
				state.observedAborted = signal.aborted;
				state.settled = true;
				signal.removeEventListener("abort", onAbort);
				reject(signal.reason);
			};

			signal.addEventListener("abort", onAbort, { once: true });
			if (signal.aborted) {
				onAbort();
			}
		});
	});
}

describe("Aftermath transport errors", () => {
	for (const status of [408, 429, 500, 502, 503, 504, 404]) {
		it(`preserves HTTP status ${status}`, async () => {
			installFetch(() => makeResponse("status", status));

			const error = await expectTransportError(makeCaller().call());
			expect(error.kind).toBe("http");
			expect(error.status).toBe(status);
			expect(error.retryAfterMs).toBeUndefined();
		});
	}

	it("preserves the legacy HTTP message while adding structured fields", async () => {
		const secret = "transport-secret-marker";
		installFetch(
			() =>
				new Response(secret, {
					status: 503,
					statusText: "Service Unavailable",
					headers: {
						"Retry-After": "2",
						"X-Secret-Header": secret,
					},
				})
		);

		const error = await expectTransportError(makeCaller().call());
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("Error");
		expect(error.message).toBe(`HTTP 503 Service Unavailable: ${secret}`);
		expect(error.kind).toBe("http");
		expect(error.status).toBe(503);
		expect(error.retryAfterMs).toBe(2000);
		expect(error.message).not.toContain("X-Secret-Header");
	});

	it("accepts delta-seconds, including zero, and HTTP-date Retry-After values", async () => {
		const fixedNow = Date.UTC(2026, 0, 1, 0, 0, 0);
		const originalNow = Date.now;
		Date.now = () => fixedNow;

		try {
			for (const [header, expected] of [
				["0", 0],
				[" 2 ", 2000],
				[
					new Date(fixedNow + 6000).toUTCString(),
					Date.parse(new Date(fixedNow + 6000).toUTCString()) - fixedNow,
				],
			] as const) {
				installFetch(() =>
					makeResponse("retry", 429, { "Retry-After": header })
				);
				const error = await expectTransportError(makeCaller().call());
				expect(error.kind).toBe("http");
				expect(error.retryAfterMs).toBe(expected);
			}
		} finally {
			Date.now = originalNow;
		}
	});

	it("omits malformed, negative, expired, non-finite, and overflowed Retry-After values", async () => {
		const fixedNow = Date.UTC(2026, 0, 1, 0, 0, 0);
		const originalNow = Date.now;
		Date.now = () => fixedNow;

		try {
			const headers = [
				"-1",
				"NaN",
				"Infinity",
				"1.5",
				"9007199254740992",
				new Date(fixedNow - 1000).toUTCString(),
				"not-a-date",
			];
			for (const header of headers) {
				installFetch(() =>
					makeResponse("retry", 429, { "Retry-After": header })
				);
				const error = await expectTransportError(makeCaller().call());
				expect(error.kind).toBe("http");
				expect(error.retryAfterMs).toBeUndefined();
			}
		} finally {
			Date.now = originalNow;
		}
	});

	for (const code of ["EAI_AGAIN", "UND_ERR_SOCKET"]) {
		it(`preserves network code and cause ${code}`, async () => {
			const cause = Object.assign(new Error("network failure"), { code });
			installFetch(() => {
				throw cause;
			});

			const error = await expectTransportError(makeCaller().call());
			expect(error.kind).toBe("network");
			expect(error.name).toBe("Error");
			expect(error.message).toBe("network failure");
			expect(error.code).toBe(code);
			expect(error.cause).toBe(cause);
			expect(error.status).toBeUndefined();
		});
	}

	it("keeps TLS/configuration failures in the network kind", async () => {
		const cause = Object.assign(new Error("tls failure"), {
			code: "ERR_TLS_CERT_ALTNAME_INVALID",
		});
		installFetch(() => {
			throw cause;
		});

		const error = await expectTransportError(makeCaller().call());
		expect(error.kind).toBe("network");
		expect(error.name).toBe("Error");
		expect(error.message).toBe("tls failure");
		expect(error.code).toBe("ERR_TLS_CERT_ALTNAME_INVALID");
		expect(error.cause).toBe(cause);
	});

	it("classifies a caller abort and proves the underlying fetch settled", async () => {
		const state: AbortState = { observedAborted: false, settled: false };
		const controller = new AbortController();
		const calls = installAbortAwareFetch(state);

		const pending = makeCaller().call(undefined, controller.signal);
		expect(calls[0].init?.signal).toBe(controller.signal);
		controller.abort();

		const error = await expectTransportError(pending);
		expect(error.kind).toBe("abort");
		expect(error.abortSource).toBe("caller");
		expect(state.observedAborted).toBe(true);
		expect(state.settled).toBe(true);
	});

	it("classifies a standard TimeoutError abort and proves the underlying fetch settled", async () => {
		const state: AbortState = { observedAborted: false, settled: false };
		const controller = new AbortController();
		const calls = installAbortAwareFetch(state);

		const pending = makeCaller().call(undefined, controller.signal);
		expect(calls[0].init?.signal).toBe(controller.signal);
		const reason = new DOMException("deadline", "TimeoutError");
		controller.abort(reason);

		const error = await expectTransportError(pending);
		expect(error.kind).toBe("timeout");
		expect(error.abortSource).toBe("timeout");
		expect(error.cause).toBe(reason);
		expect(state.observedAborted).toBe(true);
		expect(state.settled).toBe(true);
	});

	for (const code of [
		"UND_ERR_CONNECT_TIMEOUT",
		"UND_ERR_HEADERS_TIMEOUT",
		"ETIMEDOUT",
	]) {
		it(`classifies transport timeout code ${code}`, async () => {
			const cause = Object.assign(new Error("timeout"), { code });
			installFetch(() => {
				throw cause;
			});

			const error = await expectTransportError(makeCaller().call());
			expect(error.kind).toBe("timeout");
			expect(error.abortSource).toBe("timeout");
			expect(error.code).toBe(code);
			expect(error.cause).toBe(cause);
		});
	}

	it("normalizes invalid JSON as decode without HTTP fields", async () => {
		installFetch(() => makeResponse("{ invalid", 200));

		const error = await expectTransportError(makeCaller().call());
		expect(error.kind).toBe("decode");
		expect(error.cause).toBeInstanceOf(SyntaxError);
		expect(error.message).toBe((error.cause as SyntaxError).message);
		expect(error.name).toBe((error.cause as SyntaxError).name);
		expect(error.status).toBeUndefined();
		expect(error.retryAfterMs).toBeUndefined();
	});

	it("normalizes a BigInt parser failure as decode", async () => {
		const originalBigInt = globalThis.BigInt;
		globalThis.BigInt = ((value: string | number | bigint) => {
			if (String(value) === "999") {
				throw new RangeError("BigInt fixture failure");
			}
			return originalBigInt(value);
		}) as typeof BigInt;

		try {
			installFetch(() => makeResponse('{"amount":"999n"}'));
			const error = await expectTransportError(makeCaller().call());
			expect(error.kind).toBe("decode");
			expect(error.cause).toBeInstanceOf(RangeError);
			expect(error.message).toBe((error.cause as RangeError).message);
			expect(error.name).toBe((error.cause as RangeError).name);
			expect(error.status).toBeUndefined();
			expect(error.retryAfterMs).toBeUndefined();
		} finally {
			globalThis.BigInt = originalBigInt;
		}
	});

	it("preserves successful BigInt casting with and without a signal", async () => {
		const expected = { amount: 123n, nullable: undefined };

		for (const signal of [undefined, new AbortController().signal]) {
			installFetch(() => makeResponse('{"amount":"123n","nullable":null}'));
			const result = await makeCaller().call<{
				amount: bigint;
				nullable: undefined;
			}>(undefined, signal);
			expect(result).toEqual(expected);
		}
	});

	it("passes already-normalized errors through unchanged", async () => {
		const normalized = new AftermathTransportError("http", { status: 418 });
		installFetch(() => {
			throw normalized;
		});

		const error = await expectTransportError(makeCaller().call());
		expect(error).toBe(normalized);
	});

	it("normalizes a missing API base as a network configuration failure", async () => {
		const error = await expectTransportError(new TestCaller().call());
		expect(error.kind).toBe("network");
		expect(error.name).toBe("Error");
		expect(error.message).toBe("no apiBaseUrl: unable to fetch data");
		expect(error.status).toBeUndefined();
		expect(error.retryAfterMs).toBeUndefined();
		expect(error.cause).toBeInstanceOf(Error);
	});
});

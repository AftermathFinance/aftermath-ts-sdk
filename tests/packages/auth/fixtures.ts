import { afterEach, describe, expect, it, jest } from "@jest/globals";

const { Auth } = await import("@sdk");

type JsonRecord = Record<string, unknown>;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const API_BASE_URL = "https://sdk.test/";

const WALLET = "0x1";

const OTHER_WALLET = "0x2";

const FULL_ONE = `0x${"1".padStart(64, "0")}`;

const FULL_TWO = `0x${"2".padStart(64, "0")}`;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
	jest.useRealTimers();
});

function wireJson(value: unknown): string {
	return JSON.stringify(value, (_key, currentValue) =>
		typeof currentValue === "bigint" ? `${currentValue}n` : currentValue
	);
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	headers: Record<string, string> = {}
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(wireJson(payload), {
				status,
				headers: { "Content-Type": "application/json", ...headers },
			})
		);
	}) as typeof fetch;
	return calls;
}

function installRejectingFetch(
	error = new Error("offline sentinel")
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(error);
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): JsonRecord {
	if (typeof call.init?.body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(call.init.body) as JsonRecord;
}

function requestUrl(call: FetchCall): string {
	return String(call.input);
}

export {
	API_BASE_URL,
	Auth,
	describe,
	expect,
	FULL_ONE,
	FULL_TWO,
	installJsonFetch,
	installRejectingFetch,
	it,
	jest,
	OTHER_WALLET,
	requestBody,
	requestUrl,
	WALLET,
};

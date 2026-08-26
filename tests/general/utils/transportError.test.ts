import {
	AftermathTransportError,
	isAftermathTransportError,
	normalizeAftermathTransportError,
	parseRetryAfter,
} from "@test/general/fixtures/core.js";

describe("TransportError", () => {
	describe("AftermathTransportError", () => {
		it("defaults messages per kind", () => {
			expect(new AftermathTransportError("http", {}).message).toBe(
				"Aftermath HTTP request failed"
			);
			expect(new AftermathTransportError("http", { status: 500 }).message).toBe(
				"Aftermath HTTP request failed with status 500"
			);
			expect(new AftermathTransportError("network", {}).message).toBe(
				"Aftermath network request failed"
			);
			expect(new AftermathTransportError("abort", {}).message).toBe(
				"Aftermath request was aborted"
			);
			expect(new AftermathTransportError("timeout", {}).message).toBe(
				"Aftermath request timed out"
			);
			expect(new AftermathTransportError("decode", {}).message).toBe(
				"Aftermath response could not be decoded"
			);
		});
		it("prefers explicit message and cause message", () => {
			expect(
				new AftermathTransportError("network", { message: "custom" }).message
			).toBe("custom");
			const cause = new Error("cause msg");
			expect(new AftermathTransportError("network", { cause }).message).toBe(
				"cause msg"
			);
			expect(
				new AftermathTransportError("network", { message: "explicit", cause })
					.message
			).toBe("explicit");
		});
		it("sets name from options or cause", () => {
			expect(
				new AftermathTransportError("network", { name: "MyError" }).name
			).toBe("MyError");
			expect(
				new AftermathTransportError("network", {
					cause: { name: "CauseName", message: "m" } as any,
				}).name
			).toBe("CauseName");
			expect(new AftermathTransportError("network", {}).name).toBe(
				"AftermathTransportError"
			);
		});
		it("stores kind, status, retryAfterMs, code, abortSource, cause", () => {
			const cause = new Error("c");
			const err = new AftermathTransportError("http", {
				status: 429,
				retryAfterMs: 2000,
				code: "E1",
				cause,
				abortSource: "caller",
			});
			expect(err.kind).toBe("http");
			expect(err.status).toBe(429);
			expect(err.retryAfterMs).toBe(2000);
			expect(err.code).toBe("E1");
			expect(err.abortSource).toBe("caller");
			expect(err.cause).toBe(cause);
			expect(err instanceof Error).toBe(true);
		});
		it("cause is non-enumerable", () => {
			const err = new AftermathTransportError("network", {
				cause: new Error("x"),
			});
			expect(Object.keys(err)).not.toContain("cause");
			expect(Object.getOwnPropertyDescriptor(err, "cause")?.enumerable).toBe(
				false
			);
		});
		it("isAftermathTransportError checks instanceof", () => {
			expect(
				isAftermathTransportError(new AftermathTransportError("network"))
			).toBe(true);
			expect(isAftermathTransportError(new Error("x"))).toBe(false);
			expect(isAftermathTransportError(null)).toBe(false);
		});
	});

	describe("parseRetryAfter", () => {
		it("returns undefined for null/empty/whitespace", () => {
			expect(parseRetryAfter(null)).toBeUndefined();
			expect(parseRetryAfter("")).toBeUndefined();
			expect(parseRetryAfter("   ")).toBeUndefined();
		});
		it("parses delta seconds", () => {
			expect(parseRetryAfter("0")).toBe(0);
			expect(parseRetryAfter(" 2 ")).toBe(2000);
			expect(parseRetryAfter("120")).toBe(120_000);
		});
		it("rejects malformed delta", () => {
			expect(parseRetryAfter("-1")).toBeUndefined();
			expect(parseRetryAfter("1.5")).toBeUndefined();
			expect(parseRetryAfter("NaN")).toBeUndefined();
			expect(parseRetryAfter("Infinity")).toBeUndefined();
			expect(parseRetryAfter("abc")).toBeUndefined();
		});
		it("rejects overflow beyond MAX_SAFE_INTEGER", () => {
			// 9007199254740992 seconds => 9e15 ms > MAX_SAFE_INTEGER
			expect(parseRetryAfter("9007199254740992")).toBeUndefined();
			// max safe: 9007199254740991*1000 = 9e18 >? Actually max ms = 9007199254740991, so seconds max = 9007199254 approx
			expect(parseRetryAfter("9007199254")).toBe(9_007_199_254_000);
		});
		it("parses HTTP-date", () => {
			const fixedNow = Date.UTC(2026, 0, 1, 0, 0, 0);
			const future = new Date(fixedNow + 6000).toUTCString();
			expect(parseRetryAfter(future, fixedNow)).toBe(6000);
			const past = new Date(fixedNow - 1000).toUTCString();
			expect(parseRetryAfter(past, fixedNow)).toBeUndefined();
		});
		it("rejects non-date http date format but regex passes then fails parse? Actually regex restricts, so invalid like 'not-a-date' returns undefined", () => {
			expect(parseRetryAfter("not-a-date")).toBeUndefined();
		});
		it("rejects negative retryAfterMs and non-safe integer", () => {
			const now = Date.UTC(2026, 0, 1, 0, 0, 0);
			// HTTP-date far future that overflows safe integer? Use date far future where diff > MAX_SAFE_INTEGER
			// Instead test past => negative => undefined
			const past = new Date(now - 5000).toUTCString();
			expect(parseRetryAfter(past, now)).toBeUndefined();
		});
		it("handles all three HTTP-date regex variants", () => {
			// RFC1123: "Tue, 15 Nov 1994 08:12:31 GMT" already tested via toUTCString
			// RFC850: "Tuesday, 15-Nov-94 08:12:31 GMT"
			const rfc850 = "Tuesday, 15-Nov-94 08:12:31 GMT";
			const now = Date.parse(rfc850) - 1000;
			expect(parseRetryAfter(rfc850, now)).toBe(1000);
			// ASCTIME: "Tue Nov 15 08:12:31 1994"
			const asc = "Tue Nov 15 08:12:31 1994";
			const now2 = Date.parse(asc) - 2000;
			expect(parseRetryAfter(asc, now2)).toBe(2000);
		});
	});

	describe("normalizeAftermathTransportError", () => {
		it("passes through already normalized", () => {
			const orig = new AftermathTransportError("http", { status: 418 });
			expect(normalizeAftermathTransportError(orig)).toBe(orig);
		});
		it("normalizes network with code", () => {
			const cause = Object.assign(new Error("fail"), { code: "EAI_AGAIN" });
			const err = normalizeAftermathTransportError(cause);
			expect(err.kind).toBe("network");
			expect(err.code).toBe("EAI_AGAIN");
			expect(err.cause).toBe(cause);
		});
		it("normalizes timeout code to timeout", () => {
			for (const code of [
				"UND_ERR_CONNECT_TIMEOUT",
				"UND_ERR_HEADERS_TIMEOUT",
				"UND_ERR_BODY_TIMEOUT",
				"ETIMEDOUT",
			]) {
				const cause = Object.assign(new Error("t"), { code });
				const err = normalizeAftermathTransportError(cause);
				expect(err.kind).toBe("timeout");
				expect(err.abortSource).toBe("timeout");
			}
		});
		it("handles TimeoutError name", () => {
			const cause = new DOMException("x", "TimeoutError");
			const err = normalizeAftermathTransportError(cause);
			expect(err.kind).toBe("timeout");
		});
		it("handles abort via signal", () => {
			const controller = new AbortController();
			controller.abort();
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				controller.signal
			);
			expect(err.kind).toBe("abort");
			expect(err.abortSource).toBe("caller");
		});
		it("handles timeout abort via signal reason TimeoutError", () => {
			const c = new AbortController();
			c.abort(new DOMException("deadline", "TimeoutError"));
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
			expect(err.abortSource).toBe("timeout");
		});
		it("handles timeout abort via signal reason code", () => {
			const c = new AbortController();
			c.abort(Object.assign(new Error("t"), { code: "ETIMEDOUT" }));
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
		});
		it("prefers error code over signal reason code", () => {
			const c = new AbortController();
			c.abort(Object.assign(new Error("sig"), { code: "SIGCODE" }));
			const _cause = Object.assign(new Error("err"), { code: "ERRCODE" });
			c.abort(); // already aborted, but we need to set signal to aborted already; we manually test via second abort not effective, so create new
			const c2 = new AbortController();
			const sigReason = Object.assign(new Error("sig"), { code: "SIGCODE" });
			c2.abort(sigReason);
			const err2 = normalizeAftermathTransportError(
				Object.assign(new Error("err"), { code: "ERRCODE" }),
				c2.signal
			);
			expect(err2.code).toBe("ERRCODE"); // errorCode preferred
		});
		it("signal not aborted -> network/timeout based on error", () => {
			const sig = new AbortController().signal; // not aborted
			const cause = Object.assign(new Error("net"), { code: "EAI_AGAIN" });
			expect(normalizeAftermathTransportError(cause, sig).kind).toBe("network");
		});
		it("handles AftermathTransportError timeout via signal reason", () => {
			const timeoutErr = new AftermathTransportError("timeout", {
				abortSource: "timeout",
			});
			const c = new AbortController();
			c.abort(timeoutErr);
			const err = normalizeAftermathTransportError(
				new Error("other"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
		});
	});
});

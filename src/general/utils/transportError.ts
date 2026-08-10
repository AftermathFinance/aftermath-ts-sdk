export type AftermathTransportErrorKind =
	| "http"
	| "network"
	| "abort"
	| "timeout"
	| "decode";

export type AftermathAbortSource = "caller" | "timeout";

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const DELTA_SECONDS_REGEX = /^\d+$/;
const HTTP_DATE_REGEX =
	/^(?:[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]+, \d{2}-[A-Za-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT|[A-Za-z]{3} [A-Za-z]{3} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/;

const TIMEOUT_CODES = new Set([
	"UND_ERR_BODY_TIMEOUT",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_HEADERS_TIMEOUT",
	"ETIMEDOUT",
]);

function defaultMessage(
	kind: AftermathTransportErrorKind,
	status?: number
): string {
	if (kind === "http") {
		return status === undefined
			? "Aftermath HTTP request failed"
			: `Aftermath HTTP request failed with status ${status}`;
	}

	if (kind === "network") {
		return "Aftermath network request failed";
	}

	if (kind === "abort") {
		return "Aftermath request was aborted";
	}

	if (kind === "timeout") {
		return "Aftermath request timed out";
	}

	return "Aftermath response could not be decoded";
}

export class AftermathTransportError extends Error {
	readonly kind: AftermathTransportErrorKind;
	readonly status?: number;
	readonly retryAfterMs?: number;
	readonly code?: string;
	readonly cause?: unknown;
	readonly abortSource?: AftermathAbortSource;

	constructor(
		kind: AftermathTransportErrorKind,
		options: {
			message?: string;
			status?: number;
			retryAfterMs?: number;
			code?: string;
			cause?: unknown;
			abortSource?: AftermathAbortSource;
		} = {}
	) {
		super(options.message ?? defaultMessage(kind, options.status));
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = "AftermathTransportError";
		this.kind = kind;

		if (options.status !== undefined) {
			this.status = options.status;
		}
		if (options.retryAfterMs !== undefined) {
			this.retryAfterMs = options.retryAfterMs;
		}
		if (options.code !== undefined) {
			this.code = options.code;
		}
		if (options.abortSource !== undefined) {
			this.abortSource = options.abortSource;
		}
		if (options.cause !== undefined) {
			Object.defineProperty(this, "cause", {
				configurable: true,
				enumerable: false,
				value: options.cause,
				writable: false,
			});
		}
	}
}

export function isAftermathTransportError(
	error: unknown
): error is AftermathTransportError {
	return error instanceof AftermathTransportError;
}

function getProperty(value: unknown, property: "code" | "name"): unknown {
	if (
		value === null ||
		(typeof value !== "object" && typeof value !== "function")
	) {
		return undefined;
	}

	try {
		return (value as Record<string, unknown>)[property];
	} catch {
		return undefined;
	}
}

function getStringCode(value: unknown): string | undefined {
	const code = getProperty(value, "code");
	return typeof code === "string" ? code : undefined;
}

function isTimeoutCode(code: string | undefined): boolean {
	return code !== undefined && TIMEOUT_CODES.has(code);
}

function isTimeoutReason(reason: unknown): boolean {
	if (
		isAftermathTransportError(reason) &&
		(reason.kind === "timeout" || reason.abortSource === "timeout")
	) {
		return true;
	}

	return (
		getProperty(reason, "name") === "TimeoutError" ||
		isTimeoutCode(getStringCode(reason))
	);
}

export function parseRetryAfter(
	headerValue: string | null,
	nowMs = Date.now()
): number | undefined {
	if (headerValue === null) {
		return undefined;
	}

	const value = headerValue.trim();
	if (value === "") {
		return undefined;
	}

	if (DELTA_SECONDS_REGEX.test(value)) {
		const milliseconds = BigInt(value) * 1000n;
		return milliseconds <= MAX_SAFE_INTEGER_BIGINT
			? Number(milliseconds)
			: undefined;
	}

	if (!HTTP_DATE_REGEX.test(value)) {
		return undefined;
	}

	const dateMs = Date.parse(value);
	if (!Number.isFinite(dateMs)) {
		return undefined;
	}

	const retryAfterMs = dateMs - nowMs;
	return retryAfterMs >= 0 && Number.isSafeInteger(retryAfterMs)
		? retryAfterMs
		: undefined;
}

export function normalizeAftermathTransportError(
	error: unknown,
	signal?: AbortSignal
): AftermathTransportError {
	if (isAftermathTransportError(error)) {
		return error;
	}

	const errorCode = getStringCode(error);
	const signalReason = signal?.aborted ? signal.reason : undefined;
	const signalReasonCode = getStringCode(signalReason);
	const code = errorCode ?? signalReasonCode;

	if (signal?.aborted) {
		const timeout = isTimeoutReason(signalReason) || isTimeoutReason(error);
		return new AftermathTransportError(timeout ? "timeout" : "abort", {
			abortSource: timeout ? "timeout" : "caller",
			cause: error,
			code,
		});
	}

	if (isTimeoutReason(error)) {
		return new AftermathTransportError("timeout", {
			abortSource: "timeout",
			cause: error,
			code: errorCode,
		});
	}

	return new AftermathTransportError("network", {
		cause: error,
		code: errorCode,
	});
}

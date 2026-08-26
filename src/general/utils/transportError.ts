/**
 * The transport failure categories used by `AftermathTransportError`.
 *
 * `http` is a non-2xx response. `network` is a fetch or configuration failure.
 * `abort` is a caller cancellation. `timeout` is a transport or deadline
 * timeout. `decode` is a response JSON or bigint-decoding failure.
 */
export type AftermathTransportErrorKind =
	| "http"
	| "network"
	| "abort"
	| "timeout"
	| "decode";

/** Identifies whether an abort-like failure came from the caller or a timeout. */
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
/**
 * An Error with structured information about an Aftermath transport failure.
 *
 * The constructor preserves an explicit message first, then a string
 * `cause.message`, and finally a kind-specific default. The original cause is
 * stored as a non-enumerable `cause` property when supplied. Defaults are
 * `Aftermath HTTP request failed` (or that text with `with status N`) for
 * `http`, `Aftermath network request failed` for `network`,
 * `Aftermath request was aborted` for `abort`, `Aftermath request timed out`
 * for `timeout`, and `Aftermath response could not be decoded` for `decode`.
 */
export class AftermathTransportError extends Error {
	/** The normalized transport category. */
	readonly kind: AftermathTransportErrorKind;
	/** The HTTP status for an `http` error, when available. */
	readonly status?: number;
	/** The supplied retry delay in milliseconds, when present. */
	readonly retryAfterMs?: number;
	/** The transport or runtime error code, when the source supplied one. */
	readonly code?: string;
	/** The original thrown value, stored as a non-enumerable property. */
	readonly cause?: unknown;
	/** The source of an abort or timeout classification. */
	readonly abortSource?: AftermathAbortSource;

	/**
	 * Creates a structured transport error.
	 *
	 * `name` defaults to the cause's string `name`, or
	 * `AftermathTransportError`. `message` defaults to the cause's string
	 * `message`, or a message derived from `kind` and `status`. Optional fields
	 * are assigned only when provided.
	 *
	 * @param kind - The transport category.
	 * @param options - The message, status, retry metadata, source error, and
	 * abort classification.
	 */
	constructor(
		kind: AftermathTransportErrorKind,
		options: {
			/** Overrides the derived error message. */
			message?: string;
			/** Overrides the derived error name. */
			name?: string;
			/** The HTTP response status. */
			status?: number;
			/** The retry delay in milliseconds. */
			retryAfterMs?: number;
			/** The source error code. */
			code?: string;
			/** The original thrown value. */
			cause?: unknown;
			/** Whether an abort-like error came from the caller or a timeout. */
			abortSource?: AftermathAbortSource;
		} = {}
	) {
		const causeMessage = getStringProperty(options.cause, "message");
		super(
			options.message ??
				causeMessage ??
				defaultMessage(kind, options.status)
		);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name =
			options.name ??
			getStringProperty(options.cause, "name") ??
			"AftermathTransportError";
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

/**
 * Checks whether a value is an `AftermathTransportError` instance.
 *
 * The guard uses `instanceof` and returns `false` for other error-like values.
 *
 * @param error - The value to test.
 * @returns `true` when `error` is an `AftermathTransportError`.
 */
export function isAftermathTransportError(
	error: unknown
): error is AftermathTransportError {
	return error instanceof AftermathTransportError;
}

function getProperty(
	value: unknown,
	property: "code" | "message" | "name"
): unknown {
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

function getStringProperty(
	value: unknown,
	property: "code" | "message" | "name"
): string | undefined {
	const propertyValue = getProperty(value, property);
	return typeof propertyValue === "string" ? propertyValue : undefined;
}

function getStringCode(value: unknown): string | undefined {
	return getStringProperty(value, "code");
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

/**
 * Parses an HTTP `Retry-After` header into a delay.
 *
 * Unsigned integer values are delta-seconds and are multiplied by `1000`.
 * RFC 1123, RFC 850, and ANSI C `asctime` dates are converted to the number of
 * milliseconds until the date. Empty, malformed, expired, negative, and
 * unsafe-integer results return `undefined`. The default reference time is
 * `Date.now()`.
 *
 * @param headerValue - The raw `Retry-After` header, or `null` when absent.
 * @param nowMs - The reference epoch time in milliseconds for HTTP-date values.
 * @returns A non-negative safe integer delay in milliseconds, or `undefined`
 * when the header cannot produce one.
 */
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

/**
 * Converts an unknown thrown value into an `AftermathTransportError`.
 *
 * Existing `AftermathTransportError` instances are returned unchanged. An
 * aborted signal produces `abort` unless the signal reason or original error
 * identifies a timeout. Without an aborted signal, timeout names and known
 * timeout codes produce `timeout`; all other values produce `network`.
 * Error codes prefer the original error's code over the signal reason's code.
 *
 * @param error - The value thrown by fetch or response handling.
 * @param signal - The optional signal used for the operation.
 * @returns The original normalized error or a new structured transport error.
 */
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

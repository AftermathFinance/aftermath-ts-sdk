export interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

export type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

export type JsonRecord = Record<string, unknown>;

/** Install an explicit fetch recorder and return the calls made through it. */
export function installRecordedFetch(handler: FetchHandler): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(handler(input, init));
	}) as typeof fetch;
	return calls;
}

export function requestBody(
	calls: readonly FetchCall[],
	index = 0
): JsonRecord {
	const body = calls[index]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(body) as JsonRecord;
}

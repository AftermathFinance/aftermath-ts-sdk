import { AftermathApi, Sui } from "@sdk";

import { type FetchCall, installRecordedFetch } from "@test/support/http";

type JsonRecord = Record<string, unknown>;

const originalFetch = globalThis.fetch;

const PADDED_TWO =
	"0x0000000000000000000000000000000000000000000000000000000000000002";

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function installJsonFetch(
	payload: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
): FetchCall[] {
	return installRecordedFetch(
		() =>
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
	);
}

export { AftermathApi, installJsonFetch, PADDED_TWO, Sui };

export type { JsonRecord };

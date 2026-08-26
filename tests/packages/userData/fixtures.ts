import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { UserData } from "@sdk/packages/userData/userData";

import {
	type FetchCall,
	installRecordedFetch,
	requestBody,
} from "@test/support/http";

type FetchResponder = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

const BASE_URL = "https://sdk.test";

const WALLET = `0x${"1".repeat(64)}`;

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetch(responder: FetchResponder): FetchCall[] {
	return installRecordedFetch(responder);
}

function installJsonFetch(
	payload: unknown,
	status = 200,
	extraHeaders: Record<string, string> = {}
): FetchCall[] {
	return installFetch(
		() =>
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json", ...extraHeaders },
			})
	);
}

export {
	BASE_URL,
	describe,
	expect,
	installJsonFetch,
	it,
	requestBody,
	UserData,
	WALLET,
};

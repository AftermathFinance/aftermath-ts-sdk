import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { Transaction } from "@mysten/sui/transactions";

const { OneClickTrading } = await import("@sdk");

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const API_BASE_URL = "https://sdk.test";
const ROUTE = `${API_BASE_URL}/api/v1/perpetuals/one-click-trading`;
const WALLET = "0x1";
const EPHEMERAL = "0x2";
const OLD_EPHEMERAL = "0x3";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installJsonFetch(...payloads: unknown[]): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		const payload = payloads[Math.min(calls.length, payloads.length) - 1];
		const status =
			typeof payload === "object" && payload !== null && "status" in payload
				? Number((payload as { status: number }).status)
				: 200;
		return Promise.resolve(
			new Response(JSON.stringify(payload), {
				status,
				headers: { "Content-Type": "application/json" },
			})
		);
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): unknown {
	if (typeof call.init?.body !== "string") {
		throw new Error("expected a JSON request body");
	}
	return JSON.parse(call.init.body);
}

describe("OneClickTrading", () => {
	it("lists delegated wallets with account ids as bigints", async () => {
		const calls = installJsonFetch({
			wallets: [
				{
					address: EPHEMERAL,
					grants: { accountIds: ["1731", "42n"], vaultIds: ["0xv"] },
				},
			],
		});
		const oneClickTrading = new OneClickTrading({ baseUrl: API_BASE_URL });

		expect(await oneClickTrading.getWallets({ walletAddress: WALLET })).toEqual(
			{
				wallets: [
					{
						address: EPHEMERAL,
						grants: { accountIds: [1731n, 42n], vaultIds: ["0xv"] },
					},
				],
			}
		);
		expect(String(calls[0].input)).toBe(`${ROUTE}/wallets`);
		expect(requestBody(calls[0])).toEqual({ walletAddress: WALLET });
	});

	it("previews a grant with a null blocker as undefined and typed revokes", async () => {
		const calls = installJsonFetch({
			granted: [
				{
					domain: "account",
					entityId: "1731",
					assistantCount: 1,
					maxAssistants: 10,
				},
			],
			gasPool: {
				created: false,
				authorize: true,
				whitelistedAddressCount: 2,
				maxWhitelistedAddresses: 32,
			},
			revoked: [
				{
					address: OLD_EPHEMERAL,
					grants: { accountIds: ["1731"], vaultIds: [] },
					deauthorize: true,
				},
			],
			blocker: null,
		});
		const oneClickTrading = new OneClickTrading({ baseUrl: API_BASE_URL });

		expect(
			await oneClickTrading.getGrantPreview({
				walletAddress: WALLET,
				ephemeralAddress: EPHEMERAL,
				revoke: [OLD_EPHEMERAL],
			})
		).toEqual({
			granted: [
				{
					domain: "account",
					entityId: "1731",
					assistantCount: 1,
					maxAssistants: 10,
				},
			],
			gasPool: {
				created: false,
				authorize: true,
				whitelistedAddressCount: 2,
				maxWhitelistedAddresses: 32,
			},
			revoked: [
				{
					address: OLD_EPHEMERAL,
					grants: { accountIds: [1731n], vaultIds: [] },
					deauthorize: true,
				},
			],
			blocker: undefined,
		});
		expect(String(calls[0].input)).toBe(`${ROUTE}/previews/grant`);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			ephemeralAddress: EPHEMERAL,
			revoke: [OLD_EPHEMERAL],
		});
	});

	it("passes a grant blocker through", async () => {
		installJsonFetch({
			granted: [],
			gasPool: {
				created: false,
				authorize: false,
				whitelistedAddressCount: 2,
				maxWhitelistedAddresses: 32,
			},
			revoked: [],
			blocker: "oct_already_enabled",
		});
		const preview = await new OneClickTrading({
			baseUrl: API_BASE_URL,
		}).getGrantPreview({ walletAddress: WALLET, ephemeralAddress: EPHEMERAL });

		expect(preview.blocker).toBe("oct_already_enabled");
	});

	it("previews a revoke in request order", async () => {
		const calls = installJsonFetch({
			wallets: [
				{
					address: OLD_EPHEMERAL,
					grants: { accountIds: [], vaultIds: ["0xv"] },
					deauthorize: false,
				},
			],
		});
		const oneClickTrading = new OneClickTrading({ baseUrl: API_BASE_URL });

		expect(
			await oneClickTrading.getRevokePreview({
				walletAddress: WALLET,
				addresses: [OLD_EPHEMERAL],
			})
		).toEqual({
			wallets: [
				{
					address: OLD_EPHEMERAL,
					grants: { accountIds: [], vaultIds: ["0xv"] },
					deauthorize: false,
				},
			],
		});
		expect(String(calls[0].input)).toBe(`${ROUTE}/previews/revoke`);
	});

	it("parses an unsponsored grant as a kind and a sponsored grant as a whole transaction", async () => {
		const kind = { kind: true } as unknown as Transaction;
		const whole = { whole: true } as unknown as Transaction;
		const fromKindSpy = jest
			.spyOn(Transaction, "fromKind")
			.mockReturnValue(kind);
		const fromSpy = jest.spyOn(Transaction, "from").mockReturnValue(whole);
		const calls = installJsonFetch(
			{ txKind: "grant-kind" },
			{ txKind: "signed", sponsorSignature: "sponsor-sig", digest: "d1" }
		);
		const oneClickTrading = new OneClickTrading({ baseUrl: API_BASE_URL });

		await expect(
			oneClickTrading.getGrantTx({
				walletAddress: WALLET,
				ephemeralAddress: EPHEMERAL,
				revoke: [OLD_EPHEMERAL],
			})
		).resolves.toEqual({ tx: kind });
		await expect(
			oneClickTrading.getGrantTx({
				walletAddress: WALLET,
				ephemeralAddress: EPHEMERAL,
				swap: { coinType: "0x3::coin::USDC", amount: 500_000n },
				bytes: "terms-bytes",
				signature: "terms-sig",
			})
		).resolves.toEqual({
			tx: whole,
			sponsorSignature: "sponsor-sig",
			digest: "d1",
		});

		expect(fromKindSpy).toHaveBeenCalledWith("grant-kind");
		expect(fromSpy).toHaveBeenCalledWith("signed");
		expect(String(calls[1].input)).toBe(`${ROUTE}/transactions/grant`);
		expect(requestBody(calls[1])).toEqual({
			walletAddress: WALLET,
			ephemeralAddress: EPHEMERAL,
			swap: { coinType: "0x3::coin::USDC", amount: "500000n" },
			bytes: "terms-bytes",
			signature: "terms-sig",
		});
	});

	it("builds a revoke for the named wallets", async () => {
		const kind = { kind: true } as unknown as Transaction;
		jest.spyOn(Transaction, "fromKind").mockReturnValue(kind);
		const calls = installJsonFetch({ txKind: "revoke-kind" });

		await expect(
			new OneClickTrading({ baseUrl: API_BASE_URL }).getRevokeTx({
				walletAddress: WALLET,
				addresses: [EPHEMERAL, OLD_EPHEMERAL],
			})
		).resolves.toEqual({ tx: kind });
		expect(String(calls[0].input)).toBe(`${ROUTE}/transactions/revoke`);
		expect(requestBody(calls[0])).toEqual({
			walletAddress: WALLET,
			addresses: [EPHEMERAL, OLD_EPHEMERAL],
		});
	});

	it("classifies HTTP errors as transport errors", async () => {
		installJsonFetch({ status: 400, message: "bad wallet" });

		await expect(
			new OneClickTrading({ baseUrl: API_BASE_URL }).getWallets({
				walletAddress: WALLET,
			})
		).rejects.toEqual(expect.objectContaining({ kind: "http", status: 400 }));
	});
});

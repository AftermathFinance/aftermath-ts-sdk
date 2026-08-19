import { jest } from "@jest/globals";

jest.mock("@mysten/sui/transactions", () => ({
	Transaction: class {
		static fromKind(txKind: string) {
			return { txKind };
		}
	},
}));
jest.mock("../src/general/utils/helpers", () => ({
	Helpers: {
		parseJsonWithBigint: (text: string) => JSON.parse(text),
	},
}));
jest.mock("../src/packages/perpetuals/perpetualsAccount", () => ({
	PerpetualsAccount: class {},
}));
jest.mock("../src/packages/perpetuals/perpetualsMarket", () => ({
	PerpetualsMarket: class {},
}));
jest.mock("../src/packages/perpetuals/utils", () => ({
	PerpetualsOrderUtils: {},
}));

import { Perpetuals } from "../src/packages/perpetuals/perpetuals";
import type { PerpetualsVaultObject } from "../src/packages/perpetuals/perpetualsTypes";
import { PerpetualsVault } from "../src/packages/perpetuals/perpetualsVault";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("Perpetuals vault assistant transactions", () => {
	it("uses the vault owner grant and revoke endpoints from the top-level client", async () => {
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(Response.json({ txKind: "built" }));
		}) as typeof fetch;
		const perps = new Perpetuals({ baseUrl: "https://sdk.test" });

		await perps.getGrantVaultAgentWalletTx({
			vaultId: "0xabc",
			recipientAddress: "0xdef",
			sponsor: { walletAddress: "0x123" },
		});
		await perps.getRevokeVaultAgentWalletTx({
			vaultId: "0xabc",
			accountCapId: "0x456",
		});

		expect(calls.map((call) => call.input)).toEqual([
			"https://sdk.test/api/perpetuals/vault/transactions/owner/grant-agent-wallet",
			"https://sdk.test/api/perpetuals/vault/transactions/owner/revoke-agent-wallet",
		]);
		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			vaultId: "0xabc",
			recipientAddress: "0xdef",
			sponsor: { walletAddress: "0x123" },
		});
		expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
			vaultId: "0xabc",
			accountCapId: "0x456",
		});
	});

	it("derives vaultId in the single-vault wrapper", async () => {
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(Response.json({ txKind: "built" }));
		}) as typeof fetch;
		const vault = new PerpetualsVault(
			{ objectId: "0xabc" } as PerpetualsVaultObject,
			{ baseUrl: "https://sdk.test" }
		);

		await vault.getGrantAgentWalletTx({ recipientAddress: "0xdef" });
		await vault.getRevokeAgentWalletTx({ accountCapId: "0x456" });

		expect(calls.map((call) => JSON.parse(String(call.init?.body)))).toEqual([
			{ vaultId: "0xabc", recipientAddress: "0xdef" },
			{ vaultId: "0xabc", accountCapId: "0x456" },
		]);
	});
});

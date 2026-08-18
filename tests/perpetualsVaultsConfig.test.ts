import { jest } from "@jest/globals";

jest.mock("@mysten/sui/transactions", () => ({
	Transaction: class {},
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
jest.mock("../src/packages/perpetuals/perpetualsVault", () => ({
	PerpetualsVault: class {},
}));
jest.mock("../src/packages/perpetuals/utils", () => ({
	PerpetualsOrderUtils: {},
}));

import { Perpetuals } from "../src/packages/perpetuals/perpetuals";
import type { PerpetualsVaultsConfig } from "../src/packages/perpetuals/perpetualsTypes";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const vaultsConfigFixture: PerpetualsVaultsConfig = {
	id: "0xabc",
	version: 2,
	collateralPriceFeedStorageToleranceMs: 30_000,
	maxLockPeriodMs: 5_184_000_000,
	maxForceWithdrawDelayMs: 86_400_000,
	maxPerformanceFeePercentage: 0.2,
	minOwnerLockUsd: 1,
	maxOwnerLockUsd: 1_000_000,
	minDepositUsd: 1,
	maxMarketsInVault: 12,
	maxPendingOrdersPerPosition: 70,
	forceWithdrawPauseMs: 300_000,
	maxAssistantsPerVault: 10,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("Perpetuals vaults config", () => {
	it("fetches and returns the current protocol config", async () => {
		const calls: FetchCall[] = [];
		globalThis.fetch = ((input, init) => {
			calls.push({ input, init });
			return Promise.resolve(Response.json(vaultsConfigFixture));
		}) as typeof fetch;
		const signal = new AbortController().signal;

		const config = await new Perpetuals({
			baseUrl: "https://sdk.test",
		}).getVaultsConfig(signal);

		expect(config).toEqual(vaultsConfigFixture);
		expect(calls).toHaveLength(1);
		expect(calls[0]?.input).toBe(
			"https://sdk.test/api/perpetuals/vaults/config"
		);
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.body).toBeUndefined();
		expect(calls[0]?.init?.signal).toBe(signal);
	});
});

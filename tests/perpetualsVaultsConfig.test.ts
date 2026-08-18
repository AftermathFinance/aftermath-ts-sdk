import { jest } from "@jest/globals";

jest.mock("@mysten/sui/transactions", () => ({
	Transaction: class {},
}));
jest.mock("../src/general/utils/helpers", () => ({
	Helpers: {
		parseJsonWithBigint: (text: string) =>
			JSON.parse(text, (_key, value) =>
				typeof value === "string" && value.endsWith("n")
					? BigInt(value.slice(0, -1))
					: value
			),
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
	version: 18_446_744_073_709_551_615n,
	collateralPriceFeedStorageToleranceMs: 30_000n,
	maxLockPeriodMs: 5_184_000_000n,
	maxForceWithdrawDelayMs: 86_400_000n,
	maxPerformanceFeePercentage: 0.2,
	minOwnerLockUsd: 1,
	maxOwnerLockUsd: 1_000_000,
	minDepositUsd: 1,
	maxMarketsInVault: 12n,
	maxPendingOrdersPerPosition: 70n,
	forceWithdrawPauseMs: 300_000n,
	maxAssistantsPerVault: 10n,
};

const vaultsConfigWireFixture = {
	...vaultsConfigFixture,
	version: "18446744073709551615n",
	collateralPriceFeedStorageToleranceMs: "30000n",
	maxLockPeriodMs: "5184000000n",
	maxForceWithdrawDelayMs: "86400000n",
	maxMarketsInVault: "12n",
	maxPendingOrdersPerPosition: "70n",
	forceWithdrawPauseMs: "300000n",
	maxAssistantsPerVault: "10n",
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
			return Promise.resolve(Response.json(vaultsConfigWireFixture));
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

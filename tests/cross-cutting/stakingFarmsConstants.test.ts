import { Farms } from "@test/packages/farms/fixtures.js";
import { Staking } from "@test/packages/staking/fixtures.js";

describe("high-level staking and farms transaction facades", () => {
	it("exposes facade constants as stable protocol boundaries", () => {
		expect(Staking.constants.bounds.minStake).toBe(1_000_000_000n);
		expect(Staking.constants.bounds.minUnstake).toBe(1_000_000_000n);
		expect(Staking.constants.bounds.maxExternalFeePercentage).toBe(0.5);
		expect(Farms.constants.minRewardsToClaim).toBe(10n);
		expect(Farms.constants.maxLockMultiplier).toBe(2);
	});
});

import { FULL_9, FULL_10, Staking } from "@test/packages/staking/fixtures.js";

describe("staking calculations", () => {
	it("calculates atomic unstake fees at reserve bounds and mid-liquidity", () => {
		const baseState = {
			objectId: FULL_10,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: 10_000_000_000_000n,
			atomicUnstakeSuiReserves: 10_000_000_000_000n,
			minAtomicUnstakeFee: 1_000_000_000_000_000n,
			maxAtomicUnstakeFee: 10_000_000_000_000_000n,
			totalRewardsAmount: 0n,
			totalSuiAmount: 0n,
			activeEpoch: 0n,
		};

		expect(
			Staking.calcAtomicUnstakeFee({ stakedSuiVaultState: baseState })
		).toBe(0.001);
		expect(
			Staking.calcAtomicUnstakeFee({
				stakedSuiVaultState: {
					...baseState,
					atomicUnstakeSuiReserves: 0n,
				},
			})
		).toBe(0.01);
		expect(
			Staking.calcAtomicUnstakeFee({
				stakedSuiVaultState: {
					...baseState,
					atomicUnstakeSuiReserves: 5_000_000_000_000n,
				},
			})
		).toBe(0.0055);
	});
});

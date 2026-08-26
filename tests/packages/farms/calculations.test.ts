import {
	FarmsStakedPosition,
	FarmsStakingPool,
	jest,
	makePool,
	makePosition,
	SUI_TYPE,
} from "@test/packages/farms/fixtures.js";

describe("staking and farm calculations", () => {
	it("clamps farm multipliers, lock windows, and available reward coin lists", () => {
		const pool = new FarmsStakingPool(makePool());
		expect(pool.version()).toBe(2);
		expect(pool.isStrictLockEnforcement()).toBe(true);
		expect(pool.isRelaxedLockEnforcement()).toBe(false);
		expect(pool.rewardCoinTypes()).toEqual([SUI_TYPE, "0x3::example::REWARD"]);
		expect(pool.nonZeroRewardCoinTypes()).toEqual([SUI_TYPE]);
		expect(pool.rewardCoin({ coinType: SUI_TYPE }).actualRewards).toBe(10_000n);
		expect(() =>
			pool.rewardCoin({ coinType: "0x404::missing::MISSING" })
		).toThrow("Invalid coin type");

		expect(pool.calcMultiplier({ lockDurationMs: 0 })).toBe(
			1_000_000_000_000_000_000n
		);
		expect(pool.calcMultiplier({ lockDurationMs: 3000 })).toBe(
			1_500_000_000_000_000_000n
		);
		expect(pool.calcMultiplier({ lockDurationMs: 9000 })).toBe(
			2_000_000_000_000_000_000n
		);

		jest.spyOn(Date, "now").mockReturnValue(2000);
		expect(pool.maxLockDurationMs()).toBe(5000);
		jest.spyOn(Date, "now").mockReturnValue(11_000);
		expect(pool.maxLockDurationMs()).toBe(0);

		const degenerate = new FarmsStakingPool(
			makePool({ minLockDurationMs: 4000, maxLockDurationMs: 4000 })
		);
		expect(degenerate.calcMultiplier({ lockDurationMs: 4000 })).toBe(
			1_000_000_000_000_000_000n
		);
	});

	it("emits discrete rewards only after a schedule and caps them by remaining balance", () => {
		const pool = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 100n,
						rewardsAccumulatedPerShare: 0n,
						emissionRate: 80n,
						emissionSchedulesMs: 100,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 0,
						rewardsRemaining: 100n,
						actualRewards: 100n,
					},
				],
			})
		);
		jest.spyOn(Date, "now").mockReturnValue(250);
		pool.emitRewards();
		expect(pool.stakingPool.rewardCoins[0]?.rewardsAccumulatedPerShare).toBe(
			100_000_000_000_000_000n
		);
		expect(pool.stakingPool.rewardCoins[0]?.lastRewardTimestamp).toBe(250);

		const noStake = new FarmsStakingPool(
			makePool({
				stakedAmount: 0n,
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 100n,
						rewardsAccumulatedPerShare: 7n,
						emissionRate: 80n,
						emissionSchedulesMs: 100,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 0,
						rewardsRemaining: 100n,
						actualRewards: 100n,
					},
				],
			})
		);
		noStake.emitRewards();
		expect(noStake.stakingPool.rewardCoins[0]?.rewardsAccumulatedPerShare).toBe(
			7n
		);

		const notDue = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 100n,
						rewardsAccumulatedPerShare: 7n,
						emissionRate: 80n,
						emissionSchedulesMs: 100,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 200,
						rewardsRemaining: 100n,
						actualRewards: 100n,
					},
				],
			})
		);
		jest.spyOn(Date, "now").mockReturnValue(250);
		notDue.emitRewards();
		expect(notDue.stakingPool.rewardCoins[0]?.rewardsAccumulatedPerShare).toBe(
			7n
		);
	});

	it("guards APR calculations for inactive pools and computes a deterministic active APR", () => {
		const pool = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 1_000n,
						rewardsAccumulatedPerShare: 0n,
						emissionRate: 100n,
						emissionSchedulesMs: 1000,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 0,
						rewardsRemaining: 1_000n,
						actualRewards: 1_000n,
					},
					{
						coinType: "0x3::example::REWARD",
						rewards: 1_000n,
						rewardsAccumulatedPerShare: 0n,
						emissionRate: 100n,
						emissionSchedulesMs: 1000,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 0,
						rewardsRemaining: 1_000n,
						actualRewards: 1_000n,
					},
				],
				maxLockMultiplier: 2_000_000_000_000_000_000n,
				emissionEndTimestamp: 10_000_000,
			})
		);
		jest.spyOn(Date, "now").mockReturnValue(1_000_000);
		expect(
			pool.calcApr({ coinType: SUI_TYPE, price: 0, decimals: 2, tvlUsd: 100 })
		).toBe(0);
		expect(
			pool.calcApr({ coinType: SUI_TYPE, price: 2, decimals: 2, tvlUsd: 0 })
		).toBe(0);
		expect(
			pool.calcApr({ coinType: SUI_TYPE, price: 2, decimals: 2, tvlUsd: 100 })
		).toBe(315_360);
		expect(
			pool.calcTotalApr({
				coinsToPrice: { [SUI_TYPE]: 2, "0x3::example::REWARD": 1 },
				coinsToDecimals: { [SUI_TYPE]: 2, "0x3::example::REWARD": 2 },
				tvlUsd: 100,
			})
		).toBe(473_040);

		const future = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 1n,
						rewardsAccumulatedPerShare: 0n,
						emissionRate: 2n,
						emissionSchedulesMs: 1000,
						emissionStartTimestamp: 2_000_000,
						lastRewardTimestamp: 0,
						rewardsRemaining: 1n,
						actualRewards: 1n,
					},
				],
			})
		);
		expect(
			future.calcApr({ coinType: SUI_TYPE, price: 1, decimals: 0, tvlUsd: 1 })
		).toBe(0);
	});

	it("applies reward thresholds and lock state to staked positions", () => {
		const pool = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						rewards: 100n,
						rewardsAccumulatedPerShare: 0n,
						emissionRate: 1n,
						emissionSchedulesMs: 1000,
						emissionStartTimestamp: 0,
						lastRewardTimestamp: 0,
						rewardsRemaining: 100n,
						actualRewards: 30n,
					},
				],
			})
		);
		const position = new FarmsStakedPosition(makePosition());
		expect(position.rewardCoinTypes()).toEqual([SUI_TYPE]);
		expect(position.unlockTimestamp()).toBe(3000);
		expect(position.isLockDuration()).toBe(true);
		expect(
			position.rewardsEarned({ coinType: SUI_TYPE, stakingPool: pool })
		).toBe(17n);
		expect(
			position.rewardCoinsToClaimableBalance({ stakingPool: pool })
		).toEqual({ [SUI_TYPE]: 17n });
		expect(position.nonZeroRewardCoinTypes({ stakingPool: pool })).toEqual([
			SUI_TYPE,
		]);
		expect(position.hasClaimableRewards({ stakingPool: pool })).toBe(true);
		expect(() =>
			position.rewardCoin({ coinType: "0x404::missing::MISSING" })
		).toThrow("Invalid coin type");

		const belowThreshold = new FarmsStakedPosition(
			makePosition({
				rewardCoins: [
					{
						coinType: SUI_TYPE,
						baseRewardsAccumulated: 9n,
						baseRewardsDebt: 0n,
						multiplierRewardsAccumulated: 0n,
						multiplierRewardsDebt: 0n,
					},
				],
			})
		);
		expect(
			belowThreshold.rewardsEarned({ coinType: SUI_TYPE, stakingPool: pool })
		).toBe(0n);

		const insufficientReserve = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{ ...pool.stakingPool.rewardCoins[0]!, actualRewards: 16n },
				],
			})
		);
		expect(
			position.rewardsEarned({
				coinType: SUI_TYPE,
				stakingPool: insufficientReserve,
			})
		).toBe(0n);

		jest.spyOn(Date, "now").mockReturnValue(2500);
		expect(position.isLocked({ stakingPool: pool })).toBe(true);
		expect(position.isStrictlyLocked({ stakingPool: pool })).toBe(true);
		expect(position.isRelaxedLocked({ stakingPool: pool })).toBe(false);
		jest.spyOn(Date, "now").mockReturnValue(3000);
		expect(position.isLocked({ stakingPool: pool })).toBe(false);
		expect(position.isStrictlyLocked({ stakingPool: pool })).toBe(false);

		const forcedOpen = new FarmsStakingPool(makePool({ isUnlocked: true }));
		expect(position.isLocked({ stakingPool: forcedOpen })).toBe(false);
	});

	it("updates stale positions by clamping lock state and adding new reward coins", () => {
		const pool = new FarmsStakingPool(
			makePool({
				stakedAmountWithMultiplier: 1_000n,
				emissionEndTimestamp: 10_000,
			})
		);
		const position = new FarmsStakedPosition(
			makePosition({
				stakedAmountWithMultiplier: 400n,
				lockDurationMs: 9000,
				lockMultiplier: 3_000_000_000_000_000_000n,
			})
		);
		jest.spyOn(Date, "now").mockReturnValue(2000);

		position.updatePosition({ stakingPool: pool });

		expect(position.stakedPosition.lockDurationMs).toBe(5000);
		expect(position.stakedPosition.lockMultiplier).toBe(
			2_000_000_000_000_000_000n
		);
		expect(position.stakedPosition.stakedAmountWithMultiplier).toBe(100n);
		expect(
			position.stakedPosition.rewardCoins.map((coin) => coin.coinType)
		).toEqual([SUI_TYPE, "0x3::example::REWARD"]);
		expect(
			position.stakedPosition.rewardCoins[1]?.baseRewardsDebt
		).toBeGreaterThan(0n);
		expect(position.stakedPosition.lastHarvestRewardsTimestamp).toBe(2000);

		const relaxedPool = new FarmsStakingPool(
			makePool({ lockEnforcement: "Relaxed" })
		);
		expect(position.isRelaxedLocked({ stakingPool: relaxedPool })).toBe(true);
		expect(position.isStrictlyLocked({ stakingPool: relaxedPool })).toBe(false);
		const endedPool = new FarmsStakingPool(
			makePool({ emissionEndTimestamp: 1000 })
		);
		expect(position.isLocked({ stakingPool: endedPool })).toBe(false);

		const emptyReserve = new FarmsStakingPool(
			makePool({
				rewardCoins: [
					{
						...makePool().rewardCoins[0]!,
						actualRewards: 0n,
					},
				],
			})
		);
		expect(
			position.rewardsEarned({ coinType: SUI_TYPE, stakingPool: emptyReserve })
		).toBe(0n);
	});
});

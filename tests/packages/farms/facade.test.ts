import {
	type AftermathApi,
	Farms,
	FarmsStakedPosition,
	FarmsStakingPool,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_10,
	jest,
	makePool,
	makePosition,
	NORMALIZED_SUI_TYPE,
	SUI_TYPE,
} from "@test/packages/farms/fixtures.js";

describe("high-level staking and farms transaction facades", () => {
	it("routes farm wrapper versions and position/pool-derived arguments", async () => {
		const farmsProvider = {
			buildCreateStakingPoolTxV1: jest.fn().mockReturnValue("create-v1"),
			buildCreateStakingPoolTxV2: jest.fn().mockReturnValue("create-v2"),
			fetchBuildStakeTxV1: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("pool-stake-v1"),
			fetchBuildStakeTxV2: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("pool-stake-v2"),
			buildHarvestRewardsTxV1: jest.fn().mockReturnValue("pool-harvest-v1"),
			buildHarvestRewardsTxV2: jest.fn().mockReturnValue("pool-harvest-v2"),
			buildIncreaseStakingPoolRewardsEmissionsTxV2: jest
				.fn()
				.mockReturnValue("increase-emissions"),
			buildSetStakingPoolMinStakeAmountTxV2: jest
				.fn()
				.mockReturnValue("min-stake"),
			buildSetStakingPoolMinLockDurationMsTxV2: jest
				.fn()
				.mockReturnValue("min-lock"),
			buildSetStakingPoolMaxLockDurationMsTxV2: jest
				.fn()
				.mockReturnValue("max-lock"),
			buildGrantOneTimeAdminCapTxV2: jest.fn().mockReturnValue("grant-admin"),
			fetchBuildInitializeStakingPoolRewardTxV2: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("initialize-reward"),
			fetchBuildTopUpStakingPoolRewardsTxV2: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("top-up-rewards"),
			buildRemoveStakingPoolRewardTxV2: jest
				.fn()
				.mockReturnValue("remove-rewards"),
			fetchBuildDepositPrincipalTxV2: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("deposit"),
			buildUnstakeTxV2: jest.fn().mockReturnValue("unstake"),
			buildWithdrawPrincipalTxV2: jest.fn().mockReturnValue("withdraw"),
			buildLockTxV2: jest.fn().mockReturnValue("lock"),
			buildRenewLockTxV2: jest.fn().mockReturnValue("renew"),
			buildUnlockTxV2: jest.fn().mockReturnValue("unlock"),
		};
		const api = {
			Farms: jest.fn(() => farmsProvider),
		} as unknown as AftermathApi;
		const farms = new Farms({}, api);
		const createInputs = {
			walletAddress: FULL_1,
			minLockDurationMs: 1000,
			maxLockDurationMs: 5000,
			maxLockMultiplier: 2_000_000_000_000_000_000n,
			minStakeAmount: 100n,
			stakeCoinType: SUI_TYPE,
		};
		expect(await farms.getCreateStakingPoolTransactionV1(createInputs)).toBe(
			"create-v1"
		);
		expect(await farms.getCreateStakingPoolTransactionV2(createInputs)).toBe(
			"create-v2"
		);

		const poolV2 = new FarmsStakingPool(makePool(), {}, api);
		expect(
			await poolV2.getStakeTransaction({
				stakeAmount: 200n,
				lockDurationMs: 300,
				walletAddress: FULL_1,
			})
		).toBe("pool-stake-v2");
		expect(
			await poolV2.getHarvestRewardsTransaction({
				stakedPositionIds: [FULL_3],
				walletAddress: FULL_1,
			})
		).toBe("pool-harvest-v2");
		expect(
			await poolV2.getIncreaseRewardsEmissionsTransaction({
				ownerCapId: FULL_2,
				rewards: [
					{
						rewardCoinType: SUI_TYPE,
						emissionScheduleMs: 600,
						emissionRate: 7n,
					},
				],
				walletAddress: FULL_1,
			})
		).toBe("increase-emissions");
		expect(
			await poolV2.getUpdateMinStakeAmountTransaction({
				ownerCapId: FULL_2,
				minStakeAmount: 8n,
				walletAddress: FULL_1,
			})
		).toBe("min-stake");
		expect(
			poolV2.getSetMinLockDurationMsTransaction({
				ownerCapId: FULL_2,
				lockDurationMs: 400n,
				walletAddress: FULL_1,
			})
		).toBe("min-lock");
		expect(
			poolV2.getSetMaxLockDurationMsTransaction({
				ownerCapId: FULL_2,
				lockDurationMs: 800n,
				walletAddress: FULL_1,
			})
		).toBe("max-lock");
		expect(
			poolV2.getGrantOneTimeAdminCapTransaction({
				ownerCapId: FULL_2,
				recipientAddress: FULL_1,
				rewardCoinType: SUI_TYPE,
				walletAddress: FULL_1,
			})
		).toBe("grant-admin");
		expect(
			await poolV2.getInitializeRewardTransaction({
				ownerCapId: FULL_2,
				rewardAmount: 900n,
				emissionScheduleMs: 1000,
				emissionRate: 9n,
				emissionDelayTimestampMs: 2000,
				rewardCoinType: SUI_TYPE,
				walletAddress: FULL_1,
			})
		).toBe("initialize-reward");
		expect(
			await poolV2.getTopUpRewardsTransaction({
				ownerCapId: FULL_2,
				rewards: [{ rewardAmount: 10n, rewardCoinType: SUI_TYPE }],
				walletAddress: FULL_1,
			})
		).toBe("top-up-rewards");
		expect(
			poolV2.getRemoveRewardsTransaction({
				ownerCapId: FULL_2,
				rewards: [{ rewardAmount: 5n, rewardCoinType: SUI_TYPE }],
				walletAddress: FULL_1,
			})
		).toBe("remove-rewards");

		const poolV1 = new FarmsStakingPool(makePool({ version: 1 }), {}, api);
		await expect(
			poolV1.getStakeTransaction({
				stakeAmount: 200n,
				lockDurationMs: 300,
				walletAddress: FULL_1,
			})
		).resolves.toBe("pool-stake-v1");
		expect(() =>
			poolV1.getSetMinLockDurationMsTransaction({
				ownerCapId: FULL_2,
				lockDurationMs: 400n,
				walletAddress: FULL_1,
			})
		).toThrow("not supported on V1 staking pools");

		const position = new FarmsStakedPosition(
			makePosition(),
			undefined,
			{},
			api
		);
		expect(
			await position.getDepositPrincipalTransaction({
				depositAmount: 50n,
				walletAddress: FULL_1,
			})
		).toBe("deposit");
		expect(
			await position.getUnstakeTransaction({
				walletAddress: FULL_1,
				stakingPool: poolV2,
			})
		).toBe("unstake");
		expect(
			await position.getLockTransaction({
				lockDurationMs: 500,
				walletAddress: FULL_1,
			})
		).toBe("lock");
		expect(
			await position.getWithdrawPrincipalTransaction({
				withdrawAmount: 25n,
				walletAddress: FULL_1,
				stakingPool: poolV2,
			})
		).toBe("withdraw");
		expect(
			await position.getRenewLockTransaction({ walletAddress: FULL_1 })
		).toBe("renew");
		expect(await position.getUnlockTransaction({ walletAddress: FULL_1 })).toBe(
			"unlock"
		);
		expect(
			await position.getHarvestRewardsTransaction({
				walletAddress: FULL_1,
				stakingPool: poolV2,
			})
		).toBe("pool-harvest-v2");
		expect(farmsProvider.fetchBuildDepositPrincipalTxV2).toHaveBeenCalledWith({
			depositAmount: 50n,
			walletAddress: FULL_1,
			stakedPositionId: FULL_3,
			stakeCoinType: NORMALIZED_SUI_TYPE,
			stakingPoolId: FULL_10,
		});
	});
});

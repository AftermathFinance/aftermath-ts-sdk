import {
	ADDRESSES,
	type AftermathApi,
	API_BASE_URL,
	EVENT_TYPE,
	FARM_TYPE,
	Farms,
	FarmsApi,
	FarmsStakingPool,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_4,
	FULL_9,
	FULL_10,
	installFetchQueue,
	lastMoveCall,
	makeFakeApi,
	makePool,
	moveCalls,
	StakingApi,
	SUI_TYPE,
	Transaction,
} from "@test/packages/farms/fixtures.js";

describe("farms HTTP facade and pagination", () => {
	it("maps pool/position wrappers and forwards every public endpoint body", async () => {
		const pool = { objectId: FULL_10, objectType: FARM_TYPE };
		const position = {
			objectId: FULL_3,
			objectType: `${FULL_9}::staked_position::Position`,
		};
		const ownerCap = [
			{
				objectId: FULL_2,
				objectType: `${FULL_9}::authority::OwnerCap`,
				stakingPoolId: FULL_10,
			},
		];
		const adminCap = [
			{
				objectId: FULL_4,
				objectType: `${FULL_9}::vault::OneTime`,
				stakingPoolId: FULL_10,
			},
		];
		const events = [
			{ type: "0x9::events::DepositedPrincipalEvent", timestamp: 1 },
			{ type: "0x9::events::HarvestedRewardsEvent", timestamp: 2 },
		];
		const calls = installFetchQueue([
			pool,
			[pool],
			[pool],
			[position],
			ownerCap,
			adminCap,
			12.5,
			7.5,
			[{ farmId: FULL_10, tvl: 12.5, rewardsTvl: 7.5 }],
			events,
		]);
		const farms = new Farms({ baseUrl: API_BASE_URL });

		const one = await farms.getStakingPool({ objectId: FULL_10 });
		expect(one).toBeInstanceOf(FarmsStakingPool);
		expect(one.stakingPool.objectId).toBe(FULL_10);
		expect(
			(await farms.getStakingPools({ objectIds: [FULL_10] }))[0]?.stakingPool
				.objectId
		).toBe(FULL_10);
		expect((await farms.getAllStakingPools())[0]?.stakingPool.objectId).toBe(
			FULL_10
		);
		expect(
			(await farms.getOwnedStakedPositions({ walletAddress: FULL_1 }))[0]
				?.stakedPosition.objectId
		).toBe(FULL_3);
		expect(
			await farms.getOwnedStakingPoolOwnerCaps({ walletAddress: FULL_1 })
		).toEqual(ownerCap);
		expect(
			await farms.getOwnedStakingPoolOneTimeAdminCaps({ walletAddress: FULL_1 })
		).toEqual(adminCap);
		expect(await farms.getTVL()).toBe(12.5);
		expect(await farms.getRewardsTVL({ farmIds: [FULL_10] })).toBe(7.5);
		expect(await farms.getFarmSummaries({ farmIds: [FULL_10] })).toEqual([
			{ farmId: FULL_10, tvl: 12.5, rewardsTvl: 7.5 },
		]);
		const page = await farms.getInteractionEvents({
			walletAddress: FULL_1,
			cursor: 3,
			limit: 2,
		});
		expect(page).toEqual({ events, nextCursor: 5 });

		expect(String(calls[0]?.input)).toBe(
			`${API_BASE_URL}/api/farms/${FULL_10}`
		);
		expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({
			farmIds: [FULL_10],
		});
		expect(JSON.parse(calls[2]?.init?.body as string)).toEqual({});
		expect(JSON.parse(calls[3]?.init?.body as string)).toEqual({
			walletAddress: FULL_1,
		});
		expect(JSON.parse(calls[6]?.init?.body as string)).toEqual({});
		expect(JSON.parse(calls[7]?.init?.body as string)).toEqual({
			farmIds: [FULL_10],
		});
		expect(JSON.parse(calls[8]?.init?.body as string)).toEqual({
			farmIds: [FULL_10],
		});
		expect(JSON.parse(calls[9]?.init?.body as string)).toEqual({
			walletAddress: FULL_1,
			cursor: 3,
			limit: 2,
		});
	});

	it("stops an indexer page when the response is shorter than the requested limit", async () => {
		installFetchQueue([[{ type: EVENT_TYPE }]]);
		const page = await new Farms({
			baseUrl: API_BASE_URL,
		}).getInteractionEvents({
			walletAddress: FULL_1,
			cursor: 7,
			limit: 2,
		});
		expect(page.nextCursor).toBeUndefined();
	});

	it("scopes staking-pool TVL requests to the wrapped pool id", async () => {
		const calls = installFetchQueue([4.25, 2.5]);
		const pool = new FarmsStakingPool(makePool(), { baseUrl: API_BASE_URL });

		expect(await pool.getTVL()).toBe(4.25);
		expect(await pool.getRewardsTVL()).toBe(2.5);
		expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({
			farmIds: [FULL_10],
		});
		expect(JSON.parse(calls[1]?.init?.body as string)).toEqual({
			farmIds: [FULL_10],
		});
	});
});

describe("farms transaction commands and builders", () => {
	it("covers versioned position commands and pool creation sequencing", () => {
		const { api } = makeFakeApi();
		const farmsApi = new FarmsApi(api);
		const positionArgs = {
			stakedPositionId: "0x401",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
		};

		const commandCases: Array<{
			name: string;
			expectedFunction: string;
			invoke: (tx: Transaction) => unknown;
		}> = [
			{
				name: "stake V1",
				expectedFunction: "stake",
				invoke: (tx) =>
					farmsApi.stakeTxV1({
						...positionArgs,
						tx,
						stakeCoinId: "0x403",
						lockDurationMs: 500,
					}),
			},
			{
				name: "stake V2",
				expectedFunction: "stake",
				invoke: (tx) =>
					farmsApi.stakeTxV2({
						...positionArgs,
						tx,
						stakeCoinId: "0x403",
						lockDurationMs: 500,
						lockEnforcement: "Relaxed",
					}),
			},
			{
				name: "deposit V1",
				expectedFunction: "deposit_principal",
				invoke: (tx) =>
					farmsApi.depositPrincipalTxV1({
						...positionArgs,
						tx,
						stakeCoinId: "0x403",
					}),
			},
			{
				name: "deposit V2",
				expectedFunction: "deposit_principal",
				invoke: (tx) =>
					farmsApi.depositPrincipalTxV2({
						...positionArgs,
						tx,
						stakeCoinId: "0x403",
					}),
			},
			{
				name: "withdraw V1",
				expectedFunction: "withdraw_principal",
				invoke: (tx) =>
					farmsApi.withdrawPrincipalTxV1({
						...positionArgs,
						tx,
						withdrawAmount: 404n,
					}),
			},
			{
				name: "withdraw V2",
				expectedFunction: "withdraw_principal",
				invoke: (tx) =>
					farmsApi.withdrawPrincipalTxV2({
						...positionArgs,
						tx,
						withdrawAmount: 404n,
					}),
			},
			{
				name: "lock V1",
				expectedFunction: "lock",
				invoke: (tx) =>
					farmsApi.lockTxV1({ ...positionArgs, tx, lockDurationMs: 500 }),
			},
			{
				name: "lock V2",
				expectedFunction: "lock",
				invoke: (tx) =>
					farmsApi.lockTxV2({ ...positionArgs, tx, lockDurationMs: 500 }),
			},
			{
				name: "renew V1",
				expectedFunction: "renew_lock",
				invoke: (tx) => farmsApi.renewLockTxV1({ ...positionArgs, tx }),
			},
			{
				name: "renew V2",
				expectedFunction: "renew_lock",
				invoke: (tx) => farmsApi.renewLockTxV2({ ...positionArgs, tx }),
			},
			{
				name: "unlock V1",
				expectedFunction: "unlock",
				invoke: (tx) => farmsApi.unlockTxV1({ ...positionArgs, tx }),
			},
			{
				name: "unlock V2",
				expectedFunction: "unlock",
				invoke: (tx) => farmsApi.unlockTxV2({ ...positionArgs, tx }),
			},
			{
				name: "destroy V1",
				expectedFunction: "destroy",
				invoke: (tx) =>
					farmsApi.destroyStakedPositionTxV1({ ...positionArgs, tx }),
			},
			{
				name: "destroy V2",
				expectedFunction: "destroy",
				invoke: (tx) =>
					farmsApi.destroyStakedPositionTxV2({ ...positionArgs, tx }),
			},
			{
				name: "update position V1",
				expectedFunction: "update_position",
				invoke: (tx) => farmsApi.updatePositionTxV1({ ...positionArgs, tx }),
			},
			{
				name: "update position V2",
				expectedFunction: "update_position",
				invoke: (tx) => farmsApi.updatePositionTxV2({ ...positionArgs, tx }),
			},
			{
				name: "begin harvest V1",
				expectedFunction: "begin_harvest",
				invoke: (tx) =>
					farmsApi.beginHarvestTxV1({
						tx,
						stakingPoolId: "0x402",
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "begin harvest V2",
				expectedFunction: "begin_harvest_tx",
				invoke: (tx) => farmsApi.beginHarvestTxV2({ tx, ...positionArgs }),
			},
			{
				name: "harvest V1",
				expectedFunction: "harvest_rewards",
				invoke: (tx) =>
					farmsApi.harvestRewardsTxV1({
						tx,
						...positionArgs,
						harvestedRewardsEventMetadataId: "0x405",
						rewardCoinType: SUI_TYPE,
					}),
			},
			{
				name: "harvest V2",
				expectedFunction: "harvest_rewards",
				invoke: (tx) =>
					farmsApi.harvestRewardsTxV2({
						tx,
						...positionArgs,
						harvestRewardsCap: "0x405",
						rewardCoinType: SUI_TYPE,
					}),
			},
			{
				name: "end harvest V1",
				expectedFunction: "end_harvest",
				invoke: (tx) =>
					farmsApi.endHarvestTxV1({
						tx,
						harvestedRewardsEventMetadataId: "0x405",
					}),
			},
			{
				name: "end harvest V2",
				expectedFunction: "end_harvest_tx",
				invoke: (tx) =>
					farmsApi.endHarvestTxV2({ tx, harvestRewardsCap: "0x405" }),
			},
			{
				name: "new pool V1",
				expectedFunction: "new",
				invoke: (tx) =>
					farmsApi.newStakingPoolTxV1({
						tx,
						lockEnforcement: "Strict",
						minLockDurationMs: 100,
						maxLockDurationMs: 1000,
						maxLockMultiplier: 2_000_000_000_000_000_000n,
						minStakeAmount: 10n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "new pool V2",
				expectedFunction: "new",
				invoke: (tx) =>
					farmsApi.newStakingPoolTxV2({
						tx,
						lockEnforcements: ["Strict", "Relaxed"],
						minLockDurationMs: 100,
						maxLockDurationMs: 1000,
						maxLockMultiplier: 2_000_000_000_000_000_000n,
						minStakeAmount: 10n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "share pool V1",
				expectedFunction: "share_vault",
				invoke: (tx) =>
					farmsApi.shareStakingPoolTxV1({
						tx,
						stakingPoolId: "0x407",
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "share pool V2",
				expectedFunction: "share",
				invoke: (tx) =>
					farmsApi.shareStakingPoolTxV2({
						tx,
						stakingPoolId: "0x407",
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "transfer owner cap",
				expectedFunction: "transfer_owner_cap",
				invoke: (tx) =>
					farmsApi.transferOwnerCapTxV1({
						tx,
						ownerCapId: "0x408",
						recipientAddress: FULL_2,
					}),
			},
			{
				name: "grant admin cap V1",
				expectedFunction: "grant_one_time_admin_cap",
				invoke: (tx) =>
					farmsApi.grantOneTimeAdminCapTxV1({
						tx,
						ownerCapId: "0x408",
						recipientAddress: FULL_2,
						rewardCoinType: SUI_TYPE,
					}),
			},
			{
				name: "grant admin cap V2",
				expectedFunction: "grant_one_time_admin_cap",
				invoke: (tx) =>
					farmsApi.grantOneTimeAdminCapTxV2({
						tx,
						ownerCapId: "0x408",
						recipientAddress: FULL_2,
						rewardCoinType: SUI_TYPE,
					}),
			},
			{
				name: "initialize reward V1 as owner",
				expectedFunction: "initialize_reward",
				invoke: (tx) =>
					farmsApi.initializeStakingPoolRewardTxV1({
						tx,
						stakingPoolId: "0x407",
						rewardCoinId: "0x409",
						emissionScheduleMs: 100,
						emissionRate: 11n,
						emissionDelayTimestampMs: 200,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
						ownerCapId: "0x408",
					}),
			},
			{
				name: "initialize reward V2 as admin",
				expectedFunction: "initialize_reward_and_consume_admin_cap",
				invoke: (tx) =>
					farmsApi.initializeStakingPoolRewardTxV2({
						tx,
						stakingPoolId: "0x407",
						rewardCoinId: "0x409",
						emissionScheduleMs: 100,
						emissionRate: 11n,
						emissionDelayTimestampMs: 200,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
						oneTimeAdminCapId: "0x40a",
					}),
			},
			{
				name: "top up reward V1 as owner",
				expectedFunction: "add_reward",
				invoke: (tx) =>
					farmsApi.topUpStakingPoolRewardTxV1({
						tx,
						stakingPoolId: "0x407",
						rewardCoinId: "0x409",
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
						ownerCapId: "0x408",
					}),
			},
			{
				name: "top up reward V2 as admin",
				expectedFunction: "add_reward_and_consume_admin_cap",
				invoke: (tx) =>
					farmsApi.topUpStakingPoolRewardTxV2({
						tx,
						stakingPoolId: "0x407",
						rewardCoinId: "0x409",
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
						oneTimeAdminCapId: "0x40a",
					}),
			},
			{
				name: "increase emissions V1",
				expectedFunction: "update_emissions_for",
				invoke: (tx) =>
					farmsApi.increaseStakingPoolRewardEmissionsTxV1({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						emissionScheduleMs: 100,
						emissionRate: 11n,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
					}),
			},
			{
				name: "increase emissions V2",
				expectedFunction: "update_emission_schedule",
				invoke: (tx) =>
					farmsApi.increaseStakingPoolRewardEmissionsTxV2({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						emissionScheduleMs: 100,
						emissionRate: 11n,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
					}),
			},
			{
				name: "set minimum stake V1",
				expectedFunction: "set_min_stake_amount",
				invoke: (tx) =>
					farmsApi.setStakingPoolMinStakeAmountTxV1({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						minStakeAmount: 12n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "set minimum stake V2",
				expectedFunction: "set_min_stake_amount",
				invoke: (tx) =>
					farmsApi.setStakingPoolMinStakeAmountTxV2({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						minStakeAmount: 12n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "set minimum lock",
				expectedFunction: "set_min_lock_duration_ms",
				invoke: (tx) =>
					farmsApi.setStakingPoolMinLockDurationMsTxV2({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						lockDurationMs: 13n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "set maximum lock",
				expectedFunction: "set_max_lock_duration_ms",
				invoke: (tx) =>
					farmsApi.setStakingPoolMaxLockDurationMsTxV2({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						lockDurationMs: 14n,
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "remove reward V1",
				expectedFunction: "remove_reward",
				invoke: (tx) =>
					farmsApi.removeStakingPoolRewardTxV1({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						rewardAmount: 15n,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
					}),
			},
			{
				name: "remove reward V2",
				expectedFunction: "remove_reward",
				invoke: (tx) =>
					farmsApi.removeStakingPoolRewardTxV2({
						tx,
						ownerCapId: "0x408",
						stakingPoolId: "0x407",
						rewardAmount: 15n,
						stakeCoinType: SUI_TYPE,
						rewardCoinType: "0x3::example::REWARD",
					}),
			},
			{
				name: "is unlocked inspection",
				expectedFunction: "is_vault_unlocked",
				invoke: (tx) =>
					farmsApi.isVaultUnlockedTxV1({
						tx,
						stakingPoolId: "0x407",
						stakeCoinType: SUI_TYPE,
					}),
			},
			{
				name: "remaining rewards inspection",
				expectedFunction: "remaining_rewards",
				invoke: (tx) =>
					farmsApi.remainingRewardsTxV1({
						tx,
						stakingPoolId: "0x407",
						stakeCoinType: SUI_TYPE,
					}),
			},
		];

		for (const testCase of commandCases) {
			const tx = new Transaction();
			testCase.invoke(tx);
			expect(moveCalls(tx)[moveCalls(tx).length - 1]?.function).toBe(
				testCase.expectedFunction
			);
		}

		const created = farmsApi.buildCreateStakingPoolTxV2({
			walletAddress: FULL_1,
			minLockDurationMs: 100,
			maxLockDurationMs: 1000,
			maxLockMultiplier: 2_000_000_000_000_000_000n,
			minStakeAmount: 10n,
			stakeCoinType: SUI_TYPE,
		});
		expect(created.getData().sender).toBe(FULL_1);
		expect(moveCalls(created).map((call) => call.function)).toEqual([
			"new",
			"share",
		]);
	});

	it("builds harvest, unstake, reward mutation, and removal transactions", async () => {
		const { api, coin } = makeFakeApi();
		const farmsApi = new FarmsApi(api);
		const base = {
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			stakedPositionIds: ["0x401"],
			rewardCoinTypes: ["0x3::example::REWARD"],
			walletAddress: FULL_1,
		};

		const harvested = farmsApi.buildHarvestRewardsTxV2(base);
		expect(moveCalls(harvested).map((call) => call.function)).toEqual([
			"begin_harvest_tx",
			"harvest_rewards",
			"end_harvest_tx",
		]);

		const unstaked = farmsApi.buildUnstakeTxV2({
			...base,
			stakedPositionId: "0x401",
			rewardCoinTypes: [],
			withdrawAmount: 500n,
		});
		expect(moveCalls(unstaked).map((call) => call.function)).toEqual([
			"withdraw_principal",
			"destroy",
		]);

		const initialized =
			await farmsApi.fetchBuildInitializeStakingPoolRewardTxV2({
				...base,
				rewardAmount: 600n,
				emissionScheduleMs: 700,
				emissionRate: 8n,
				emissionDelayTimestampMs: 900,
				rewardCoinType: "0x3::example::REWARD",
				ownerCapId: "0x406",
			});
		expect(
			moveCalls(initialized)[moveCalls(initialized).length - 1]?.function
		).toBe("initialize_reward");
		expect(coin.fetchCoinWithAmountTx).toHaveBeenCalledWith(
			expect.objectContaining({ coinAmount: 600n })
		);

		const toppedUp = await farmsApi.fetchBuildTopUpStakingPoolRewardsTxV2({
			...base,
			rewards: [
				{ rewardCoinType: "0x3::example::REWARD", rewardAmount: 10n },
				{ rewardCoinType: SUI_TYPE, rewardAmount: 11n },
			],
			ownerCapId: "0x406",
		});
		expect(moveCalls(toppedUp).map((call) => call.function)).toEqual([
			"add_reward",
			"add_reward",
		]);

		const increased = farmsApi.buildIncreaseStakingPoolRewardsEmissionsTxV2({
			ownerCapId: "0x406",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			walletAddress: FULL_1,
			rewards: [
				{
					rewardCoinType: "0x3::example::REWARD",
					emissionScheduleMs: 10,
					emissionRate: 12n,
				},
				{ rewardCoinType: SUI_TYPE, emissionScheduleMs: 20, emissionRate: 13n },
			],
		});
		expect(moveCalls(increased).map((call) => call.function)).toEqual([
			"update_emission_schedule",
			"update_emission_schedule",
		]);

		const removed = farmsApi.buildRemoveStakingPoolRewardTxV2({
			ownerCapId: "0x406",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			walletAddress: FULL_1,
			rewards: [
				{ rewardCoinType: "0x3::example::REWARD", rewardAmount: 14n },
				{ rewardCoinType: SUI_TYPE, rewardAmount: 15n },
			],
		});
		expect(moveCalls(removed).map((call) => call.function)).toEqual([
			"remove_reward",
			"remove_reward",
		]);

		expect(() =>
			farmsApi.buildHarvestRewardsTxV2({ ...base, stakedPositionIds: [] })
		).toThrow();
	});

	it("builds the deprecated farm transaction paths and preserves sender/options", async () => {
		const { api, coin } = makeFakeApi();
		const farmsApi = new FarmsApi(api);
		const stake = {
			stakingPoolId: "0x402",
			lockDurationMs: 500,
			stakeCoinType: SUI_TYPE,
			stakeAmount: 100n,
			walletAddress: FULL_1,
		};
		const deposit = {
			stakedPositionId: "0x401",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			depositAmount: 101n,
			walletAddress: FULL_1,
		};
		const position = {
			stakedPositionId: "0x401",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			walletAddress: FULL_1,
		};

		const stakeV1 = await farmsApi.fetchBuildStakeTxV1(stake);
		const stakeV2 = await farmsApi.fetchBuildStakeTxV2(stake);
		expect(lastMoveCall(stakeV1)?.function).toBe("stake");
		expect(lastMoveCall(stakeV2)?.function).toBe("stake");
		expect(stakeV1.getData().sender).toBe(FULL_1);
		expect(stakeV2.getData().sender).toBe(FULL_1);

		const depositV1 = await farmsApi.fetchBuildDepositPrincipalTxV1(deposit);
		const depositV2 = await farmsApi.fetchBuildDepositPrincipalTxV2(deposit);
		expect(lastMoveCall(depositV1)?.function).toBe("deposit_principal");
		expect(lastMoveCall(depositV2)?.function).toBe("deposit_principal");
		expect(coin.fetchCoinWithAmountTx).toHaveBeenCalledWith(
			expect.objectContaining({ coinAmount: 101n, isSponsoredTx: undefined })
		);

		const withdrawV1 = farmsApi.buildWithdrawPrincipalTxV1({
			...position,
			withdrawAmount: 102n,
		});
		const withdrawV2 = farmsApi.buildWithdrawPrincipalTxV2({
			...position,
			withdrawAmount: 103n,
		});
		expect(lastMoveCall(withdrawV1)?.function).toBe("withdraw_principal");
		expect(lastMoveCall(withdrawV2)?.function).toBe("withdraw_principal");

		const harvestV1 = farmsApi.buildHarvestRewardsTxV1({
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			stakedPositionIds: ["0x401", "0x403"],
			rewardCoinTypes: [SUI_TYPE, "0x3::example::REWARD"],
			walletAddress: FULL_1,
		});
		expect(moveCalls(harvestV1).map((call) => call.function)).toEqual([
			"begin_harvest",
			"harvest_rewards",
			"harvest_rewards",
			"harvest_rewards",
			"harvest_rewards",
			"end_harvest",
		]);

		const unstakeV1 = farmsApi.buildUnstakeTxV1({
			stakingPoolId: "0x402",
			stakedPositionId: "0x401",
			stakeCoinType: SUI_TYPE,
			rewardCoinTypes: ["0x3::example::REWARD"],
			withdrawAmount: 104n,
			walletAddress: FULL_1,
		});
		expect(moveCalls(unstakeV1).map((call) => call.function)).toEqual([
			"begin_harvest",
			"harvest_rewards",
			"end_harvest",
			"withdraw_principal",
			"destroy",
		]);

		const updateV1 = farmsApi.buildUpdatePositionTxV1(position);
		const updateV2 = farmsApi.buildUpdatePositionTx2(position);
		const lockV1 = farmsApi.buildLockTxV1({ ...position, lockDurationMs: 105 });
		const lockV2 = farmsApi.buildLockTxV2({ ...position, lockDurationMs: 106 });
		const renewV1 = farmsApi.buildRenewLockTxV1(position);
		const renewV2 = farmsApi.buildRenewLockTxV2(position);
		const unlockV1 = farmsApi.buildUnlockTxV1(position);
		const unlockV2 = farmsApi.buildUnlockTxV2(position);
		expect(lastMoveCall(updateV1)?.function).toBe("update_position");
		expect(lastMoveCall(updateV2)?.function).toBe("update_position");
		expect(lastMoveCall(lockV1)?.function).toBe("lock");
		expect(lastMoveCall(lockV2)?.function).toBe("lock");
		expect(lastMoveCall(renewV1)?.function).toBe("renew_lock");
		expect(lastMoveCall(renewV2)?.function).toBe("renew_lock");
		expect(lastMoveCall(unlockV1)?.function).toBe("unlock");
		expect(lastMoveCall(unlockV2)?.function).toBe("unlock");

		const createdV1 = farmsApi.buildCreateStakingPoolTxV1({
			minLockDurationMs: 10,
			maxLockDurationMs: 100,
			maxLockMultiplier: 2_000_000_000_000_000_000n,
			minStakeAmount: 10n,
			stakeCoinType: SUI_TYPE,
			walletAddress: FULL_1,
		});
		expect(moveCalls(createdV1).map((call) => call.function)).toEqual([
			"new",
			"share_vault",
			"transfer_owner_cap",
		]);

		const initializedV1 =
			await farmsApi.fetchBuildInitializeStakingPoolRewardTxV1({
				stakingPoolId: "0x402",
				rewardAmount: 105n,
				emissionScheduleMs: 10,
				emissionRate: 11n,
				emissionDelayTimestampMs: 12,
				stakeCoinType: SUI_TYPE,
				rewardCoinType: "0x3::example::REWARD",
				walletAddress: FULL_1,
				oneTimeAdminCapId: "0x406",
			});
		expect(lastMoveCall(initializedV1)?.function).toBe(
			"initialize_reward_and_consume_admin_cap"
		);
		const toppedUpV1 = await farmsApi.fetchBuildTopUpStakingPoolRewardsTxV1({
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			rewards: [{ rewardCoinType: "0x3::example::REWARD", rewardAmount: 106n }],
			walletAddress: FULL_1,
			oneTimeAdminCapId: "0x406",
		});
		expect(lastMoveCall(toppedUpV1)?.function).toBe(
			"add_reward_and_consume_admin_cap"
		);

		const increasedV1 = farmsApi.buildIncreaseStakingPoolRewardsEmissionsTxV1({
			ownerCapId: "0x406",
			stakingPoolId: "0x402",
			stakeCoinType: SUI_TYPE,
			walletAddress: FULL_1,
			rewards: [
				{
					rewardCoinType: "0x3::example::REWARD",
					emissionScheduleMs: 10,
					emissionRate: 12n,
				},
			],
		});
		expect(lastMoveCall(increasedV1)?.function).toBe("update_emissions_for");
		expect(
			lastMoveCall(
				farmsApi.buildSetStakingPoolMinStakeAmountTxV1({
					...position,
					ownerCapId: "0x406",
					minStakeAmount: 107n,
				})
			)?.function
		).toBe("set_min_stake_amount");
		expect(
			lastMoveCall(
				farmsApi.buildSetStakingPoolMinStakeAmountTxV2({
					...position,
					ownerCapId: "0x406",
					minStakeAmount: 108n,
				})
			)?.function
		).toBe("set_min_stake_amount");
		expect(
			lastMoveCall(
				farmsApi.buildSetStakingPoolMinLockDurationMsTxV2({
					...position,
					ownerCapId: "0x406",
					lockDurationMs: 109n,
				})
			)?.function
		).toBe("set_min_lock_duration_ms");
		expect(
			lastMoveCall(
				farmsApi.buildSetStakingPoolMaxLockDurationMsTxV2({
					...position,
					ownerCapId: "0x406",
					lockDurationMs: 110n,
				})
			)?.function
		).toBe("set_max_lock_duration_ms");
		expect(
			lastMoveCall(
				farmsApi.buildGrantOneTimeAdminCapTxV1({
					ownerCapId: "0x406",
					recipientAddress: FULL_2,
					rewardCoinType: SUI_TYPE,
					walletAddress: FULL_1,
				})
			)?.function
		).toBe("grant_one_time_admin_cap");
		expect(
			lastMoveCall(
				farmsApi.buildGrantOneTimeAdminCapTxV2({
					ownerCapId: "0x406",
					recipientAddress: FULL_2,
					rewardCoinType: SUI_TYPE,
					walletAddress: FULL_1,
				})
			)?.function
		).toBe("grant_one_time_admin_cap");
		expect(
			lastMoveCall(
				farmsApi.buildRemoveStakingPoolRewardTxV1({
					...position,
					ownerCapId: "0x406",
					rewards: [{ rewardCoinType: SUI_TYPE, rewardAmount: 111n }],
				})
			)?.function
		).toBe("remove_reward");
	});

	it("fails fast when a versioned API is configured without required addresses", () => {
		const { api } = makeFakeApi();
		const missingAddresses = {
			...api,
			addresses: {},
		} as unknown as AftermathApi;
		expect(() => new FarmsApi(missingAddresses)).toThrow(
			"not all required addresses have been set in provider"
		);
		const missingStaking = {
			...api,
			addresses: { farms: ADDRESSES.farms },
		} as unknown as AftermathApi;
		expect(() => new StakingApi(missingStaking)).toThrow(
			"not all required addresses have been set in provider"
		);
	});
});

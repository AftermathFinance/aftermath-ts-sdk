import {
	Casting,
	eventMeta,
	eventV1,
	eventV2,
	FarmsApi,
	FULL_1,
	FULL_2,
	FULL_3,
	FULL_9,
	makeFakeApi,
	NORMALIZED_SUI_TYPE,
	objectView,
} from "@test/packages/farms/fixtures.js";

describe("staking and farms casters", () => {
	it("casts V1 and V2 farm objects without losing large balances", () => {
		const v1 = Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV1(
			objectView("0x9::staked_position::StakedPosition<0x2::sui::SUI>", {
				afterburner_vault_id: "0x10",
				balance: "9007199254740993",
				multiplier_staked_amount: "12",
				lock_start_timestamp_ms: "100",
				lock_duration_ms: "200",
				lock_multiplier: "1500000000000000000",
				last_reward_timestamp_ms: "300",
				base_rewards_accumulated: ["4"],
				base_rewards_debt: ["1"],
				multiplier_rewards_accumulated: ["5"],
				multiplier_rewards_debt: ["2"],
			})
		);
		expect(v1).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::staked_position::StakedPosition<2::sui::SUI>`,
			stakeCoinType: NORMALIZED_SUI_TYPE,
			stakingPoolObjectId: "0x10",
			stakedAmount: 9_007_199_254_740_993n,
			stakedAmountWithMultiplier: 12n,
			lockStartTimestamp: 100,
			lockDurationMs: 200,
			lockMultiplier: 1_500_000_000_000_000_000n,
			lastHarvestRewardsTimestamp: 300,
			rewardCoins: [
				{
					baseRewardsAccumulated: 4n,
					baseRewardsDebt: 1n,
					multiplierRewardsAccumulated: 5n,
					multiplierRewardsDebt: 2n,
				},
			],
			version: 1,
		});

		const v2 = Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV2(
			objectView("0x9::staked_position::StakedPosition<0x2::sui::SUI>", {
				vault_id: "0x11",
				balance: "0",
				multiplier_staked_amount: "0",
				lock_start_timestamp_ms: "0",
				lock_duration_ms: "0",
				lock_multiplier: "1000000000000000000",
				last_reward_timestamp_ms: "0",
				base_rewards_accumulated: ["13"],
				base_rewards_debt: ["14"],
				multiplier_rewards_accumulated: ["15"],
				multiplier_rewards_debt: ["16"],
			})
		);
		expect(v2.stakingPoolObjectId).toBe("0x11");
		expect(v2.stakedAmount).toBe(0n);
		expect(v2.rewardCoins).toEqual([
			{
				baseRewardsAccumulated: 13n,
				baseRewardsDebt: 14n,
				multiplierRewardsAccumulated: 15n,
				multiplierRewardsDebt: 16n,
			},
		]);
		expect(v2.version).toBe(2);

		const ownerV1 =
			Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV1(
				objectView("0x9::afterburner_vault::OwnerCap", {
					afterburner_vault_id: "0x12",
				})
			);
		const ownerV2 =
			Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponseV2(
				objectView("0x9::authority::AuthorityCap", { for: "0x13", id: "0x14" })
			);
		expect(ownerV1.stakingPoolId).toBe("0x12");
		expect(ownerV2.stakingPoolId).toBe("0x13");

		const adminV1 =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1(
				objectView("0x9::afterburner_vault::OneTimeAdminCap", {
					afterburner_vault_id: "0x15",
				})
			);
		const adminV2Grpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2(
				objectView("0x9::vault::OneTime", { cap: { for: "0x16" } })
			);
		const adminV2JsonRpc =
			Casting.farms.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2(
				objectView("0x9::vault::OneTime", {
					cap: {
						type: "0x9::authority::AuthorityCap",
						fields: { for: "0x16", id: { id: "0x17" } },
					},
				})
			);
		expect(adminV1.stakingPoolId).toBe("0x15");
		expect(adminV2Grpc.stakingPoolId).toBe("0x16");
		expect(adminV2JsonRpc.stakingPoolId).toBe("0x16");
	});

	it("combines deprecated farm object queries across both protocol versions", async () => {
		const { api, objects } = makeFakeApi();
		const farmsApi = new FarmsApi(api);
		const ownerV1 = { stakingPoolId: "owner-v1" };
		const ownerV2 = { stakingPoolId: "owner-v2" };
		const adminV1 = { stakingPoolId: "admin-v1" };
		const adminV2 = { stakingPoolId: "admin-v2" };
		const positionV1 = { objectId: "position-v1" };
		const positionV2 = { objectId: "position-v2" };
		objects.fetchCastObjectsOwnedByAddressOfType
			.mockResolvedValueOnce([ownerV1])
			.mockResolvedValueOnce([ownerV2])
			.mockResolvedValueOnce([adminV1])
			.mockResolvedValueOnce([adminV2])
			.mockResolvedValueOnce([positionV1])
			.mockResolvedValueOnce([positionV2]);

		expect(
			await farmsApi.fetchOwnedStakingPoolOwnerCaps({ walletAddress: FULL_1 })
		).toEqual([ownerV1, ownerV2]);
		expect(
			await farmsApi.fetchOwnedStakingPoolOneTimeAdminCaps({
				walletAddress: FULL_1,
			})
		).toEqual([adminV1, adminV2]);
		expect(
			await farmsApi.fetchOwnedPartialStakedPositions({ walletAddress: FULL_1 })
		).toEqual([positionV1, positionV2]);
		expect(
			objects.fetchCastObjectsOwnedByAddressOfType
		).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				walletAddress: FULL_1,
				objectType: farmsApi.objectTypes.stakingPoolOwnerCapV1,
			})
		);
		expect(
			objects.fetchCastObjectsOwnedByAddressOfType
		).toHaveBeenNthCalledWith(
			6,
			expect.objectContaining({
				walletAddress: FULL_1,
				objectType: farmsApi.objectTypes.stakedPositionV2,
			})
		);
	});

	it("casts every farm event shape through the V1 and wrapped V2 paths", () => {
		type Case = {
			name: string;
			v1: (event: unknown) => unknown;
			v2?: (event: unknown) => unknown;
			v1UsesWrappedPayload?: boolean;
			v1Fields: Record<string, unknown>;
			v2Fields?: Record<string, unknown>;
			expected: Record<string, unknown>;
		};

		const cases: Case[] = [
			{
				name: "added reward",
				v1: (event) =>
					Casting.farms.addedRewardEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.addedRewardEventFromOnChainV2(event as never),
				v1Fields: {
					vault_id: "0x10",
					reward_type: "2::sui::SUI",
					reward_amount: "11",
				},
				expected: {
					vaultId: "0x10",
					rewardType: `${FULL_2}::sui::SUI`,
					rewardAmount: 11n,
					...eventMeta,
				},
			},
			{
				name: "created vault",
				v1: (event) =>
					Casting.farms.createdVaultEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.createdVaultEventFromOnChainV2(event as never),
				v1Fields: {
					vault_id: "0x11",
					stake_type: "2::sui::SUI",
					min_lock_duration_ms: "12",
					max_lock_duration_ms: "13",
					max_lock_multiplier: "2000000000000000000",
					min_stake_amount: "14",
				},
				expected: {
					vaultId: "0x11",
					stakeType: `${FULL_2}::sui::SUI`,
					minLockDurationMs: 12,
					maxLockDurationMs: 13,
					maxLockMultiplier: 2_000_000_000_000_000_000n,
					minStakeAmount: 14n,
					...eventMeta,
				},
			},
			{
				name: "deposited principal",
				v1: (event) =>
					Casting.farms.depositedPrincipalEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.depositedPrincipalEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x12",
					vault_id: "0x13",
					amount: "15",
					stake_type: "2::sui::SUI",
				},
				expected: {
					stakedPositionId: "0x12",
					vaultId: "0x13",
					amount: 15n,
					stakeType: `${FULL_2}::sui::SUI`,
					...eventMeta,
				},
			},
			{
				name: "destroyed position",
				v1: (event) =>
					Casting.farms.destroyedStakedPositionEventFromOnChainV1(
						event as never
					),
				v2: (event) =>
					Casting.farms.destroyedStakedPositionEventFromOnChainV2(
						event as never
					),
				v1Fields: { staked_position_id: "0x14" },
				expected: { stakedPositionId: "0x14", ...eventMeta },
			},
			{
				name: "harvested rewards",
				v1: (event) =>
					Casting.farms.harvestedRewardsEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.harvestedRewardsEventFromOnChainV2(event as never),
				v1Fields: {
					afterburner_vault_id: "0x15",
					reward_types: ["2::sui::SUI", "3::x::X"],
					reward_amounts: ["16", "17"],
				},
				expected: {
					vaultId: "0x15",
					rewardTypes: [`${FULL_2}::sui::SUI`, `${FULL_3}::x::X`],
					rewardAmounts: [16n, 17n],
					...eventMeta,
				},
			},
			{
				name: "increased emissions",
				v1: (event) =>
					Casting.farms.increasedEmissionsEventFromOnChainV1(event as never),
				v1Fields: {
					vault_id: "0x16",
					reward_type: "2::sui::SUI",
					emission_schedule_ms: "18",
					emission_rate: "19",
				},
				expected: {
					vaultId: "0x16",
					rewardType: `${FULL_2}::sui::SUI`,
					emissionScheduleMs: 18,
					emissionRate: 19n,
					...eventMeta,
				},
			},
			{
				name: "updated emissions",
				v1: (event) =>
					Casting.farms.updatedEmissionsEventFromOnChainV2(event as never),
				v1UsesWrappedPayload: true,
				v1Fields: {
					vault_id: "0x17",
					reward_type: "2::sui::SUI",
					emission_schedule_ms: "20",
					emission_rate: "21",
				},
				expected: {
					vaultId: "0x17",
					rewardType: `${FULL_2}::sui::SUI`,
					emissionScheduleMs: 20,
					emissionRate: 21n,
					...eventMeta,
				},
			},
			{
				name: "initialized reward",
				v1: (event) =>
					Casting.farms.initializedRewardEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.initializedRewardEventFromOnChainV2(event as never),
				v1Fields: {
					vault_id: "0x18",
					reward_type: "2::sui::SUI",
					reward_amount: "22",
					emission_rate: "23",
					emission_start_ms: "24",
				},
				expected: {
					vaultId: "0x18",
					rewardType: `${FULL_2}::sui::SUI`,
					rewardAmount: 22n,
					emissionRate: 23n,
					emissionStartMs: 24,
					...eventMeta,
				},
			},
			{
				name: "joined positions",
				v1: (event) => Casting.farms.joinedEventFromOnChainV1(event as never),
				v2: (event) => Casting.farms.joinedEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x19",
					other_staked_position_id: "0x20",
				},
				expected: {
					stakedPositionId: "0x19",
					otherStakedPositionId: "0x20",
					...eventMeta,
				},
			},
			{
				name: "locked position",
				v1: (event) => Casting.farms.lockedEventFromOnChainV1(event as never),
				v2: (event) => Casting.farms.lockedEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x21",
					vault_id: "0x22",
					staked_type: "2::sui::SUI",
					staked_amount: "25",
					lock_start_timestamp_ms: "26",
					lock_duration_ms: "27",
					lock_multiplier: "28",
				},
				expected: {
					stakedPositionId: "0x21",
					vaultId: "0x22",
					stakedType: `${FULL_2}::sui::SUI`,
					stakedAmount: 25n,
					lockStartTimestampMs: 26,
					lockDurationMs: 27,
					lockMultiplier: 28n,
					...eventMeta,
				},
			},
			{
				name: "split positions",
				v1: (event) => Casting.farms.splitEventFromOnChainV1(event as never),
				v2: (event) => Casting.farms.splitEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x23",
					split_staked_position_id: "0x24",
				},
				expected: {
					stakedPositionId: "0x23",
					splitStakedPositionId: "0x24",
					...eventMeta,
				},
			},
			{
				name: "staked position",
				v1: (event) => Casting.farms.stakedEventFromOnChainV1(event as never),
				v2: (event) => Casting.farms.stakedEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x25",
					vault_id: "0x26",
					staked_type: "2::sui::SUI",
					staked_amount: "29",
					multiplied_staked_amount: "30",
					lock_start_timestamp_ms: "31",
					lock_duration_ms: "32",
					lock_multiplier: "33",
				},
				v2Fields: {
					staked_position_id: "0x25",
					vault_id: "0x26",
					staked_type: "2::sui::SUI",
					staked_amount: "29",
					multiplier_staked_amount: "30",
					lock_start_timestamp_ms: "31",
					lock_duration_ms: "32",
					lock_multiplier: "33",
				},
				expected: {
					stakedPositionId: "0x25",
					vaultId: "0x26",
					stakedType: `${FULL_2}::sui::SUI`,
					stakedAmount: 29n,
					multipliedStakedAmount: 30n,
					lockStartTimestampMs: 31,
					lockDurationMs: 32,
					lockMultiplier: 33n,
					...eventMeta,
				},
			},
			{
				name: "relaxed stake",
				v1: (event) =>
					Casting.farms.stakedRelaxedEventFromOnChainV1(event as never),
				v1Fields: {
					staked_position_id: "0x27",
					vault_id: "0x28",
					staked_type: "2::sui::SUI",
					staked_amount: "34",
					lock_start_timestamp_ms: "35",
					lock_end_timestamp_ms: "36",
				},
				expected: {
					stakedPositionId: "0x27",
					vaultId: "0x28",
					stakedType: `${FULL_2}::sui::SUI`,
					stakedAmount: 34n,
					lockStartTimestampMs: 35,
					lockEndTimestampMs: 36,
					...eventMeta,
				},
			},
			{
				name: "unlocked position",
				v1: (event) => Casting.farms.unlockedEventFromOnChainV1(event as never),
				v2: (event) => Casting.farms.unlockedEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x29",
					vault_id: "0x30",
					staked_type: "2::sui::SUI",
					staked_amount: "37",
				},
				expected: {
					stakedPositionId: "0x29",
					vaultId: "0x30",
					stakedType: `${FULL_2}::sui::SUI`,
					stakedAmount: 37n,
					...eventMeta,
				},
			},
			{
				name: "withdrew principal",
				v1: (event) =>
					Casting.farms.withdrewPrincipalEventFromOnChainV1(event as never),
				v2: (event) =>
					Casting.farms.withdrewPrincipalEventFromOnChainV2(event as never),
				v1Fields: {
					staked_position_id: "0x31",
					vault_id: "0x32",
					amount: "38",
					stake_type: "2::sui::SUI",
				},
				expected: {
					stakedPositionId: "0x31",
					vaultId: "0x32",
					amount: 38n,
					stakeType: `${FULL_2}::sui::SUI`,
					...eventMeta,
				},
			},
		];

		for (const testCase of cases) {
			const v1Input = testCase.v1UsesWrappedPayload
				? eventV2(testCase.v1Fields)
				: eventV1(testCase.v1Fields);
			expect(testCase.v1(v1Input)).toEqual(testCase.expected);
			if (testCase.v2) {
				expect(
					testCase.v2(eventV2(testCase.v2Fields ?? testCase.v1Fields))
				).toEqual(testCase.expected);
			}
		}
	});
});

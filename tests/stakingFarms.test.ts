import { Transaction } from "@mysten/sui/transactions";
import { jest } from "@jest/globals";
import {
	AftermathApi,
	Casting,
	Farms,
	FarmsStakedPosition,
	FarmsStakingPool,
	Staking,
	type FarmsStakedPositionObject,
	type FarmsStakingPoolObject,
	type StakingPosition,
	type SuiObjectView,
} from "../src";
import { FarmsApi } from "../src/packages/farms/api/farmsApi";
import { StakingApi } from "../src/packages/staking/api/stakingApi";
import {
	isSuiDelegatedStake,
	isStakePosition,
	isUnstakePosition,
} from "../src/packages/staking/stakingTypes";

const FULL_1 =
	"0x0000000000000000000000000000000000000000000000000000000000000001";
const FULL_2 =
	"0x0000000000000000000000000000000000000000000000000000000000000002";
const FULL_3 =
	"0x0000000000000000000000000000000000000000000000000000000000000003";
const FULL_4 =
	"0x0000000000000000000000000000000000000000000000000000000000000004";
const FULL_5 =
	"0x0000000000000000000000000000000000000000000000000000000000000005";
const FULL_6 =
	"0x0000000000000000000000000000000000000000000000000000000000000006";
const FULL_9 =
	"0x0000000000000000000000000000000000000000000000000000000000000009";
const FULL_10 =
	"0x000000000000000000000000000000000000000000000000000000000000000a";
const SUI_TYPE = "0x2::sui::SUI";
const NORMALIZED_SUI_TYPE = `${FULL_2}::sui::SUI`;
const FARM_TYPE = "0x9::vault::Vault";
const EVENT_TYPE = "0x9::events::Event";
const API_BASE_URL = "https://sdk.test";

const ADDRESSES = {
	staking: {
		packages: { lsd: "0x101", afsui: "0x102", events: "0x103" },
		objects: {
			stakedSuiVault: "0x111",
			stakedSuiVaultState: "0x112",
			safe: "0x113",
			treasury: "0x114",
			referralVault: "0x115",
			validatorConfigsTable: "0x116",
			aftermathValidator: FULL_4,
		},
	},
	farms: {
		packages: {
			vaults: "0x201",
			vaultsInitial: "0x202",
			vaultsV2: "0x203",
			eventsV2: "0x204",
		},
		objects: { version: "0x205" },
	},
} as const;

type FetchCall = {
	input: RequestInfo | URL;
	init?: RequestInit;
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
	jest.restoreAllMocks();
});

function installFetchQueue(responses: Array<unknown | Response>): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		calls.push({ input, init });
		const response = responses.shift();
		if (response instanceof Response) {
			return response;
		}
		return Response.json(response);
	}) as typeof fetch;
	return calls;
}

function objectView(
	type: string,
	json: Record<string, unknown>,
	objectId = "0x1"
): SuiObjectView {
	return {
		objectId,
		version: "1",
		digest: "digest",
		owner: { AddressOwner: FULL_1 },
		type,
		json,
		display: null,
	} as unknown as SuiObjectView;
}

function moveCalls(tx: Transaction): Array<{
	function: string;
	module: string;
	package: string;
	arguments: unknown[];
}> {
	const data = tx.getData() as {
		commands: Array<{
			MoveCall?: {
				function: string;
				module: string;
				package: string;
				arguments: unknown[];
			};
		}>;
	};
	return data.commands.flatMap((command) =>
		command.MoveCall ? [command.MoveCall] : []
	);
}

function lastMoveCall(tx: Transaction) {
	const calls = moveCalls(tx);
	return calls[calls.length - 1];
}

function makeFakeApi() {
	const coin = {
		fetchCoinWithAmountTx: jest.fn(async ({ tx }: { tx: Transaction }) =>
			tx.object("0x301")
		),
	};
	const referralVault = {
		updateReferrerTx: jest.fn(({ tx }: { tx: Transaction }) => tx),
	};
	const staking = {
		addresses: ADDRESSES.staking,
		stakeTx: jest.fn(),
	};
	const objects = {
		fetchCastObjectsOwnedByAddressOfType: jest.fn<() => Promise<unknown[]>>(),
	};
	const api = {
		addresses: ADDRESSES,
		Coin: jest.fn(() => coin),
		ReferralVault: jest.fn(() => referralVault),
		Staking: jest.fn(() => staking),
		Objects: jest.fn(() => objects),
	};

	return {
		api: api as unknown as AftermathApi,
		coin,
		referralVault,
		staking,
		objects,
	};
}

function makePool(
	overrides: Partial<FarmsStakingPoolObject> = {}
): FarmsStakingPoolObject {
	return {
		objectId: FULL_10,
		objectType: `${FULL_9}::vault::Vault`,
		stakeCoinType: NORMALIZED_SUI_TYPE,
		stakedAmount: 1_000n,
		stakedAmountWithMultiplier: 1_000n,
		minLockDurationMs: 1_000,
		maxLockDurationMs: 5_000,
		maxLockMultiplier: 2_000_000_000_000_000_000n,
		rewardCoins: [
			{
				coinType: SUI_TYPE,
				rewards: 10_000n,
				rewardsAccumulatedPerShare: 0n,
				emissionRate: 100n,
				emissionSchedulesMs: 1_000,
				emissionStartTimestamp: 0,
				lastRewardTimestamp: 0,
				rewardsRemaining: 10_000n,
				actualRewards: 10_000n,
			},
			{
				coinType: "0x3::example::REWARD",
				rewards: 50n,
				rewardsAccumulatedPerShare: 0n,
				emissionRate: 51n,
				emissionSchedulesMs: 1_000,
				emissionStartTimestamp: 0,
				lastRewardTimestamp: 0,
				rewardsRemaining: 50n,
				actualRewards: 50n,
			},
		],
		emissionEndTimestamp: 10_000,
		minStakeAmount: 100n,
		isUnlocked: false,
		lockEnforcement: "Strict",
		version: 2,
		...overrides,
	};
}

function makePosition(
	overrides: Partial<FarmsStakedPositionObject> = {}
): FarmsStakedPositionObject {
	return {
		objectId: FULL_3,
		objectType: `${FULL_9}::staked_position::StakedPosition`,
		stakingPoolObjectId: FULL_10,
		stakeCoinType: NORMALIZED_SUI_TYPE,
		stakedAmount: 100n,
		stakedAmountWithMultiplier: 150n,
		lockStartTimestamp: 1_000,
		lockDurationMs: 2_000,
		lockMultiplier: 1_500_000_000_000_000_000n,
		rewardCoins: [
			{
				coinType: SUI_TYPE,
				baseRewardsAccumulated: 12n,
				baseRewardsDebt: 0n,
				multiplierRewardsAccumulated: 5n,
				multiplierRewardsDebt: 0n,
			},
		],
		lastHarvestRewardsTimestamp: 1_000,
		version: 2,
		...overrides,
	};
}

function eventV1(parsedJson: unknown, type = EVENT_TYPE) {
	return {
		id: { txDigest: "digest-1", eventSeq: "0" },
		packageId: "0x9",
		transactionModule: "events",
		sender: FULL_1,
		type,
		parsedJson,
		bcs: "",
		timestampMs: "1700000000123",
	};
}

function eventV2(parsedJson: unknown, type = EVENT_TYPE) {
	return {
		...eventV1({ pos0: parsedJson }, type),
	};
}

const eventMeta = {
	timestamp: 1_700_000_000_123,
	txnDigest: "digest-1",
	type: EVENT_TYPE,
};

describe("staking and farms casters", () => {
	it("casts staking objects with exact bigint and nested protocol values", () => {
		const validator =
			Casting.staking.validatorOperationCapObjectFromSuiObjectResponse(
				objectView("0x9::validator::Cap", {
					authorizer_validator_address: "0x2",
				})
			);
		expect(validator).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::validator::Cap`,
			authorizerValidatorAddress: FULL_2,
		});

		const state =
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				objectView("0x9::staked_sui_vault::State", {
					active_epoch: "9007199254740993",
					atomic_unstake_sui_reserves: "3000",
					total_rewards_amount: "4000",
					total_sui_amount: "5000",
					protocol_config: {
						atomic_unstake_sui_reserves_target_value: "1000",
						atomic_unstake_protocol_fee: {
							min_fee: "1000000000000000",
							max_fee: "10000000000000000",
						},
					},
				})
			);

		expect(state).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: 1_000n,
			atomicUnstakeSuiReserves: 3_000n,
			minAtomicUnstakeFee: 1_000_000_000_000_000n,
			maxAtomicUnstakeFee: 10_000_000_000_000_000n,
			totalSuiAmount: 5_000n,
			totalRewardsAmount: 4_000n,
			activeEpoch: 9_007_199_254_740_993n,
		});

		const jsonRpcShaped = objectView("0x9::staked_sui_vault::State", {
			active_epoch: "7",
			atomic_unstake_sui_reserves: "8",
			total_rewards_amount: "9",
			total_sui_amount: "10",
			protocol_config: {
				type: "0x9::config::ProtocolConfig",
				fields: {
					atomic_unstake_sui_reserves_target_value: "11",
					atomic_unstake_protocol_fee: {
						type: "0x9::config::AtomicFee",
						fields: { min_fee: "12", max_fee: "13" },
					},
				},
			},
		});
		expect(
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				jsonRpcShaped
			)
		).toEqual({
			objectId: FULL_1,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: 11n,
			atomicUnstakeSuiReserves: 8n,
			minAtomicUnstakeFee: 12n,
			maxAtomicUnstakeFee: 13n,
			totalSuiAmount: 10n,
			totalRewardsAmount: 9n,
			activeEpoch: 7n,
		});

		expect(() =>
			Casting.staking.stakedSuiVaultStateObjectFromSuiObjectResponse(
				objectView("0x9::staked_sui_vault::State", {
					active_epoch: "not-a-number",
					atomic_unstake_sui_reserves: "0",
					total_rewards_amount: "0",
					total_sui_amount: "0",
					protocol_config: {
						atomic_unstake_sui_reserves_target_value: "0",
						atomic_unstake_protocol_fee: { min_fee: "0", max_fee: "0" },
					},
				})
			)
		).toThrow();
	});

	it("casts staking events, including nullable referrers and requested optional fields", () => {
		const staked = Casting.staking.stakedEventFromOnChain(
			eventV1({
				sui_id: "0x2",
				staked_sui_id: "0x3",
				staker: "0x1",
				validator: "0x4",
				epoch: "17",
				sui_amount: "9007199254740993",
				validator_fee: "25000000000000000",
				is_restaked: true,
				referrer: null,
				afsui_id: "0x5",
				afsui_amount: "9007199254740995",
			}) as never
		);
		expect(staked).toEqual({
			suiId: FULL_2,
			stakedSuiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 17n,
			suiStakeAmount: 9_007_199_254_740_993n,
			validatorFee: 0.025,
			isRestaked: true,
			referrer: undefined,
			afSuiId: FULL_5,
			afSuiAmount: 9_007_199_254_740_995n,
			...eventMeta,
		});

		const unstakeRequested = Casting.staking.unstakeRequestedEventFromOnChain(
			eventV1({
				afsui_id: "0x6",
				provided_afsui_amount: "21",
				requester: "0x1",
				epoch: "22",
			}) as never
		);
		expect(unstakeRequested).toEqual({
			afSuiId: FULL_6,
			providedAfSuiAmount: 21n,
			requester: FULL_1,
			epoch: 22n,
			...eventMeta,
		});
		expect("suiId" in unstakeRequested).toBe(false);

		const unstaked = Casting.staking.unstakedEventFromOnChain(
			eventV1({
				afsui_id: "0x6",
				sui_id: "0x7",
				requester: "0x1",
				epoch: "23",
				provided_afsui_amount: "24",
				returned_sui_amount: "25",
			}) as never
		);
		expect(unstaked).toEqual({
			afSuiId: FULL_6,
			suiId:
				"0x0000000000000000000000000000000000000000000000000000000000000007",
			requester: FULL_1,
			epoch: 23n,
			providedAfSuiAmount: 24n,
			returnedSuiAmount: 25n,
			...eventMeta,
		});
	});

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

describe("staking type guards and state transitions", () => {
	it("distinguishes native delegated stakes, stake positions, and unstake positions", () => {
		const delegated = {
			status: "Active" as const,
			stakedSuiId: FULL_2,
			stakeRequestEpoch: 1n,
			stakeActiveEpoch: 2n,
			principal: 3n,
			validatorAddress: FULL_3,
			stakingPool: FULL_4,
		};
		const stake = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 4n,
			suiStakeAmount: 5n,
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: 6n,
			timestamp: 7,
			txnDigest: "digest-stake",
		};
		const request = {
			state: "REQUEST" as const,
			afSuiId: FULL_5,
			providedAfSuiAmount: 8n,
			requester: FULL_1,
			epoch: 9n,
			timestamp: 10,
			txnDigest: "digest-request",
		};

		expect(isSuiDelegatedStake(delegated as never)).toBe(true);
		expect(isSuiDelegatedStake(stake as never)).toBe(false);
		expect(isStakePosition(stake as never)).toBe(true);
		expect(isUnstakePosition(request as never)).toBe(true);
	});

	it("maps staking and unstaking events while retaining event ordering and epoch state", () => {
		const stake: StakingPosition = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: 4n,
			suiStakeAmount: 5n,
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: 6n,
			timestamp: 100,
			txnDigest: "stake-digest",
		};
		const request: StakingPosition = {
			state: "REQUEST",
			afSuiId: FULL_6,
			providedAfSuiAmount: 10n,
			requester: FULL_1,
			epoch: 8n,
			timestamp: 200,
			txnDigest: "request-digest",
		};
		const finalizedEvent = {
			afSuiId: FULL_6,
			providedAfSuiAmount: 11n,
			suiId: FULL_2,
			returnedSuiAmount: 12n,
			requester: FULL_1,
			epoch: 99n,
			timestamp: 300,
			txnDigest: "finalized-digest",
			type: "0x9::events::UnstakedEvent",
		};

		const updated = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [stake, request],
			event: finalizedEvent,
		});

		expect(updated).toEqual([
			{
				...finalizedEvent,
				state: "SUI_MINTED",
				epoch: 8n,
			},
			stake,
		]);

		const inserted = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [],
			event: {
				...finalizedEvent,
				afSuiId: FULL_3,
				timestamp: undefined,
			},
		});
		expect(inserted).toEqual([
			{
				...finalizedEvent,
				afSuiId: FULL_3,
				state: "SUI_MINTED",
				timestamp: undefined,
			},
		]);

		const requestInserted = StakingApi.updateStakingPositionsFromEvent({
			stakingPositions: [],
			event: {
				...request,
				timestamp: 400,
				type: "0x9::events::UnstakeRequestedEvent",
			},
		});
		expect(requestInserted[0]).toEqual({
			...request,
			timestamp: 400,
			type: "0x9::events::UnstakeRequestedEvent",
			state: "REQUEST",
		});
	});
});

describe("staking HTTP facade", () => {
	it("forwards endpoint bodies and restores bigint/optional response values", async () => {
		const positionPayload = {
			stakedSuiId: FULL_2,
			suiId: FULL_3,
			staker: FULL_1,
			validatorAddress: FULL_4,
			epoch: "17n",
			suiStakeAmount: "9007199254740993n",
			validatorFee: 0.01,
			isRestaked: false,
			afSuiId: FULL_5,
			afSuiAmount: "19n",
			timestamp: 20,
			txnDigest: "position-digest",
			type: "0x9::events::StakedEvent",
		};
		const delegatedPayload = {
			status: "Active",
			stakedSuiId: FULL_2,
			stakeRequestEpoch: "21n",
			stakeActiveEpoch: "22n",
			principal: "23n",
			validatorAddress: FULL_4,
			stakingPool: FULL_6,
		};
		const vaultPayload = {
			objectId: FULL_10,
			objectType: `${FULL_9}::staked_sui_vault::State`,
			atomicUnstakeSuiReservesTargetValue: "24n",
			atomicUnstakeSuiReserves: "25n",
			minAtomicUnstakeFee: "26n",
			maxAtomicUnstakeFee: "27n",
			totalRewardsAmount: "28n",
			totalSuiAmount: "29n",
			activeEpoch: "30n",
		};
		const responses = [
			[{ suiAddress: FULL_4 }],
			{ [FULL_4]: 0.04 },
			[{ objectId: FULL_2, objectType: `${FULL_9}::validator::Config` }],
			[positionPayload],
			[delegatedPayload],
			[{ objectId: FULL_3, objectType: `${FULL_9}::validator::Cap` }],
			123,
			1.05,
			vaultPayload,
			0.045,
			[{ timestamp: 31, apy: 0.05 }],
		];
		const calls = installFetchQueue(responses);
		const staking = new Staking({ baseUrl: API_BASE_URL });

		expect(await staking.getActiveValidators()).toEqual([
			{ suiAddress: FULL_4 },
		]);
		expect(await staking.getValidatorApys()).toEqual({ [FULL_4]: 0.04 });
		expect(await staking.getValidatorConfigs()).toEqual([
			{ objectId: FULL_2, objectType: `${FULL_9}::validator::Config` },
		]);
		const positions = await staking.getStakingPositions({
			walletAddress: FULL_1,
			cursor: 2,
			limit: 1,
		});
		expect(
			(positions[0] as { suiStakeAmount?: bigint } | undefined)?.suiStakeAmount
		).toBe(9_007_199_254_740_993n);
		expect(await staking.getDelegatedStakes({ walletAddress: FULL_1 })).toEqual(
			[
				{
					...delegatedPayload,
					stakeRequestEpoch: 21n,
					stakeActiveEpoch: 22n,
					principal: 23n,
				},
			]
		);
		expect(
			await staking.getValidatorOperationCaps({ walletAddress: FULL_1 })
		).toEqual([{ objectId: FULL_3, objectType: `${FULL_9}::validator::Cap` }]);
		expect(await staking.getSuiTvl()).toBe(123);
		expect(await staking.getAfSuiToSuiExchangeRate()).toBe(1.05);
		expect(await staking.getStakedSuiVaultState()).toEqual({
			...vaultPayload,
			atomicUnstakeSuiReservesTargetValue: 24n,
			atomicUnstakeSuiReserves: 25n,
			minAtomicUnstakeFee: 26n,
			maxAtomicUnstakeFee: 27n,
			totalRewardsAmount: 28n,
			totalSuiAmount: 29n,
			activeEpoch: 30n,
		});
		expect(await staking.getApy()).toBe(0.045);
		expect(await staking.getHistoricalApy({ timeframe: "1W" })).toEqual([
			{ timestamp: 31, apy: 0.05 },
		]);

		expect(calls).toHaveLength(11);
		expect(String(calls[0]?.input)).toBe(
			`${API_BASE_URL}/api/staking/active-validators`
		);
		expect(String(calls[3]?.input)).toBe(
			`${API_BASE_URL}/api/staking/staking-positions`
		);
		expect(calls[3]?.init?.method).toBe("POST");
		expect(JSON.parse(calls[3]?.init?.body as string)).toEqual({
			walletAddress: FULL_1,
			cursor: 2,
			limit: 1,
		});
	});

	it("classifies a deterministic HTTP failure at the provider boundary", async () => {
		installFetchQueue([
			new Response("temporarily unavailable", {
				status: 429,
				statusText: "Too Many Requests",
				headers: { "Retry-After": "3" },
			}),
		]);
		const staking = new Staking({ baseUrl: API_BASE_URL });

		await expect(staking.getApy()).rejects.toMatchObject({
			kind: "http",
			status: 429,
			retryAfterMs: 3_000,
		});
	});
});

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

describe("staking and farm calculations", () => {
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
		expect(pool.calcMultiplier({ lockDurationMs: 3_000 })).toBe(
			1_500_000_000_000_000_000n
		);
		expect(pool.calcMultiplier({ lockDurationMs: 9_000 })).toBe(
			2_000_000_000_000_000_000n
		);

		jest.spyOn(Date, "now").mockReturnValue(2_000);
		expect(pool.maxLockDurationMs()).toBe(5_000);
		jest.spyOn(Date, "now").mockReturnValue(11_000);
		expect(pool.maxLockDurationMs()).toBe(0);

		const degenerate = new FarmsStakingPool(
			makePool({ minLockDurationMs: 4_000, maxLockDurationMs: 4_000 })
		);
		expect(degenerate.calcMultiplier({ lockDurationMs: 4_000 })).toBe(
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
						emissionSchedulesMs: 1_000,
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
						emissionSchedulesMs: 1_000,
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
						emissionSchedulesMs: 1_000,
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
						emissionSchedulesMs: 1_000,
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
		expect(position.unlockTimestamp()).toBe(3_000);
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

		jest.spyOn(Date, "now").mockReturnValue(2_500);
		expect(position.isLocked({ stakingPool: pool })).toBe(true);
		expect(position.isStrictlyLocked({ stakingPool: pool })).toBe(true);
		expect(position.isRelaxedLocked({ stakingPool: pool })).toBe(false);
		jest.spyOn(Date, "now").mockReturnValue(3_000);
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
				lockDurationMs: 9_000,
				lockMultiplier: 3_000_000_000_000_000_000n,
			})
		);
		jest.spyOn(Date, "now").mockReturnValue(2_000);

		position.updatePosition({ stakingPool: pool });

		expect(position.stakedPosition.lockDurationMs).toBe(5_000);
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
		expect(position.stakedPosition.lastHarvestRewardsTimestamp).toBe(2_000);

		const relaxedPool = new FarmsStakingPool(
			makePool({ lockEnforcement: "Relaxed" })
		);
		expect(position.isRelaxedLocked({ stakingPool: relaxedPool })).toBe(true);
		expect(position.isStrictlyLocked({ stakingPool: relaxedPool })).toBe(false);
		const endedPool = new FarmsStakingPool(
			makePool({ emissionEndTimestamp: 1_000 })
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

describe("staking transaction commands and builders", () => {
	it("selects staking Move entry points and preserves builder options", async () => {
		const { api, coin, referralVault } = makeFakeApi();
		const stakingApi = new StakingApi(api);

		const lowLevelCases: Array<{
			name: string;
			expectedFunction: string;
			invoke: (tx: Transaction) => unknown;
		}> = [
			{
				name: "stake",
				expectedFunction: "request_stake_and_keep",
				invoke: (tx) =>
					stakingApi.stakeTx({
						tx,
						suiCoin: "0x301",
						validatorAddress: FULL_4,
						withTransfer: true,
					}),
			},
			{
				name: "unstake",
				expectedFunction: "request_unstake",
				invoke: (tx) => stakingApi.unstakeTx({ tx, afSuiCoin: "0x302" }),
			},
			{
				name: "atomic unstake",
				expectedFunction: "request_unstake_atomic_and_keep",
				invoke: (tx) =>
					stakingApi.atomicUnstakeTx({
						tx,
						afSuiCoin: "0x303",
						withTransfer: true,
					}),
			},
			{
				name: "restake staked SUI",
				expectedFunction: "request_stake_staked_sui_vec",
				invoke: (tx) =>
					stakingApi.requestStakeStakedSuiVecTx({
						tx,
						stakedSuiIds: ["0x304", "0x305"],
						validatorAddress: FULL_4,
					}),
			},
			{
				name: "epoch update",
				expectedFunction: "epoch_was_changed",
				invoke: (tx) => stakingApi.epochWasChangedTx({ tx }),
			},
			{
				name: "exchange rate",
				expectedFunction: "afsui_to_sui_exchange_rate",
				invoke: (tx) => stakingApi.afSuiToSuiExchangeRateTx({ tx }),
			},
			{
				name: "reverse exchange rate",
				expectedFunction: "sui_to_afsui_exchange_rate",
				invoke: (tx) => stakingApi.suiToAfSuiExchangeRateTx({ tx }),
			},
			{
				name: "total SUI amount",
				expectedFunction: "total_sui_amount",
				invoke: (tx) => stakingApi.totalSuiAmountTx({ tx }),
			},
			{
				name: "afSUI conversion",
				expectedFunction: "afsui_to_sui",
				invoke: (tx) => stakingApi.afSuiToSuiTx({ tx, afSuiAmount: 305n }),
			},
			{
				name: "conversion",
				expectedFunction: "sui_to_afsui",
				invoke: (tx) => stakingApi.suiToAfSuiTx({ tx, suiAmount: 306n }),
			},
			{
				name: "validator fee",
				expectedFunction: "update_validator_fee",
				invoke: (tx) =>
					stakingApi.updateValidatorFeeTx({
						tx,
						validatorOperationCapId: "0x307",
						newFee: 308n,
					}),
			},
		];

		for (const testCase of lowLevelCases) {
			const tx = new Transaction();
			testCase.invoke(tx);
			expect(moveCalls(tx)[moveCalls(tx).length - 1]?.function).toBe(
				testCase.expectedFunction
			);
		}

		const stakeTx = await stakingApi.fetchBuildStakeTx({
			walletAddress: FULL_1,
			suiStakeAmount: 1_000n,
			validatorAddress: FULL_4,
			referrer: FULL_3,
			externalFee: { recipient: FULL_2, feePercentage: 0.1 },
			isSponsoredTx: true,
		});
		expect(stakeTx.getData().sender).toBe(FULL_1);
		expect(moveCalls(stakeTx).map((call) => call.function)).toContain(
			"request_stake"
		);
		expect(referralVault.updateReferrerTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			referrer: FULL_3,
		});
		expect(coin.fetchCoinWithAmountTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			walletAddress: FULL_1,
			coinType: expect.any(String),
			coinAmount: 1_000n,
			isSponsoredTx: true,
		});

		const atomicUnstake = await stakingApi.fetchBuildUnstakeTx({
			walletAddress: FULL_1,
			afSuiUnstakeAmount: 1_000n,
			isAtomic: true,
		});
		expect(moveCalls(atomicUnstake).map((call) => call.function)).toContain(
			"request_unstake_atomic"
		);
		const queuedUnstake = await stakingApi.fetchBuildUnstakeTx({
			walletAddress: FULL_1,
			afSuiUnstakeAmount: 1_000n,
			isAtomic: false,
		});
		expect(moveCalls(queuedUnstake).map((call) => call.function)).toContain(
			"request_unstake"
		);
		const restake = await stakingApi.fetchBuildStakeStakedSuiTx({
			walletAddress: FULL_1,
			stakedSuiIds: ["0x309", "0x30a"],
			validatorAddress: FULL_4,
			referrer: FULL_3,
		});
		expect(moveCalls(restake).map((call) => call.function)).toContain(
			"request_stake_staked_sui_vec"
		);
		expect(referralVault.updateReferrerTx).toHaveBeenCalledWith({
			tx: expect.any(Transaction),
			referrer: FULL_3,
		});

		const updateFee = await stakingApi.buildUpdateValidatorFeeTx({
			walletAddress: FULL_1,
			validatorOperationCapId: "0x308",
			newFeePercentage: 0.0375,
		});
		expect(updateFee.getData().sender).toBe(FULL_1);
		expect(
			moveCalls(updateFee)[moveCalls(updateFee).length - 1]?.function
		).toBe("update_validator_fee");
	});

	it("rejects invalid external fee percentages before touching the coin boundary", async () => {
		const { api, coin } = makeFakeApi();
		const stakingApi = new StakingApi(api);
		const base = {
			walletAddress: FULL_1,
			suiStakeAmount: 1_000n,
			validatorAddress: FULL_4,
		};

		await expect(
			stakingApi.fetchBuildStakeTx({
				...base,
				externalFee: { recipient: FULL_2, feePercentage: 0.5 },
			})
		).rejects.toThrow("external fee percentage exceeds max of 50%");
		await expect(
			stakingApi.fetchBuildStakeTx({
				...base,
				externalFee: { recipient: FULL_2, feePercentage: 0 },
			})
		).rejects.toThrow("external fee percentage must be greater than 0");
		expect(coin.fetchCoinWithAmountTx).not.toHaveBeenCalled();
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
						maxLockDurationMs: 1_000,
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
						maxLockDurationMs: 1_000,
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
			maxLockDurationMs: 1_000,
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

describe("high-level staking and farms transaction facades", () => {
	it("delegates staking transaction methods and preserves the provider error", async () => {
		const provider = {
			fetchBuildStakeTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("stake-tx"),
			fetchBuildUnstakeTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("unstake-tx"),
			fetchBuildStakeStakedSuiTx: jest
				.fn<() => Promise<string>>()
				.mockResolvedValue("restake-tx"),
			buildUpdateValidatorFeeTx: jest
				.fn<() => string>()
				.mockReturnValue("fee-tx"),
			buildEpochWasChangedTx: jest
				.fn<() => string>()
				.mockReturnValue("crank-tx"),
		};
		const api = {
			Staking: jest.fn(() => provider),
		} as unknown as AftermathApi;
		const staking = new Staking({}, api);
		const stakeInputs = {
			walletAddress: FULL_1,
			suiStakeAmount: 1n,
			validatorAddress: FULL_4,
		};

		expect(await staking.getStakeTransaction(stakeInputs)).toBe("stake-tx");
		expect(
			await staking.getUnstakeTransaction({
				walletAddress: FULL_1,
				afSuiUnstakeAmount: 2n,
				isAtomic: false,
			})
		).toBe("unstake-tx");
		expect(
			await staking.getStakeStakedSuiTransaction({
				walletAddress: FULL_1,
				stakedSuiIds: [FULL_2],
				validatorAddress: FULL_4,
			})
		).toBe("restake-tx");
		expect(
			staking.getUpdateValidatorFeeTransaction({
				walletAddress: FULL_1,
				validatorOperationCapId: FULL_2,
				newFeePercentage: 0.01,
			})
		).toBe("fee-tx");
		expect(staking.getCrankAfSuiTransaction({ walletAddress: FULL_1 })).toBe(
			"crank-tx"
		);
		expect(provider.fetchBuildStakeTx).toHaveBeenCalledWith(stakeInputs);

		await expect(
			new Staking().getStakeTransaction(stakeInputs)
		).rejects.toThrow("missing AftermathApi instance");
	});

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
			minLockDurationMs: 1_000,
			maxLockDurationMs: 5_000,
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
				emissionScheduleMs: 1_000,
				emissionRate: 9n,
				emissionDelayTimestampMs: 2_000,
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

	it("exposes facade constants as stable protocol boundaries", () => {
		expect(Staking.constants.bounds.minStake).toBe(1_000_000_000n);
		expect(Staking.constants.bounds.minUnstake).toBe(1_000_000_000n);
		expect(Staking.constants.bounds.maxExternalFeePercentage).toBe(0.5);
		expect(Farms.constants.minRewardsToClaim).toBe(10n);
		expect(Farms.constants.maxLockMultiplier).toBe(2);
	});
});

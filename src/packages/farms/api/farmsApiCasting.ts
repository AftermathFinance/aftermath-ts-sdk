import {
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	AddedRewardEventOnChain,
	AfterburnerVaultFieldsOnChain,
	CreatedVaultEventOnChain,
	DepositedPrincipalEventOnChain,
	DestroyedStakedPositionEventOnChain,
	HarvestedRewardsEventOnChain,
	IncreasedEmissionsEventOnChain,
	InitializedRewardEventOnChain,
	JoinedEventOnChain,
	LockedEventOnChain,
	SplitEventOnChain,
	StakedEventOnChain,
	StakedEventRelaxedOnChain,
	StakedPositionFieldsOnChain,
	UnlockedEventOnChain,
	VaultRegistryFieldsOnChain,
	WithdrewPrincipalEventOnChain,
} from "./farmsApiCastingTypes";
import {
	FarmsAddedRewardEvent,
	FarmsCreatedVaultEvent,
	FarmsDepositedPrincipalEvent,
	FarmsDestroyedStakedPositionEvent,
	FarmsStakedPositionObject,
	FarmsStakingPoolObject,
	FarmsHarvestedRewardsEvent,
	FarmsIncreasedEmissionsEvent,
	FarmsInitializedRewardEvent,
	FarmsJoinedEvent,
	FarmsLockedEvent,
	FarmsSplitEvent,
	FarmsStakedEvent,
	FarmsStakedEventRelaxed,
	FarmsUnlockedEvent,
	FarmsWithdrewPrincipalEvent,
} from "../farmsTypes";
import { Coin } from "../..";
import { Helpers } from "../../../general/utils";

export class FarmsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static stakingPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): FarmsStakingPoolObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(data) as AfterburnerVaultFieldsOnChain;
		const stakeCoinType = Helpers.addLeadingZeroesToType(
			new Coin(objectType).innerCoinType
		);

		return {
			objectType,
			objectId: getObjectId(data),
			stakeCoinType,
			rewardCoins: fields.type_names.map((coinType, index) => ({
				coinType: Helpers.addLeadingZeroesToType("0x" + coinType),
				rewards: BigInt(fields.rewards[index]),
				rewardsAccumulatedPerShare: BigInt(
					fields.rewards_accumulated_per_share[index]
				),
				emissionRateMs: Number(fields.emission_rates[index]),
				emissionSchedulesMs: Number(
					fields.emission_schedules_ms[index]
				),
				emissionStartTimestamp: Number(
					fields.emission_start_timestamps_ms[index]
				),
				emissionEndTimestamp: Number(
					fields.emission_end_timestamp_ms[index]
				),
				lastRewardTimestamp: Number(
					fields.last_reward_timestamps_ms[index]
				),
			})),
			stakedAmount: BigInt(fields.total_staked_amount),
			stakedAmountWithMultiplier: BigInt(
				fields.total_staked_amount_with_multiplier
			),
			minLockDurationMs: Number(fields.min_lock_duration_ms),
			maxLockDurationMs: Number(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			lockEnforcement:
				BigInt(fields.lock_enforcement) == BigInt(0)
					? "Strict"
					: "Relaxed",
		};
	};

	public static stakedPositionObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): FarmsStakedPositionObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(data) as StakedPositionFieldsOnChain;
		const stakeCoinType = new Coin(objectType).innerCoinType;

		return {
			objectType,
			objectId: getObjectId(data),
			stakeCoinType,
			stakingPoolObjectId: fields.afterburner_vault_id,
			stakedAmount: BigInt(fields.balance),
			stakedAmountWithMultiplier: BigInt(fields.multiplier_staked_amount),
			lockStartTimestamp: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			lastHarvestRewardsTimestamp: Number(
				fields.last_reward_timestamp_ms
			),
			rewardCoins: fields.base_rewards_accumulated.map(
				(baseRewardsAccumulated, index) => ({
					coinType: "TODO",
					baseRewardsAccumulated: BigInt(baseRewardsAccumulated),
					baseRewardsDebt: BigInt(fields.base_rewards_debt[index]),
					multiplierRewardsAccumulated: BigInt(
						fields.multiplier_rewards_accumulated[index]
					),
					multiplierRewardsDebt: BigInt(
						fields.multiplier_rewards_debt[index]
					),
				})
			),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static addedRewardEventFromOnChain = (
		eventOnChain: AddedRewardEventOnChain
	): FarmsAddedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: fields.reward_type,
			rewardAmount: BigInt(fields.reward_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static createdVaultEventFromOnChain = (
		eventOnChain: CreatedVaultEventOnChain
	): FarmsCreatedVaultEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			stakeType: fields.stake_type,
			minLockDurationMs: Number(fields.min_lock_duration_ms),
			maxLockDurationMs: Number(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static depositedPrincipalEventFromOnChain = (
		eventOnChain: DepositedPrincipalEventOnChain
	): FarmsDepositedPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			amount: BigInt(fields.amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static destroyedStakedPositionEventFromOnChain = (
		eventOnChain: DestroyedStakedPositionEventOnChain
	): FarmsDestroyedStakedPositionEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static harvestedRewardsEventFromOnChain = (
		eventOnChain: HarvestedRewardsEventOnChain
	): FarmsHarvestedRewardsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afterburnerVaultId: fields.afterburner_vault_id,
			rewardTypes: fields.reward_types,
			rewardAmounts: fields.reward_amounts.map((amount) =>
				BigInt(amount)
			),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static increasedEmissionsEventFromOnChain = (
		eventOnChain: IncreasedEmissionsEventOnChain
	): FarmsIncreasedEmissionsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: fields.reward_type,
			emissionScheduleMs: Number(fields.emission_schedule_ms),
			emissionRate: BigInt(fields.emission_rate),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static initializedRewardEventFromOnChain = (
		eventOnChain: InitializedRewardEventOnChain
	): FarmsInitializedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: fields.reward_type,
			rewardAmount: BigInt(fields.reward_amount),
			emissionRateMs: Number(fields.emission_rate_ms),
			emissionStartMs: Number(fields.emission_start_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static joinedEventFromOnChain = (
		eventOnChain: JoinedEventOnChain
	): FarmsJoinedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			otherStakedPositionId: fields.other_staked_position_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static lockedEventFromOnChain = (
		eventOnChain: LockedEventOnChain
	): FarmsLockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static splitEventFromOnChain = (
		eventOnChain: SplitEventOnChain
	): FarmsSplitEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			splitStakedPositionId: fields.split_staked_position_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedEventFromOnChain = (
		eventOnChain: StakedEventOnChain
	): FarmsStakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: fields.staked_type,
			stakedAmount: BigInt(fields.staked_amount),
			multipliedStakedAmount: BigInt(fields.multiplied_staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedEventRelaxedFromOnChain = (
		eventOnChain: StakedEventRelaxedOnChain
	): FarmsStakedEventRelaxed => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: fields.staked_type,
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockEndTimestampMs: Number(fields.lock_end_timestamp_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unlockedEventFromOnChain = (
		eventOnChain: UnlockedEventOnChain
	): FarmsUnlockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static withdrewPrincipalEventFromOnChain = (
		eventOnChain: WithdrewPrincipalEventOnChain
	): FarmsWithdrewPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			amount: BigInt(fields.amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

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
	HarvestedRewardsEventMetadataOnChain,
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
	AddedRewardEvent,
	CreatedVaultEvent,
	DepositedPrincipalEvent,
	DestroyedStakedPositionEvent,
	FarmsStakedPositionObject,
	FarmsStakingPoolObject,
	HarvestedRewardsEvent,
	HarvestedRewardsEventMetadata,
	IncreasedEmissionsEvent,
	InitializedRewardEvent,
	JoinedEvent,
	LockedEvent,
	SplitEvent,
	StakedEvent,
	StakedEventRelaxed,
	UnlockedEvent,
	WithdrewPrincipalEvent,
} from "../farmsTypes";
import { Coin } from "../..";

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
		const stakeCoinType = new Coin(objectType).innerCoinType;

		return {
			objectType,
			objectId: getObjectId(data),
			stakeCoinType,
			rewardCoins: fields.type_names.map((coinType, index) => ({
				coinType,
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
	): AddedRewardEvent => {
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
	): CreatedVaultEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			stakeType: fields.stake_type,
			minLockDurationMs: BigInt(fields.min_lock_duration_ms),
			maxLockDurationMs: BigInt(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static depositedPrincipalEventFromOnChain = (
		eventOnChain: DepositedPrincipalEventOnChain
	): DepositedPrincipalEvent => {
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
	): DestroyedStakedPositionEvent => {
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
	): HarvestedRewardsEvent => {
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

	public static harvestedRewardsEventMetadataFromOnChain = (
		eventOnChain: HarvestedRewardsEventMetadataOnChain
	): HarvestedRewardsEventMetadata => {
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
	): IncreasedEmissionsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: fields.reward_type,
			emissionScheduleMs: BigInt(fields.emission_schedule_ms),
			emissionRate: BigInt(fields.emission_rate),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static initializedRewardEventFromOnChain = (
		eventOnChain: InitializedRewardEventOnChain
	): InitializedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: fields.reward_type,
			rewardAmount: BigInt(fields.reward_amount),
			emissionRateMs: BigInt(fields.emission_rate_ms),
			emissionStartMs: BigInt(fields.emission_start_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static joinedEventFromOnChain = (
		eventOnChain: JoinedEventOnChain
	): JoinedEvent => {
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
	): LockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			lockStartTimestampMs: BigInt(fields.lock_start_timestamp_ms),
			lockDurationMs: BigInt(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static splitEventFromOnChain = (
		eventOnChain: SplitEventOnChain
	): SplitEvent => {
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
	): StakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: fields.staked_type,
			stakedAmount: BigInt(fields.staked_amount),
			multipliedStakedAmount: BigInt(fields.multiplied_staked_amount),
			lockStartTimestampMs: BigInt(fields.lock_start_timestamp_ms),
			lockDurationMs: BigInt(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedEventRelaxedFromOnChain = (
		eventOnChain: StakedEventRelaxedOnChain
	): StakedEventRelaxed => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: fields.staked_type,
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: BigInt(fields.lock_start_timestamp_ms),
			lockEndTimestampMs: BigInt(fields.lock_end_timestamp_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unlockedEventFromOnChain = (
		eventOnChain: UnlockedEventOnChain
	): UnlockedEvent => {
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
	): WithdrewPrincipalEvent => {
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

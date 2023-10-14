import {
	FarmsAddedRewardEventOnChain,
	FarmsAfterburnerVaultFieldsOnChain,
	FarmsCreatedVaultEventOnChain,
	FarmsDepositedPrincipalEventOnChain,
	FarmsDestroyedStakedPositionEventOnChain,
	FarmsHarvestedRewardsEventOnChain,
	FarmsIncreasedEmissionsEventOnChain,
	FarmsInitializedRewardEventOnChain,
	FarmsJoinedEventOnChain,
	FarmsLockedEventOnChain,
	FarmsSplitEventOnChain,
	FarmsStakedEventOnChain,
	FarmsStakedRelaxedEventOnChain,
	FarmsStakedPositionFieldsOnChain,
	FarmsStakingPoolOwnerCapFieldsOnChain,
	FarmsUnlockedEventOnChain,
	FarmsWithdrewPrincipalEventOnChain,
	FarmsStakingPoolOneTimeAdminCapFieldsOnChain,
} from "./farmsApiCastingTypes";
import {
	FarmsAddedRewardEvent,
	FarmsCreatedVaultEvent,
	FarmsDepositedPrincipalEvent,
	FarmsDestroyedStakedPositionEvent,
	FarmsStakingPoolObject,
	FarmsHarvestedRewardsEvent,
	FarmsIncreasedEmissionsEvent,
	FarmsInitializedRewardEvent,
	FarmsJoinedEvent,
	FarmsLockedEvent,
	FarmsSplitEvent,
	FarmsStakedEvent,
	FarmsStakedRelaxedEvent,
	FarmsUnlockedEvent,
	FarmsWithdrewPrincipalEvent,
	StakingPoolOwnerCapObject,
	PartialFarmsStakedPositionObject,
	StakingPoolOneTimeAdminCapObject,
} from "../farmsTypes";
import { Coin } from "../../coin/coin";
import { Helpers } from "../../../general/utils";
import { SuiObjectResponse } from "@mysten/sui.js/client";

export class FarmsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static partialStakingPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): Omit<FarmsStakingPoolObject, "isUnlocked"> => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsAfterburnerVaultFieldsOnChain;
		const stakeCoinType = Helpers.addLeadingZeroesToType(
			new Coin(objectType).innerCoinType
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakeCoinType,
			rewardCoins: fields.type_names.map((coinType, index) => ({
				coinType: Helpers.addLeadingZeroesToType("0x" + coinType),
				rewards: BigInt(fields.rewards[index]),
				rewardsAccumulatedPerShare: BigInt(
					fields.rewards_accumulated_per_share[index]
				),
				emissionRate: BigInt(fields.emission_rates[index]),
				emissionSchedulesMs: Number(
					fields.emission_schedules_ms[index]
				),
				emissionStartTimestamp: Number(
					fields.emission_start_timestamps_ms[index]
				),

				lastRewardTimestamp: Number(
					fields.last_reward_timestamps_ms[index]
				),

				// TODO: make this type prettier
				rewardsRemaining: BigInt(0),
			})),
			emissionEndTimestamp: Number(fields.emission_end_timestamp_ms),
			stakedAmount: BigInt(fields.total_staked_amount),
			stakedAmountWithMultiplier: BigInt(
				fields.total_staked_amount_with_multiplier
			),
			minLockDurationMs: Number(fields.min_lock_duration_ms),
			maxLockDurationMs: Number(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			lockEnforcement:
				BigInt(fields.lock_enforcement) === BigInt(0)
					? "Strict"
					: "Relaxed",
		};
	};

	public static partialStakedPositionObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PartialFarmsStakedPositionObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakedPositionFieldsOnChain;
		const stakeCoinType = Helpers.addLeadingZeroesToType(
			new Coin(objectType).innerCoinType
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
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

	public static stakingPoolOwnerCapObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakingPoolOwnerCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOwnerCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.afterburner_vault_id,
		};
	};

	public static stakingPoolOneTimeAdminCapObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakingPoolOneTimeAdminCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOneTimeAdminCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.afterburner_vault_id,
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static addedRewardEventFromOnChain = (
		eventOnChain: FarmsAddedRewardEventOnChain
	): FarmsAddedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(
				"0x" + fields.reward_type
			),
			rewardAmount: BigInt(fields.reward_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static createdVaultEventFromOnChain = (
		eventOnChain: FarmsCreatedVaultEventOnChain
	): FarmsCreatedVaultEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			stakeType: Helpers.addLeadingZeroesToType("0x" + fields.stake_type),
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
		eventOnChain: FarmsDepositedPrincipalEventOnChain
	): FarmsDepositedPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType("0x" + fields.stake_type),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static destroyedStakedPositionEventFromOnChain = (
		eventOnChain: FarmsDestroyedStakedPositionEventOnChain
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
		eventOnChain: FarmsHarvestedRewardsEventOnChain
	): FarmsHarvestedRewardsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.afterburner_vault_id,
			rewardTypes: fields.reward_types.map((rewardType) =>
				Helpers.addLeadingZeroesToType("0x" + rewardType)
			),
			rewardAmounts: fields.reward_amounts.map((amount) =>
				BigInt(amount)
			),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static increasedEmissionsEventFromOnChain = (
		eventOnChain: FarmsIncreasedEmissionsEventOnChain
	): FarmsIncreasedEmissionsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(
				"0x" + fields.reward_type
			),
			emissionScheduleMs: Number(fields.emission_schedule_ms),
			emissionRate: BigInt(fields.emission_rate),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static initializedRewardEventFromOnChain = (
		eventOnChain: FarmsInitializedRewardEventOnChain
	): FarmsInitializedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(
				"0x" + fields.reward_type
			),
			rewardAmount: BigInt(fields.reward_amount),
			emissionRate: BigInt(fields.emission_rate),
			emissionStartMs: Number(fields.emission_start_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static joinedEventFromOnChain = (
		eventOnChain: FarmsJoinedEventOnChain
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
		eventOnChain: FarmsLockedEventOnChain
	): FarmsLockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(
				"0x" + fields.staked_type
			),
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static splitEventFromOnChain = (
		eventOnChain: FarmsSplitEventOnChain
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
		eventOnChain: FarmsStakedEventOnChain
	): FarmsStakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(
				"0x" + fields.staked_type
			),
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

	public static stakedRelaxedEventFromOnChain = (
		eventOnChain: FarmsStakedRelaxedEventOnChain
	): FarmsStakedRelaxedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(
				"0x" + fields.staked_type
			),
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockEndTimestampMs: Number(fields.lock_end_timestamp_ms),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unlockedEventFromOnChain = (
		eventOnChain: FarmsUnlockedEventOnChain
	): FarmsUnlockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(
				"0x" + fields.staked_type
			),
			stakedAmount: BigInt(fields.staked_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static withdrewPrincipalEventFromOnChain = (
		eventOnChain: FarmsWithdrewPrincipalEventOnChain
	): FarmsWithdrewPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType("0x" + fields.stake_type),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

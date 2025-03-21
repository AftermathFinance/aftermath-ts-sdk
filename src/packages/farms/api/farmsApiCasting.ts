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
	FarmsStakedPositionFieldsOnChainV1,
	FarmsStakingPoolOwnerCapFieldsOnChainV1,
	FarmsUnlockedEventOnChain,
	FarmsWithdrewPrincipalEventOnChain,
	FarmsStakingPoolOneTimeAdminCapFieldsOnChainV1,
	FarmsStakedPositionFieldsOnChainV2,
	FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2,
	FarmsStakingPoolOwnerCapFieldsOnChainV2,
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
import { SuiObjectResponse } from "@mysten/sui/client";

export class FarmsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static partialStakedPositionObjectFromSuiObjectResponseV1 = (
		data: SuiObjectResponse
	): PartialFarmsStakedPositionObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakedPositionFieldsOnChainV1;
		const stakeCoinType = Helpers.addLeadingZeroesToType(
			Coin.getInnerCoinType(objectType)
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
			version: 1,
		};
	};

	public static partialStakedPositionObjectFromSuiObjectResponseV2 = (
		data: SuiObjectResponse
	): PartialFarmsStakedPositionObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakedPositionFieldsOnChainV2;
		const stakeCoinType = Helpers.addLeadingZeroesToType(
			Coin.getInnerCoinType(objectType)
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakeCoinType,
			stakingPoolObjectId: fields.vault_id,
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
			version: 2,
		};
	};

	public static stakingPoolOwnerCapObjectFromSuiObjectResponseV1 = (
		data: SuiObjectResponse
	): StakingPoolOwnerCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOwnerCapFieldsOnChainV1;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.afterburner_vault_id,
		};
	};

	public static stakingPoolOwnerCapObjectFromSuiObjectResponseV2 = (
		data: SuiObjectResponse
	): StakingPoolOwnerCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOwnerCapFieldsOnChainV2;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.for,
		};
	};

	public static stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1 = (
		data: SuiObjectResponse
	): StakingPoolOneTimeAdminCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOneTimeAdminCapFieldsOnChainV1;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.afterburner_vault_id,
		};
	};

	public static stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2 = (
		data: SuiObjectResponse
	): StakingPoolOneTimeAdminCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2;

		// TODO: add reward coin type ?
		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: fields.cap.for,
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

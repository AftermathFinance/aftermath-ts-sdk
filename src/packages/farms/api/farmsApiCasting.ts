import {
	GrpcCasting,
	Helpers,
	type SuiObjectView,
} from "../../../general/utils";
import { Coin } from "../../coin/coin";
import type {
	FarmsAddedRewardEvent,
	FarmsCreatedVaultEvent,
	FarmsDepositedPrincipalEvent,
	FarmsDestroyedStakedPositionEvent,
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
	PartialFarmsStakedPositionObject,
	StakingPoolOneTimeAdminCapObject,
	StakingPoolOwnerCapObject,
} from "../farmsTypes";
import type {
	FarmsAddedRewardEventOnChainV1,
	FarmsAddedRewardEventOnChainV2,
	FarmsCreatedVaultEventOnChainV1,
	FarmsCreatedVaultEventOnChainV2,
	FarmsDepositedPrincipalEventOnChainV1,
	FarmsDepositedPrincipalEventOnChainV2,
	FarmsDestroyedStakedPositionEventOnChainV1,
	FarmsDestroyedStakedPositionEventOnChainV2,
	FarmsHarvestedRewardsEventOnChainV1,
	FarmsHarvestedRewardsEventOnChainV2,
	FarmsIncreasedEmissionsEventOnChainV1,
	FarmsInitializedRewardEventOnChainV1,
	FarmsInitializedRewardEventOnChainV2,
	FarmsJoinedEventOnChainV1,
	FarmsJoinedEventOnChainV2,
	FarmsLockedEventOnChainV1,
	FarmsLockedEventOnChainV2,
	FarmsSplitEventOnChainV1,
	FarmsSplitEventOnChainV2,
	FarmsStakedEventOnChainV1,
	FarmsStakedEventOnChainV2,
	FarmsStakedPositionFieldsOnChainV1,
	FarmsStakedPositionFieldsOnChainV2,
	FarmsStakedRelaxedEventOnChainV1,
	FarmsStakingPoolOneTimeAdminCapFieldsOnChainV1,
	FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2,
	FarmsStakingPoolOwnerCapFieldsOnChainV1,
	FarmsStakingPoolOwnerCapFieldsOnChainV2,
	FarmsUnlockedEventOnChainV1,
	FarmsUnlockedEventOnChainV2,
	FarmsUpdatedEmissionsEventOnChainV2,
	FarmsWithdrewPrincipalEventOnChainV1,
	FarmsWithdrewPrincipalEventOnChainV2,
} from "./farmsApiCastingTypes";

export class FarmsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static partialStakedPositionObjectFromSuiObjectResponseV1 = (
		data: SuiObjectView
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
			lastHarvestRewardsTimestamp: Number(fields.last_reward_timestamp_ms),
			rewardCoins: fields.base_rewards_accumulated.map(
				(baseRewardsAccumulated, index) => ({
					baseRewardsAccumulated: BigInt(baseRewardsAccumulated),
					baseRewardsDebt: BigInt(fields.base_rewards_debt[index]),
					multiplierRewardsAccumulated: BigInt(
						fields.multiplier_rewards_accumulated[index]
					),
					multiplierRewardsDebt: BigInt(fields.multiplier_rewards_debt[index]),
				})
			),
			version: 1,
		};
	};

	public static partialStakedPositionObjectFromSuiObjectResponseV2 = (
		data: SuiObjectView
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
			lastHarvestRewardsTimestamp: Number(fields.last_reward_timestamp_ms),
			rewardCoins: fields.base_rewards_accumulated.map(
				(baseRewardsAccumulated, index) => ({
					baseRewardsAccumulated: BigInt(baseRewardsAccumulated),
					baseRewardsDebt: BigInt(fields.base_rewards_debt[index]),
					multiplierRewardsAccumulated: BigInt(
						fields.multiplier_rewards_accumulated[index]
					),
					multiplierRewardsDebt: BigInt(fields.multiplier_rewards_debt[index]),
				})
			),
			version: 2,
		};
	};

	public static stakingPoolOwnerCapObjectFromSuiObjectResponseV1 = (
		data: SuiObjectView
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
		data: SuiObjectView
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
		data: SuiObjectView
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
		data: SuiObjectView
	): StakingPoolOneTimeAdminCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as FarmsStakingPoolOneTimeAdminCapFieldsOnChainV2;

		// @dev: `cap` is a nested `AuthorityCap` struct, so it arrived wrapped in
		// JSON-RPC's `{ type, fields }` envelope and arrives bare over gRPC. The
		// sibling `…OwnerCapV2` caster needs no unwrap because *its* `AuthorityCap`
		// is the top-level object rather than a nested field.
		const cap = GrpcCasting.unwrapStructField(fields.cap);

		// TODO: add reward coin type ?
		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			stakingPoolId: cap.for,
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static addedRewardEventFromOnChainV1 = (
		eventOnChain: FarmsAddedRewardEventOnChainV1
	): FarmsAddedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			rewardAmount: BigInt(fields.reward_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static addedRewardEventFromOnChainV2 = (
		eventOnChain: FarmsAddedRewardEventOnChainV2
	): FarmsAddedRewardEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			rewardAmount: BigInt(fields.reward_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static createdVaultEventFromOnChainV1 = (
		eventOnChain: FarmsCreatedVaultEventOnChainV1
	): FarmsCreatedVaultEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			minLockDurationMs: Number(fields.min_lock_duration_ms),
			maxLockDurationMs: Number(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static createdVaultEventFromOnChainV2 = (
		eventOnChain: FarmsCreatedVaultEventOnChainV2
	): FarmsCreatedVaultEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			vaultId: fields.vault_id,
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			minLockDurationMs: Number(fields.min_lock_duration_ms),
			maxLockDurationMs: Number(fields.max_lock_duration_ms),
			maxLockMultiplier: BigInt(fields.max_lock_multiplier),
			minStakeAmount: BigInt(fields.min_stake_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static depositedPrincipalEventFromOnChainV1 = (
		eventOnChain: FarmsDepositedPrincipalEventOnChainV1
	): FarmsDepositedPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static depositedPrincipalEventFromOnChainV2 = (
		eventOnChain: FarmsDepositedPrincipalEventOnChainV2
	): FarmsDepositedPrincipalEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static destroyedStakedPositionEventFromOnChainV1 = (
		eventOnChain: FarmsDestroyedStakedPositionEventOnChainV1
	): FarmsDestroyedStakedPositionEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static destroyedStakedPositionEventFromOnChainV2 = (
		eventOnChain: FarmsDestroyedStakedPositionEventOnChainV2
	): FarmsDestroyedStakedPositionEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static harvestedRewardsEventFromOnChainV1 = (
		eventOnChain: FarmsHarvestedRewardsEventOnChainV1
	): FarmsHarvestedRewardsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.afterburner_vault_id,
			rewardTypes: fields.reward_types.map((rewardType) =>
				Helpers.addLeadingZeroesToType(`0x${rewardType}`)
			),
			rewardAmounts: fields.reward_amounts.map((amount) => BigInt(amount)),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static harvestedRewardsEventFromOnChainV2 = (
		eventOnChain: FarmsHarvestedRewardsEventOnChainV2
	): FarmsHarvestedRewardsEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			vaultId: fields.afterburner_vault_id,
			rewardTypes: fields.reward_types.map((rewardType) =>
				Helpers.addLeadingZeroesToType(`0x${rewardType}`)
			),
			rewardAmounts: fields.reward_amounts.map((amount) => BigInt(amount)),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static increasedEmissionsEventFromOnChainV1 = (
		eventOnChain: FarmsIncreasedEmissionsEventOnChainV1
	): FarmsIncreasedEmissionsEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			emissionScheduleMs: Number(fields.emission_schedule_ms),
			emissionRate: BigInt(fields.emission_rate),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static updatedEmissionsEventFromOnChainV2 = (
		eventOnChain: FarmsUpdatedEmissionsEventOnChainV2
	): FarmsIncreasedEmissionsEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			emissionScheduleMs: Number(fields.emission_schedule_ms),
			emissionRate: BigInt(fields.emission_rate),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static initializedRewardEventFromOnChainV1 = (
		eventOnChain: FarmsInitializedRewardEventOnChainV1
	): FarmsInitializedRewardEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			rewardAmount: BigInt(fields.reward_amount),
			emissionRate: BigInt(fields.emission_rate),
			emissionStartMs: Number(fields.emission_start_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static initializedRewardEventFromOnChainV2 = (
		eventOnChain: FarmsInitializedRewardEventOnChainV2
	): FarmsInitializedRewardEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			vaultId: fields.vault_id,
			rewardType: Helpers.addLeadingZeroesToType(`0x${fields.reward_type}`),
			rewardAmount: BigInt(fields.reward_amount),
			emissionRate: BigInt(fields.emission_rate),
			emissionStartMs: Number(fields.emission_start_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static joinedEventFromOnChainV1 = (
		eventOnChain: FarmsJoinedEventOnChainV1
	): FarmsJoinedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			otherStakedPositionId: fields.other_staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static joinedEventFromOnChainV2 = (
		eventOnChain: FarmsJoinedEventOnChainV2
	): FarmsJoinedEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			otherStakedPositionId: fields.other_staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static lockedEventFromOnChainV1 = (
		eventOnChain: FarmsLockedEventOnChainV1
	): FarmsLockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static lockedEventFromOnChainV2 = (
		eventOnChain: FarmsLockedEventOnChainV2
	): FarmsLockedEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static splitEventFromOnChainV1 = (
		eventOnChain: FarmsSplitEventOnChainV1
	): FarmsSplitEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			splitStakedPositionId: fields.split_staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static splitEventFromOnChainV2 = (
		eventOnChain: FarmsSplitEventOnChainV2
	): FarmsSplitEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			splitStakedPositionId: fields.split_staked_position_id,
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedEventFromOnChainV1 = (
		eventOnChain: FarmsStakedEventOnChainV1
	): FarmsStakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			multipliedStakedAmount: BigInt(fields.multiplied_staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedEventFromOnChainV2 = (
		eventOnChain: FarmsStakedEventOnChainV2
	): FarmsStakedEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			multipliedStakedAmount: BigInt(fields.multiplier_staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockDurationMs: Number(fields.lock_duration_ms),
			lockMultiplier: BigInt(fields.lock_multiplier),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakedRelaxedEventFromOnChainV1 = (
		eventOnChain: FarmsStakedRelaxedEventOnChainV1
	): FarmsStakedRelaxedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			lockStartTimestampMs: Number(fields.lock_start_timestamp_ms),
			lockEndTimestampMs: Number(fields.lock_end_timestamp_ms),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unlockedEventFromOnChainV1 = (
		eventOnChain: FarmsUnlockedEventOnChainV1
	): FarmsUnlockedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unlockedEventFromOnChainV2 = (
		eventOnChain: FarmsUnlockedEventOnChainV2
	): FarmsUnlockedEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			stakedType: Helpers.addLeadingZeroesToType(`0x${fields.staked_type}`),
			stakedAmount: BigInt(fields.staked_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static withdrewPrincipalEventFromOnChainV1 = (
		eventOnChain: FarmsWithdrewPrincipalEventOnChainV1
	): FarmsWithdrewPrincipalEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static withdrewPrincipalEventFromOnChainV2 = (
		eventOnChain: FarmsWithdrewPrincipalEventOnChainV2
	): FarmsWithdrewPrincipalEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			stakedPositionId: fields.staked_position_id,
			vaultId: fields.vault_id,
			amount: BigInt(fields.amount),
			stakeType: Helpers.addLeadingZeroesToType(`0x${fields.stake_type}`),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

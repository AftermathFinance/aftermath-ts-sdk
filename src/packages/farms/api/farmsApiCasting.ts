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

/**
 * Converts raw farm object and event responses into the SDK's normalized
 * farm types.
 *
 * V1 casters read direct `parsedJson` or legacy object fields. V2 event casters
 * read the payload under `parsedJson.pos0`. Numeric strings are converted to
 * `bigint` for balances and fixed-point multipliers, or to `number` for
 * millisecond timestamps.
 *
 * @example
 * ```typescript
 * import { Casting, type SuiObjectView } from "aftermath-ts-sdk";
 *
 * declare const response: SuiObjectView;
 * const position = Casting.farms.partialStakedPositionObjectFromSuiObjectResponseV2(
 *	 response,
 * );
 * ```
 */
export class FarmsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Casts a V1 staked-position object into the partial SDK position shape.
	 *
	 * @param data - Raw Sui object view with V1 legacy fields.
	 * @returns A partial position with normalized coin type, `bigint` balances,
	 * and reward entries in the source array order.
	 */
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

	/**
	 * Casts a V2 staked-position object into the partial SDK position shape.
	 *
	 * @param data - Raw Sui object view with V2 vault fields.
	 * @returns A partial V2 position with normalized coin type, `bigint`
	 * balances, and reward entries in the source array order.
	 */
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

	/**
	 * Casts a V1 staking-pool owner capability object.
	 *
	 * @param data - Raw Sui object view containing `afterburner_vault_id`.
	 * @returns The normalized owner-cap object and its V1 pool ID.
	 */
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

	/**
	 * Casts a V2 staking-pool owner capability object.
	 *
	 * @param data - Raw Sui object view containing the authority `for` field.
	 * @returns The normalized owner-cap object and its V2 pool ID.
	 */
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

	/**
	 * Casts a V1 staking-pool one-time admin capability object.
	 *
	 * @param data - Raw Sui object view containing `afterburner_vault_id`.
	 * @returns The normalized one-time admin capability and its V1 pool ID.
	 */
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

	/**
	 * Casts a V2 one-time admin capability from either JSON-RPC or gRPC shape.
	 *
	 * The nested `cap` field is unwrapped before the authority `for` field is
	 * read, so callers receive the same result from both transports.
	 *
	 * @param data - Raw Sui object view containing the nested authority cap.
	 * @returns The normalized one-time admin capability and its V2 pool ID.
	 */
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

	/** Casts a V1 direct `AddedRewardEvent` payload to the normalized event type. */
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

	/** Casts a V2 `AddedRewardEvent` whose payload is wrapped under `pos0`. */
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

	/** Casts a V1 direct pool-created event and converts its numeric fields. */
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

	/** Casts a V2 wrapped pool-created event and converts its numeric fields. */
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

	/** Casts a V1 direct principal-deposit event. */
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

	/** Casts a V2 wrapped principal-deposit event. */
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

	/** Casts a V1 direct staked-position-destroyed event. */
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

	/** Casts a V2 wrapped staked-position-destroyed event. */
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

	/** Casts a V1 direct reward-harvest event and preserves parallel reward arrays. */
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

	/** Casts a V2 wrapped reward-harvest event and preserves parallel reward arrays. */
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

	/** Casts a V1 direct emission-increase event. */
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

	/** Casts a V2 wrapped emission-update event into the normalized increase-event type. */
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

	/** Casts a V1 direct reward-initialized event. */
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

	/** Casts a V2 wrapped reward-initialized event. */
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

	/** Casts a V1 direct position-joined event. */
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

	/** Casts a V2 wrapped position-joined event. */
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

	/** Casts a V1 direct position-locked event. */
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

	/** Casts a V2 wrapped position-locked event. */
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

	/** Casts a V1 direct position-split event. */
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

	/** Casts a V2 wrapped position-split event. */
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

	/** Casts a V1 direct strict-stake event. */
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

	/** Casts a V2 wrapped strict-stake event. */
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

	/** Casts a V1 direct relaxed-stake event. */
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

	/** Casts a V1 direct position-unlocked event. */
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

	/** Casts a V2 wrapped position-unlocked event. */
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

	/** Casts a V1 direct principal-withdrawal event. */
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

	/** Casts a V2 wrapped principal-withdrawal event. */
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

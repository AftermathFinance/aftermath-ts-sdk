import { SuiObjectResponse } from "@mysten/sui/client";
import {
	ValidatorConfigObject,
	ValidatorOperationCapObject,
	UnstakedEvent,
	UnstakeRequestedEvent,
	StakedEvent,
	EpochWasChangedEvent,
	StakedSuiVaultStateObject,
	ObjectId,
	SuiAddress,
	AnyObjectType,
	IFixedAsString,
} from "../../../types";
import {
	EpochWasChangedEventOnChain,
	StakedEventOnChain,
	StakedSuiVaultStateV1FieldsOnChain,
	UnstakeRequestedEventOnChain,
	UnstakedEventOnChain,
	ValidatorConfigOnIndexer,
	ValidatorOperationCapFieldsOnChain,
} from "./stakingApiCastingTypes";
import { Helpers } from "../../../general/utils";
import { FixedUtils } from "../../../general/utils/fixedUtils";

export class StakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static validatorConfigObjectFromIndexer = (
		data: ValidatorConfigOnIndexer
	): ValidatorConfigObject => {
		return {
			objectType: Helpers.addLeadingZeroesToType(data.objectType),
			objectId: Helpers.addLeadingZeroesToType(data.objectId),
			suiAddress: Helpers.addLeadingZeroesToType(data.suiAddress),
			operationCapId: Helpers.addLeadingZeroesToType(data.operationCapId),
			fee: FixedUtils.directCast(BigInt(data.fee)),
		};
	};

	public static validatorOperationCapObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): ValidatorOperationCapObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as ValidatorOperationCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			authorizerValidatorAddress: Helpers.addLeadingZeroesToType(
				fields.authorizer_validator_address
			),
		};
	};

	public static stakedSuiVaultStateObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakedSuiVaultStateObject => {
		const objectId = Helpers.getObjectId(data);
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as StakedSuiVaultStateV1FieldsOnChain;

		return {
			objectId,
			objectType,
			atomicUnstakeSuiReservesTargetValue: BigInt(
				fields.protocol_config.fields
					.atomic_unstake_sui_reserves_target_value
			),
			atomicUnstakeSuiReserves: BigInt(
				fields.atomic_unstake_sui_reserves
			),
			minAtomicUnstakeFee: BigInt(
				fields.protocol_config.fields.atomic_unstake_protocol_fee.fields
					.min_fee
			),
			maxAtomicUnstakeFee: BigInt(
				fields.protocol_config.fields.atomic_unstake_protocol_fee.fields
					.max_fee
			),
			totalSuiAmount: BigInt(fields.total_sui_amount),
			totalRewardsAmount: BigInt(fields.total_rewards_amount),
			activeEpoch: BigInt(fields.active_epoch),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static stakedEventFromOnChain = (
		eventOnChain: StakedEventOnChain
	): StakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			stakedSuiId: Helpers.addLeadingZeroesToType(fields.staked_sui_id),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			validatorAddress: Helpers.addLeadingZeroesToType(fields.validator),
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			validatorFee: FixedUtils.directCast(BigInt(fields.validator_fee)),
			isRestaked: fields.is_restaked,
			referrer: fields.referrer ? fields.referrer : undefined,
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			afSuiAmount: BigInt(fields.afsui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakedEventFromOnChain = (
		eventOnChain: UnstakedEventOnChain
	): UnstakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			requester: Helpers.addLeadingZeroesToType(fields.requester),
			epoch: BigInt(fields.epoch),
			providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
			returnedSuiAmount: BigInt(fields.returned_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeRequestedEventFromOnChain = (
		eventOnChain: UnstakeRequestedEventOnChain
	): UnstakeRequestedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
			requester: Helpers.addLeadingZeroesToType(fields.requester),
			epoch: BigInt(fields.epoch),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static epochWasChangedEventFromOnChain = (
		eventOnChain: EpochWasChangedEventOnChain
	): EpochWasChangedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			activeEpoch: BigInt(fields.active_epoch),
			totalAfSuiSupply: BigInt(fields.total_afsui_supply),
			totalSuiRewardsAmount: BigInt(fields.total_rewards_amount),
			totalSuiAmount: BigInt(fields.total_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	ValidatorConfigObject,
	ValidatorOperationCapObject,
	UnstakedEvent,
	UnstakeRequestedEvent,
	StakedEvent,
	EpochWasChangedEvent,
	StakedSuiVaultStateObject,
} from "../../../types";
import {
	EpochWasChangedEventOnChain,
	StakedEventOnChain,
	StakedSuiVaultStateV1FieldsOnChain,
	UnstakeRequestedEventOnChain,
	UnstakedEventOnChain,
	ValidatorConfigFieldsOnChain,
	ValidatorOperationCapFieldsOnChain,
} from "./stakingApiCastingTypes";
import { Fixed } from "../../../general/utils/fixed";
import { Helpers } from "../../../general/utils";

export class StakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static validatorConfigObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): ValidatorConfigObject => {
		const objectType = Helpers.getObjectType(data);
		const allFields = Helpers.getObjectFields(data) as {
			value: {
				fields: {
					value: {
						fields: ValidatorConfigFieldsOnChain;
					};
				};
			};
		};
		const fields = allFields.value.fields.value.fields;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			suiAddress: Helpers.addLeadingZeroesToType(fields.sui_address),
			operationCapId: Helpers.addLeadingZeroesToType(
				fields.operation_cap_id
			),
			fee: Fixed.directCast(BigInt(fields.fee)),
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
			validatorFee: Fixed.directCast(BigInt(fields.validator_fee)),
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

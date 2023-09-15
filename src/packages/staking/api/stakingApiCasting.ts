import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	AfSuiMintedEvent,
	UnstakeEvent,
	StakeRequestEvent,
	ValidatorConfigObject,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	AfSuiMintedIndexerEventOnChain,
	StakeRequestEventOnChain,
	StakeRequestIndexerEventOnChain,
	UnstakeEventOnChain,
	UnstakeIndexerEventOnChain,
	ValidatorConfigFieldsOnChain,
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const allFields = getObjectFields(data) as {
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
			objectId: getObjectId(data),
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(
			data
		) as ValidatorOperationCapFieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			authorizerValidatorAddress: Helpers.addLeadingZeroesToType(
				fields.authorizer_validator_address
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

	// =========================================================================
	//  Indexer Events
	// =========================================================================

	public static stakedEventFromIndexerOnChain = (
		eventOnChain: StakedIndexerEventOnChain
	): StakedEvent => {
		return {
			suiId: Helpers.addLeadingZeroesToType(eventOnChain.sui_id),
			stakedSuiId: Helpers.addLeadingZeroesToType(
				eventOnChain.staked_sui_id
			),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			validatorAddress: Helpers.addLeadingZeroesToType(
				eventOnChain.validator
			),
			epoch: BigInt(eventOnChain.epoch),
			suiStakeAmount: BigInt(eventOnChain.sui_amount),
			validatorFee: Fixed.directCast(BigInt(eventOnChain.validator_fee)),
			isRestaked: eventOnChain.is_restaked,
			referrer: eventOnChain.referrer ? eventOnChain.referrer : undefined,
			afSuiId: Helpers.addLeadingZeroesToType(eventOnChain.afsui_id),
			afSuiAmount: BigInt(eventOnChain.afsui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakedEventFromIndexerOnChain = (
		eventOnChain: UnstakedIndexerEventOnChain
	): UnstakedEvent => {
		return {
			afSuiId: Helpers.addLeadingZeroesToType(eventOnChain.afsui_id),
			suiId: Helpers.addLeadingZeroesToType(eventOnChain.sui_id),
			requester: Helpers.addLeadingZeroesToType(eventOnChain.requester),
			epoch: BigInt(eventOnChain.epoch),
			providedAfSuiAmount: BigInt(eventOnChain.provided_afsui_amount),
			returnedSuiAmount: BigInt(eventOnChain.returned_sui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeRequestedEventFromIndexerOnChain = (
		eventOnChain: UnstakeRequestedIndexerEventOnChain
	): UnstakeRequestedEvent => {
		return {
			afSuiId: Helpers.addLeadingZeroesToType(eventOnChain.afsui_id),
			providedAfSuiAmount: BigInt(eventOnChain.provided_afsui_amount),
			requester: Helpers.addLeadingZeroesToType(eventOnChain.requester),
			epoch: BigInt(eventOnChain.epoch),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};
}

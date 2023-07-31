import {
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	AfSuiMintedEvent,
	StakePosition,
	UnstakePosition,
	UnstakeEvent,
	StakeRequestEvent,
	ValidatorConfigObject,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	StakeRequestEventOnChain,
	UnstakeEventOnChain,
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

	// =========================================================================
	//  Events
	// =========================================================================

	public static stakeRequestEventFromOnChain = (
		eventOnChain: StakeRequestEventOnChain
	): StakeRequestEvent => {
		const fields = eventOnChain.parsedJson;
		console.log("fields", fields);
		return {
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			stakedSuiId: Helpers.addLeadingZeroesToType(fields.staked_sui_id),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			validatorAddress: Helpers.addLeadingZeroesToType(fields.validator),
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			validatorFee: Fixed.directCast(BigInt(fields.validator_fee)),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeEventFromOnChain = (
		eventOnChain: UnstakeEventOnChain
	): UnstakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			paybackCoinId: Helpers.addLeadingZeroesToType(
				fields.payback_coin_id
			),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			epoch: BigInt(fields.epoch),
			afSuiAmountGiven: BigInt(fields.provided_afsui_amount),
			suiUnstakeAmount: BigInt(fields.withdrawn_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static afSuiMintedEventFromOnChain = (
		eventOnChain: AfSuiMintedEventOnChain
	): AfSuiMintedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			epoch: BigInt(fields.epoch),
			afSuiMintAmount: BigInt(fields.minted_afsui_amount),
			suiStakeAmount: BigInt(fields.staked_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

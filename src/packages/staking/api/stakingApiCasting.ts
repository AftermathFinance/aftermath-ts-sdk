import {
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	AfSuiMintedEvent,
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
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeEventFromOnChain = (
		eventOnChain: UnstakeEventOnChain
	): UnstakeEvent => {
		return {
			afSuiId: Helpers.addLeadingZeroesToType(eventOnChain.afsui_id),
			paybackCoinId: Helpers.addLeadingZeroesToType(
				eventOnChain.payback_coin_id
			),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			epoch: BigInt(eventOnChain.epoch),
			afSuiAmountGiven: BigInt(eventOnChain.provided_afsui_amount),
			suiUnstakeAmount: BigInt(eventOnChain.withdrawn_sui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static afSuiMintedEventFromOnChain = (
		eventOnChain: AfSuiMintedEventOnChain
	): AfSuiMintedEvent => {
		return {
			suiId: Helpers.addLeadingZeroesToType(eventOnChain.sui_id),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			epoch: BigInt(eventOnChain.epoch),
			afSuiMintAmount: BigInt(eventOnChain.minted_afsui_amount),
			suiStakeAmount: BigInt(eventOnChain.staked_sui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};
}

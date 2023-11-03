import { SuiObjectResponse } from "@mysten/sui.js/client";
import { ValidatorOperationCapObject, StakedEvent } from "../../../types";
import { StakedEventOnChain } from "./superStakingApiCastingTypes";
import { Fixed } from "../../../general/utils/fixed";
import { Helpers } from "../../../general/utils";

export class SuperStakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

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
}

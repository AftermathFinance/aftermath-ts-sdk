import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	LeveragedAfSuiPosition,
} from "../../../types";
import {
	LeveragedAfSuiState,
} from "../../../types";
import {
	LeveragedAfSuiPositionFieldsOnChain,
	LeveragedAfSuiStateFieldsOnChain,
} from "./leveragedStakingApiCastingTypes";
import { Helpers } from "../../../general/utils";

export class LeveragedStakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static leveragedAfSuiPositionFromSuiObjectResponse = (
		data: SuiObjectResponse
	): LeveragedAfSuiPosition => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as LeveragedAfSuiPositionFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			obligationId: Helpers.addLeadingZeroesToType(
				fields.obligation_key.ownership.of
			),
			obligationKeyId: Helpers.addLeadingZeroesToType(
				fields.obligation_key.id
			),
			baseAfSuiCollateral: BigInt(
				fields.position_metadata.base_afsui_collateral
			),
			afSuiCollateral: BigInt(
				fields.position_metadata.afsui_collateral
			),
			suiDebt: BigInt(
				fields.position_metadata.sui_debt
			),
		};
	};

	public static leveragedAfSuiStateFromSuiObjectResponse = (
		data: SuiObjectResponse
	): LeveragedAfSuiState => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as LeveragedAfSuiStateFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			totalAfSuiCollateral: BigInt(fields.total_afsui_collateral),
			totalSuiDebt: BigInt(fields.total_sui_debt),
			protocolVersion: BigInt(fields.protocol_version),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	// public static stakedEventFromOnChain = (
	// 	eventOnChain: StakedEventOnChain
	// ): StakedEvent => {
	// 	const fields = eventOnChain.parsedJson;
	// 	return {
	// 		suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
	// 		stakedSuiId: Helpers.addLeadingZeroesToType(fields.staked_sui_id),
	// 		staker: Helpers.addLeadingZeroesToType(fields.staker),
	// 		validatorAddress: Helpers.addLeadingZeroesToType(fields.validator),
	// 		epoch: BigInt(fields.epoch),
	// 		suiStakeAmount: BigInt(fields.sui_amount),
	// 		validatorFee: Fixed.directCast(BigInt(fields.validator_fee)),
	// 		isRestaked: fields.is_restaked,
	// 		referrer: fields.referrer ? fields.referrer : undefined,
	// 		afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
	// 		afSuiAmount: BigInt(fields.afsui_amount),
	// 		timestamp: eventOnChain.timestampMs,
	// 		txnDigest: eventOnChain.id.txDigest,
	// 		type: eventOnChain.type,
	// 	};
	// };
}

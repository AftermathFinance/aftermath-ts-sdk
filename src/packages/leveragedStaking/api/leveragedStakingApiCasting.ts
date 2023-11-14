import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	LeveragedAfSuiPosition,
	LeveragedStakeChangedLeverageEvent,
	LeveragedStakedEvent,
	LeveragedUnstakedEvent,
} from "../../../types";
import { LeveragedAfSuiState } from "../../../types";
import {
	LeveragedAfSuiPositionFieldsOnChain,
	LeveragedAfSuiStateFieldsOnChain,
	LeveragedStakeChangedLeverageEventOnChain,
	LeveragedStakedEventOnChain,
	LeveragedUnstakedEventOnChain,
} from "./leveragedStakingApiCastingTypes";
import { Helpers } from "../../../general/utils";
import { Fixed } from "../../../general/utils/fixed";

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
			afSuiCollateral: BigInt(fields.position_metadata.afsui_collateral),
			suiDebt: BigInt(fields.position_metadata.sui_debt),
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

	public static leveragedStakedEventFromOnChain = (
		eventOnChain: LeveragedStakedEventOnChain
	): LeveragedStakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			userAddress: Helpers.addLeadingZeroesToType(fields.user),
			leverage: Fixed.directCast(BigInt(fields.leverage)),
			newAfSuiCollateral: BigInt(fields.new_afsui_collateral),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static leveragedUnstakedEventFromOnChain = (
		eventOnChain: LeveragedUnstakedEventOnChain
	): LeveragedUnstakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			userAddress: Helpers.addLeadingZeroesToType(fields.user),
			afsuiCollateral: BigInt(fields.afsui_collateral),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static leveragedStakeChangedEventFromOnChain = (
		eventOnChain: LeveragedStakeChangedLeverageEventOnChain
	): LeveragedStakeChangedLeverageEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			userAddress: Helpers.addLeadingZeroesToType(fields.user),
			newLeverage: Fixed.directCast(BigInt(fields.new_leverage)),
			initialLeverage: Fixed.directCast(BigInt(fields.initial_leverage)),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

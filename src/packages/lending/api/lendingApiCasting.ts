import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import { DepositoryIndexObject, DepositoryObject, PositionTicketObject, SubPositionObject } from "../lendingTypes";

export class LendingApiCasting {

	// =========================================================================
	//  Objects
	// =========================================================================

	public static positionTicketObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PositionTicketObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
		};
	};

	public static DepositoryObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): DepositoryObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			protected_balance: BigInt(fields.protected_balance),
			borrowable_balance: BigInt(fields.borrowable_balance),
			locked_ptokens: BigInt(fields.locked_ptokens),
			locked_btokens: BigInt(fields.locked_btokens),
		};
	};

	public static DepositoryIndexObjectFromSuiObjectResponse = (

		data: SuiObjectResponse
	): DepositoryIndexObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			asset_ticker: String(fields.asset_ticker),
			protected_balance_value: BigInt(fields.protected_balance_value),
			borrowable_balance_value: BigInt(fields.borrowable_balance_value),
			btoken_supply_value: BigInt(fields.btoken_supply_value),
			ptoken_supply_value: BigInt(fields.ptoken_supply_value),
			total_debt_value: BigInt(fields.total_debt_value),
			collected_fee_value: BigInt(fields.collected_fee_value),
			rate_level: BigInt(fields.rate_level),
			timestamp_in_seconds: BigInt(fields.timestamp_in_seconds),
		};
	};

	public static SubPositionObjectFromSuiObjectResponse = (

		data: SuiObjectResponse
	): SubPositionObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		);

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			debt_with_interest: BigInt(fields.debt_with_interest),
			locked_borrowable_amount: BigInt(fields.locked_borrowable_amount),
			locked_protected_amount: BigInt(fields.lock_protected_amount),
			last_rate_level: BigInt(fields.last_rate_level),
		};
	};
	// =========================================================================
	//  Events
	// =========================================================================

}
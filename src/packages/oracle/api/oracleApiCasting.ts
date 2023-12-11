import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import { PriceFeed, PriceFeedStorage } from "../oracleTypes";

export class OracleApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static priceFeedStorageFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeedStorage => {
		const objectType = Helpers.getObjectType(data);
		return {
			objectType,
			objectId: Helpers.getObjectId(data),
		};
	};

	public static priceFeedFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeed => {
		const objectType = Helpers.getObjectType(data);
		const objectFields = Helpers.getObjectFields(data);
		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			symbol: objectFields.symbol,
			price: objectFields.price,
			decimal: objectFields.decimal,
			timestamp: objectFields.timestamp,
		};
	};
}

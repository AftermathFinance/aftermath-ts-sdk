import {
    ObjectContentFields,
    getObjectFields,
    getObjectId,
    getObjectType,
    SuiObjectResponse
} from "@mysten/sui.js";
import { Helpers } from "../../../general/utils";
import { PriceFeed, PriceFeedStorage } from "../oracleTypes";

export class OracleCasting {
	// =========================================================================
	//  Oracle
	// =========================================================================
	public static priceFeedStorageFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeedStorage => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
		};
	};

	public static priceFeedFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeed => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			symbol: objectFields.symbol,
			price: objectFields.price,
			decimal: objectFields.decimal,
			timestamp: objectFields.timestamp,
		};
	};

}

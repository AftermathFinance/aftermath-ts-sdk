import { Helpers } from "../../../general/utils";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";
import { UpdatedPriceFeedEventOnChain } from "../oracleCastingTypes";
import { UpdatedPriceFeedEvent } from "../oracleTypes";

export class OracleApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static updatedPriceFeedEventFromOnChain = (
		eventOnChain: UpdatedPriceFeedEventOnChain
	): UpdatedPriceFeedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			priceFeedId: Helpers.addLeadingZeroesToType(
				fields.price_feed_storage_id
			),
			sourceWrapperId: Helpers.addLeadingZeroesToType(
				fields.source_wrapper_id
			),
			oldPrice: IFixedUtils.numberFromIFixed(BigInt(fields.old_price)),
			oldTimestamp: Number(fields.old_timestamp),
			newPrice: IFixedUtils.numberFromIFixed(BigInt(fields.new_price)),
			newTimestamp: Number(fields.new_timestamp),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

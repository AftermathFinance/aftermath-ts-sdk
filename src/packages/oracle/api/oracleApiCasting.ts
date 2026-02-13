import { Helpers } from "../../../general/utils/index.ts";
import { IFixedUtils } from "../../../general/utils/iFixedUtils.ts";
import { UpdatedPriceFeedEventOnChain } from "../oracleCastingTypes.ts";
import { UpdatedPriceFeedEvent } from "../oracleTypes.ts";

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

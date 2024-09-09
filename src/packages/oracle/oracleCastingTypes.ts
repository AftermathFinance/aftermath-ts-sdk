import { EventOnChain } from "../../general/types/castingTypes";
import {
	BigIntAsString,
	IFixedAsString,
	ObjectId,
	Timestamp,
} from "../../types";

// =========================================================================
//  Events
// =========================================================================

export type UpdatedPriceFeedEventOnChain = EventOnChain<{
	price_feed_storage_id: ObjectId;
	source_wrapper_id: ObjectId;
	old_price: IFixedAsString;
	old_timestamp: BigIntAsString;
	new_price: IFixedAsString;
	new_timestamp: BigIntAsString;
}>;

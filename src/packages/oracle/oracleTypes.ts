import { Event, ObjectId, Timestamp } from "../../types";

// =========================================================================
//  Events
// =========================================================================

export interface UpdatedPriceFeedEvent extends Event {
	priceFeedId: ObjectId;
	sourceWrapperId: ObjectId;
	oldPrice: number;
	oldTimestamp: Timestamp;
	newPrice: number;
	newTimestamp: Timestamp;
}

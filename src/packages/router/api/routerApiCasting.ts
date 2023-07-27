import { RouterTradeEvent } from "../routerTypes";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes";

export class RouterApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static routerTradeEventFromOnChain = (
		eventOnChain: RouterTradeEventOnChain
	): RouterTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			trader: fields.swapper,
			coinInType: fields.type_in,
			coinInAmount: BigInt(fields.amount_in),
			coinOutType: fields.type_out,
			coinOutAmount: BigInt(fields.amount_out),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

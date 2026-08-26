import type { RouterTradeEvent } from "../routerTypes";
import type { RouterTradeEventOnChain } from "./routerApiCastingTypes";

/** Converts raw router indexer events into the SDK's public event shape. */
export class RouterApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Converts a raw `SwapCompletedEvent` into a `RouterTradeEvent`.
	 *
	 * Amount strings are converted to `bigint` without passing through
	 * JavaScript `number`, and the indexer timestamp is converted to a number.
	 * An absent timestamp therefore becomes `NaN`, matching the shared event
	 * casting behavior.
	 *
	 * @param eventOnChain - The raw event returned by the Sui indexer.
	 * @returns The normalized router trade event.
	 * @throws When an amount is not a valid bigint string.
	 */
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
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

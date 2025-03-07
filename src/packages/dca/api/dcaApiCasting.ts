import { Helpers } from "../../../general/utils";
import { DcaCreatedOrderEvent } from "../dcaTypes";
import { DcaCreatedOrderEventOnChain } from "./dcaApiCastingTypes";

export class DcaApiCasting {
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdDcaOrderEventFromOnChain = (
		eventOnChain: DcaCreatedOrderEventOnChain
	): DcaCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			owner: Helpers.addLeadingZeroesToType(fields.user),
			inputValue: BigInt(fields.input_amount),
			inputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.input_type).toString()
			),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.output_type).toString()
			),
			gasValue: BigInt(fields.gas_amount),
			frequencyMs: Number(fields.frequency_ms),
			startTimestampMs: Number(fields.start_timestamp_ms),
			amountPerTrade: BigInt(fields.amount_per_trade),
			maxAllowableSlippageBps: BigInt(fields.max_allowable_slippage_bps),
			minAmountOut: BigInt(fields.min_amount_out),
			maxAmountOut: BigInt(fields.max_amount_out),
			remainingTrades: BigInt(fields.remaining_trades),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
			recipient: Helpers.addLeadingZeroesToType(fields.recipient),
		};
	};
}

import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Helpers } from "../../../general/utils";
import { DcaCancelledOrderEvent, DcaCreatedOrderEvent, DcaExecutedTradeEvent, DcaOrdersOjbect } from "../dcaTypes";
import { DcaCancelledOrderEventOnChain, DcaCreatedOrderEventOnChain, DcaExecutedTradeEventOnChain } from "./dcaApiCastingTypes";

export class DcaApiCasting {

    public static createdDcaOrderEventFromOnChain = (
		eventOnChain: DcaCreatedOrderEventOnChain
	): DcaCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.owner,
			inputValue: BigInt(fields.input_value),
			inputType: Helpers.addLeadingZeroesToType("0x" + fields.input_type),
			outputType: Helpers.addLeadingZeroesToType("0x" + fields.output_type),
			gasValue: BigInt(fields.gas_value),
			frequencyMs: Number(fields.frequency_ms),
			allowableDeviationMs: Number(fields.allowable_deviation_ms),
			startTimestampMs: Number(fields.start_timestamp_ms),
			amountPerTrade: BigInt(fields.amount_per_trade),
			maxAllowableSlippageBps: BigInt(fields.max_allowable_slippage_bps),
			minAmountOut: BigInt(fields.min_amount_out),
			maxAmountOut: BigInt(fields.max_amount_out),
			remainingTrades: BigInt(fields.remaining_trades),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type
		};
	};


	public static cancelledDcaOrderEventFromChain = (
		eventOnChain: DcaCancelledOrderEventOnChain
	): DcaCancelledOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.owner,
			remainingValue: BigInt(fields.remaining_value),
			inputType: Helpers.addLeadingZeroesToType("0x" + fields.input_type),
			outputType: Helpers.addLeadingZeroesToType("0x" + fields.output_type),
			gasValue: BigInt(fields.gas_value),
			frequencyMs: Number(fields.frequency_ms),
			allowableDeviationMs: Number(fields.allowable_deviation_ms),
			lastTradeTimestampMs: Number(fields.last_trade_timestamp_ms),
			amountPerTrade: BigInt(fields.amount_per_trade),
			maxAllowableSlippageBps: BigInt(fields.max_allowable_slippage_bps),
			minAmountOut: BigInt(fields.min_amount_out),
			maxAmountOut: BigInt(fields.max_amount_out),
			remainingTrades: BigInt(fields.remaining_trades),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type
		};
	};

	public static executedTradeEventFromChain = (
		eventOnChain: DcaExecutedTradeEventOnChain
	): DcaExecutedTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.owner,
			inputType: Helpers.addLeadingZeroesToType("0x" + fields.input_type),
			inputAmount: BigInt(fields.input_amount),
			outputType: Helpers.addLeadingZeroesToType("0x" + fields.output_type),
			outputAmount: BigInt(fields.output_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type
		};
	};
}
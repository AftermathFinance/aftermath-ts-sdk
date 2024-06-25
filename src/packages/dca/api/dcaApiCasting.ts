import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Casting, Helpers } from "../../../general/utils";
import { DcaCancelledOrderEvent, DcaCreatedOrderEvent, DcaExecutedTradeEvent, DcaOrderObject, DcaOrderTradeObject, DcaOrdertStrategyObject } from "../dcaTypes";
import { DcaClosedOrderEventOnChain, DcaCreatedOrderEventOnChain, DcaExecutedTradeEventOnChain, DcaOrderFieldsOnChain } from "./dcaApiCastingTypes";
import { Coin } from "../../coin/coin";

export class DcaApiCasting {

    public static createdDcaOrderEventFromOnChain = (
		eventOnChain: DcaCreatedOrderEventOnChain
	): DcaCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.owner,
			inputValue: BigInt(fields.input_value),
			inputType: Helpers.addLeadingZeroesToType("0x" + Buffer.from(fields.input_type).toString()),
			outputType: Helpers.addLeadingZeroesToType("0x" + Buffer.from(fields.output_type).toString()),
			gasValue: BigInt(fields.gas_value),
			frequencyMs: Number(fields.frequency_ms),
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
		eventOnChain: DcaClosedOrderEventOnChain
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
		console.log("executedTradeEventFromChain", fields);
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

	// =========================================================================
	// Object 
	// =========================================================================

	public static partialOrdersObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): DcaOrderObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as DcaOrderFieldsOnChain;

		console.log("data", data);
		console.log("fields", fields);

		const coinsTypes = new Coin(objectType).innerCoinType.split(", ");
		const inCoin = Helpers.addLeadingZeroesToType(coinsTypes[0]);
		const outCoin = Helpers.addLeadingZeroesToType(coinsTypes[1]);
		const strategy: DcaOrdertStrategyObject | undefined = (
							(Number(fields.min_amount_out) === 0) && 
							(BigInt(fields.max_amount_out) === Casting.u64MaxBigInt)) 
								? undefined : {
									priceMin: BigInt(fields.min_amount_out),
    								priceMax: BigInt(fields.max_amount_out)
								};

		return {
			objectId: Helpers.getObjectId(data),
			objectType: objectType,
			overview: {
				allocatedCoin: {
					coin: inCoin,
					amount: BigInt(fields.remaining_balance),
				},
				buyCoin: {
					coin: outCoin,
					amount: BigInt(0),
				},
				averagePrice: BigInt(0),
				totalSpent: BigInt(0),
				interval: BigInt(fields.frequency_ms),
				totalTrades: 0,
				tradesRemaining: Number(fields.remaining_trades),
				maxSlippage: BigInt(0),
				strategy: strategy,
				progress: 0,
				created: { time: undefined, tnxDigest: "" },
				started: { time: undefined, tnxDigest: "" },
				lastExecutedTradeTime: { time: undefined, tnxDigest: ""},
			},
			trades: []
		};
	}

	public static tradeEventToObject = (
		eventObject: DcaExecutedTradeEvent
	): DcaOrderTradeObject => {
		return {
			allocatedCoin: {
				coin: eventObject.inputType,
				amount: eventObject.inputAmount
			},
			buyCoin: {
				coin: eventObject.outputType,
				amount: eventObject.outputAmount
			},
			buyDate: Number(eventObject.timestamp),
			rate: 0
		};
	}
}
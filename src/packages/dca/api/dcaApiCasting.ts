import { SuiObjectResponse } from "@mysten/sui.js/client";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin/coin";
import {
	DcaCancelledOrderEvent,
	DcaCreatedOrderEvent,
	DcaExecutedTradeEvent,
	DcaOrderObject,
	DcaOrderTradeObject,
	DcaOrdertStrategyObject,
} from "../dcaTypes";
import {
	DcaClosedOrderEventOnChain,
	DcaCreatedOrderEventOnChain,
	DcaExecutedTradeEventOnChain,
	DcaIndexerOrderResponse,
	DcaIndexerOrdersResponse,
	DcaIndexerOrderTradeResponse,
	DcaOrderFieldsOnChain,
} from "./dcaApiCastingTypes";

export class DcaApiCasting {
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdDcaOrderEventFromOnChain = (
		eventOnChain: DcaCreatedOrderEventOnChain
	): DcaCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.user,
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
		};
	};

	public static cancelledDcaOrderEventFromChain = (
		eventOnChain: DcaClosedOrderEventOnChain
	): DcaCancelledOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			owner: fields.user,
			remainingValue: BigInt(fields.remaining_value),
			inputType: Helpers.addLeadingZeroesToType("0x" + fields.input_type),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + fields.output_type
			),
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
			type: eventOnChain.type,
		};
	};

	public static executedTradeEventFromChain = (
		eventOnChain: DcaExecutedTradeEventOnChain
	): DcaExecutedTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: fields.order_id,
			user: fields.user,
			inputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.input_type).toString()
			),
			inputAmount: BigInt(fields.input_amount),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.output_type).toString()
			),
			outputAmount: BigInt(fields.output_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	// Object
	// =========================================================================

	public static partialOrdersObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): DcaOrderObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(data) as DcaOrderFieldsOnChain;

		// console.log("data", data);
		// console.log("fields", fields);

		const coinsTypes = new Coin(objectType).innerCoinType.split(", ");
		const inCoin = Helpers.addLeadingZeroesToType(coinsTypes[0]);
		const outCoin = Helpers.addLeadingZeroesToType(coinsTypes[1]);
		const strategy: DcaOrdertStrategyObject | undefined =
			Number(fields.min_amount_out) === 0 &&
			BigInt(fields.max_amount_out) === Casting.u64MaxBigInt
				? undefined
				: {
						priceMin: BigInt(fields.min_amount_out),
						priceMax: BigInt(fields.max_amount_out),
				  };
		return {
			objectId: Helpers.getObjectId(data),
			objectType: objectType,
			overview: {
				allocatedCoin: {
					coin: inCoin,
					amount: BigInt(fields.balance),
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
				lastExecutedTradeTime: { time: undefined, tnxDigest: "" },
			},
			trades: [],
		};
	};

	public static tradeEventToObject = (
		eventObject: DcaExecutedTradeEvent
	): DcaOrderTradeObject => {
		return {
			allocatedCoin: {
				coin: eventObject.inputType,
				amount: eventObject.inputAmount,
			},
			buyCoin: {
				coin: eventObject.outputType,
				amount: eventObject.outputAmount,
			},
			tnxDate: Number(eventObject.timestamp),
			tnxDigest: eventObject.txnDigest,
			rate: 0,
		};
	};

	// =========================================================================
	// Indexer
	// =========================================================================

	public static createdOrderEventOnIndexer = (
		response: DcaIndexerOrderResponse
	): DcaOrderObject => {
		const totalOrdersAmount = Number(response.orders_num);
		const ordersLeft = Number(response.orders_left);
		const progress =
			totalOrdersAmount > 0
				? (totalOrdersAmount - ordersLeft) / totalOrdersAmount
				: 1;
		const started = undefined;
		const lastTrade = undefined;
		const inputCoinType = String(response.coin_sell);
		const outputCoinType = String(response.coin_buy);
		var totalSpent = BigInt(0);
		var totalBought = BigInt(0);
		const strategy: DcaOrdertStrategyObject | undefined =
			Number(response.min_amount_out) === 0 &&
			BigInt(response.max_amount_out) === Casting.u64MaxBigInt
				? undefined
				: {
						priceMin: BigInt(response.min_amount_out),
						priceMax: BigInt(response.max_amount_out),
				  };
		const tradesPrepared = response.trades.map((trade) => {
			const tradePrepared = this.createdOrderTradeEventOnIndexer(
				trade,
				inputCoinType,
				outputCoinType
			);
			totalSpent += tradePrepared.allocatedCoin.amount;
			totalBought += tradePrepared.buyCoin.amount;
			return tradePrepared;
		});
		return {
			objectId: response.order_object_id,
			objectType: "",
			overview: {
				allocatedCoin: {
					coin: inputCoinType,
					amount: BigInt(response.coin_sell_amount),
				},
				buyCoin: {
					coin: outputCoinType,
					amount: totalBought,
				},
				averagePrice:
					tradesPrepared.length > 0
						? totalBought / BigInt(tradesPrepared.length)
						: BigInt(0),
				totalSpent: totalSpent,
				interval: BigInt(response.frequency_ms),
				totalTrades: totalOrdersAmount,
				tradesRemaining: ordersLeft,
				maxSlippage: BigInt(response.slippage),
				strategy: strategy,
				progress: progress,
				created: {
					time: response.created.timestamp,
					tnxDigest: response.created.tx_digest,
				},
				started: started
					? {
							time: response.created.timestamp,
							tnxDigest: response.created.tx_digest,
					  }
					: undefined,
				lastExecutedTradeTime: lastTrade
					? {
							time: response.created.timestamp,
							tnxDigest: response.created.tx_digest,
					  }
					: undefined,
			},
			trades: tradesPrepared,
		};
	};

	public static createdOrderTradeEventOnIndexer = (
		response: DcaIndexerOrderTradeResponse,
		inputCounType: string,
		outputCoinType: string
	): DcaOrderTradeObject => {
		return {
			allocatedCoin: {
				coin: inputCounType,
				amount: BigInt(response.input_amount),
			},
			buyCoin: {
				coin: outputCoinType,
				amount: BigInt(response.output_amount),
			},
			tnxDigest: response.event.tx_digest,
			tnxDate: response.event.timestamp,
			rate: 0,
		};
	};
}

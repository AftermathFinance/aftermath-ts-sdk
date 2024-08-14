import { Casting, Helpers } from "../../../general/utils";
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
	DcaIndexerOrderTradeResponse,
} from "./dcaApiCastingTypes";
import { Balance } from "../../../types";

export class DcaApiCasting {
	
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdDcaOrderEventFromOnChain = (
		eventOnChain: DcaCreatedOrderEventOnChain
	): DcaCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		console.log("createdDcaOrderEventFromOnChain", {fields})
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

	public static cancelledDcaOrderEventFromOnChain = (
		eventOnChain: DcaClosedOrderEventOnChain
	): DcaCancelledOrderEvent => {
		const fields = eventOnChain.parsedJson;
		console.log("cancelledDcaOrderEventFromChain", {fields})
		return {
			orderId: fields.order_id,
			owner: fields.user,
			remainingValue: BigInt(fields.remaining_amount),
			inputType: Helpers.addLeadingZeroesToType("0x" + fields.input_type),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + fields.output_type
			),
			gasValue: BigInt(fields.gas_amount),
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

	public static executedTradeEventFromOnChain = (
		eventOnChain: DcaExecutedTradeEventOnChain
	): DcaExecutedTradeEvent => {
		const fields = eventOnChain.parsedJson;
		console.log("executedTradeEventFromChain", {fields})
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
		const inputCoinType = String(response.coin_sell);
		const outputCoinType = String(response.coin_buy);
		const strategy: DcaOrdertStrategyObject | undefined =
			Number(response.min_amount_out) === 0 &&
			BigInt(response.max_amount_out) === Casting.u64MaxBigInt
				? undefined
				: {
						priceMin: BigInt(response.min_amount_out),
						priceMax: BigInt(response.max_amount_out),
				  };
		const { totalSpent, totalBought } = response.trades.reduce((total, order) => {
            total.totalSpent += BigInt(order.input_amount);
            total.totalBought += BigInt(order.output_amount);
            return total;
        }, { 
            totalSpent: BigInt(0), 
            totalBought: BigInt(0) 
        });
		const tradesPrepared = response.trades.map((trade) => {
			const tradePrepared = this.createdOrderTradeEventOnIndexer(
				trade,
				inputCoinType,
				outputCoinType,
				totalSpent
			);
			return tradePrepared;
		});

		const started = tradesPrepared.length > 0 ? { 
			timestamp: tradesPrepared[0].tnxDate,
			digest:  tradesPrepared[0].tnxDigest,
		} : undefined;

		const lastTrade = tradesPrepared.length > 0 ? { 
			timestamp: tradesPrepared[tradesPrepared.length - 1].tnxDate,
			digest:  tradesPrepared[tradesPrepared.length - 1].tnxDigest,
		} : undefined;

		return {
			objectId: response.order_object_id,
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
				recipient: response.recipient,
				created: {
					time: response.created.timestamp,
					tnxDigest: response.created.tx_digest,
				},
				started: started
					? {
							time: started.timestamp,
							tnxDigest: started.digest,
					  }
					: undefined,
				lastExecutedTradeTime: lastTrade
					? {
							time: lastTrade.timestamp,
							tnxDigest:lastTrade.digest,
					  }
					: undefined,
			},
			trades: tradesPrepared,
		};
	};

	public static createdOrderTradeEventOnIndexer = (
		response: DcaIndexerOrderTradeResponse,
		inputCounType: string,
		outputCoinType: string,
		totalSpent: Balance
	): DcaOrderTradeObject => {
		const rate = totalSpent > 0 ? Number(BigInt(response.input_amount) / totalSpent) : 0;
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
			rate: rate
		};
	};
}

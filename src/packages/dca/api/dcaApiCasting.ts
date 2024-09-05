import { Casting, Helpers } from "../../../general/utils";
import {
	DcaClosedOrderEvent,
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
		};
	};

	public static closedDcaOrderEventFromOnChain = (
		eventOnChain: DcaClosedOrderEventOnChain
	): DcaClosedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			owner: Helpers.addLeadingZeroesToType(fields.user),
			remainingValue: BigInt(fields.remaining_amount),
			inputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.input_type).toString()
			),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.output_type).toString()
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
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			user: Helpers.addLeadingZeroesToType(fields.user),
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
		const inputCoinType = Helpers.addLeadingZeroesToType(
			String(response.coin_sell)
		);
		const outputCoinType = Helpers.addLeadingZeroesToType(
			String(response.coin_buy)
		);
		const strategy: DcaOrdertStrategyObject | undefined =
			BigInt(response.min_amount_out) === BigInt(0) &&
			BigInt(response.max_amount_out) === Casting.u64MaxBigInt
				? undefined
				: {
						priceMin: BigInt(response.min_amount_out),
						priceMax: BigInt(response.max_amount_out),
				  };
		const { totalSpent, totalBought } = response.trades.reduce(
			(total, order) => {
				total.totalSpent += BigInt(order.input_amount);
				total.totalBought += BigInt(order.output_amount);
				return total;
			},
			{
				totalSpent: BigInt(0),
				totalBought: BigInt(0),
			}
		);
		const tradesPrepared = response.trades.map((trade) => {
			return this.createdOrderTradeEventOnIndexer(
				trade,
				inputCoinType,
				outputCoinType
			);
		});

		const started =
			tradesPrepared.length > 0
				? {
						timestamp: tradesPrepared[0].tnxDate,
						digest: tradesPrepared[0].tnxDigest,
				  }
				: {
						timestamp: Number(response.next_execution_timestamp_ms),
						digest: "",
				  };

		const lastTrade =
			tradesPrepared.length > 0
				? {
						timestamp:
							tradesPrepared[tradesPrepared.length - 1].tnxDate,
						digest: tradesPrepared[tradesPrepared.length - 1]
							.tnxDigest,
				  }
				: undefined;

		return {
			objectId: Helpers.addLeadingZeroesToType(response.order_object_id),
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
				intervalMs: BigInt(response.frequency_ms),
				totalTrades: totalOrdersAmount,
				tradesRemaining: ordersLeft,
				maxSlippageBps: Number(response.slippage),
				strategy: strategy,
				progress: progress,
				recipient: Helpers.addLeadingZeroesToType(response.recipient),
				created: {
					time: response.created.timestamp,
					tnxDigest: response.created.tx_digest,
				},
				nextTrade: {
					time: started.timestamp,
					tnxDigest: started.digest,
				},
				lastExecutedTrade: lastTrade
					? {
							time: lastTrade.timestamp,
							tnxDigest: lastTrade.digest,
					  }
					: undefined,
			},
			trades: tradesPrepared,
		};
	};

	public static createdOrderTradeEventOnIndexer = (
		response: DcaIndexerOrderTradeResponse,
		inputCoinType: string,
		outputCoinType: string
	): DcaOrderTradeObject => {
		const inputAmount = BigInt(response.input_amount);
		const outputAmount = BigInt(response.output_amount);
		return {
			allocatedCoin: {
				coin: inputCoinType,
				amount: inputAmount,
			},
			buyCoin: {
				coin: outputCoinType,
				amount: outputAmount,
			},
			tnxDigest: response.event.tx_digest,
			tnxDate: response.event.timestamp,
			rate: undefined,
		};
	};
}

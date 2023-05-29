import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectId,
} from "@mysten/sui.js";
import {
	AccountManager,
	MarketManager,
	MarketState,
	PriceFeed,
	PriceFeedStorage,
	Orderbook,
	Order,
	CritBitTree,
	OrderCasted,
	MarketManagerDynamicFieldOnChain,
	MarketManagerParamsDynamicFieldOnChain,
	MarketManagerParamsDynamicField,
	MarketParams,
	MarketManagerOrderbookDynamicField,
	MarketManagerStateDynamicField,
	MarketManagerOrderbookDynamicFieldOnChain,
	MarketManagerStateDynamicFieldOnChain,
	InnerNode,
	OuterNode,
	IFixed,
} from "../perpetualsTypes";
import PriorityQueue from "priority-queue-typescript";
import {
	price,
	counterAsk,
	counterBid,
	orderId,
	ASK,
	BID,
} from "../utils/critBitTreeUtils";
import { compareAskOrders, compareBidOrders } from "../utils/comparators";
import {
	isMarketManagerOrderbookKeyType,
	isMarketManagerParamsKeyType,
	isMarketManagerStateKeyType,
} from "../utils/helpers";
import BN from "bn.js";

export class PerpetualsCasting {

	/////////////////////////////////////////////////////////////////////
	//// Account Manager
	/////////////////////////////////////////////////////////////////////
	public static accountManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): AccountManager => {
		return {
			objectId: getObjectId(data),
		} as AccountManager;
	};

	/////////////////////////////////////////////////////////////////////
	//// Market Manager
	/////////////////////////////////////////////////////////////////////
	public static marketManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): MarketManager => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectId: getObjectId(data),
			feesAccrued: objectFields.fees_accrued,
			netTransferFromIfToVault: objectFields.net_transfer_from_if,
		} as MarketManager;
	};

	public static marketManagerParamsDynamicFieldFromOnChain = (
		dynamicField: MarketManagerDynamicFieldOnChain
	) => {
		if (!isMarketManagerParamsKeyType(dynamicField.data.type))
			throw new Error("not params key type");
		const paramsField = dynamicField as MarketManagerParamsDynamicFieldOnChain;
		// const checkMarketParams = PerpetualsCasting.marketParamsFromRawData(
		// 	paramsField.data.fields.value.fields
		// );
		return {
			objectId: paramsField.data.fields.id.id,
			value: PerpetualsCasting.marketParamsFromRawData(paramsField.data.fields.value.fields),
		} as MarketManagerParamsDynamicField;
	};

	public static marketManagerStateDynamicFieldFromOnChain = (
		dynamicField: MarketManagerDynamicFieldOnChain
	) => {
		if (!isMarketManagerStateKeyType(dynamicField.data.type))
			throw new Error("not state key type");
		const stateField = dynamicField as MarketManagerStateDynamicFieldOnChain;
		return {
			objectId: stateField.data.fields.id.id,
			value: PerpetualsCasting.marketStateFromRawData(stateField.data.fields),
		} as MarketManagerStateDynamicField;
	};

	public static marketManagerOrderbookDynamicFieldFromOnChain = async (
		dynamicField: MarketManagerDynamicFieldOnChain
	) => {
		if (!isMarketManagerOrderbookKeyType(dynamicField.data.type))
			throw new Error("not order book key type");
		const orderbookField =
			dynamicField as MarketManagerOrderbookDynamicFieldOnChain;
		return {
			objectId: orderbookField.data.fields.id.id,
			value: PerpetualsCasting.orderbookFromRawData(orderbookField.data),
		} as MarketManagerOrderbookDynamicField;
	};

	public static marketParamsFromRawData = (data: any) => {
		return {
			marginRatioInitial: new BN(data.margin_ratio_initial),
			marginRatioMaintenance: new BN(data.margin_ratio_maintenance),
			baseAssetSymbol: data.base_asset_symbol,
			fundingFrequencyMs: BigInt(data.funding_frequency_ms),
			fundingPeriodMs: BigInt(data.funding_period_ms),
			twapPeriodMs: BigInt(data.twap_period_ms),
			makerFee: new BN(data.maker_fee),
			takerFee: new BN(data.taker_fee),
			liquidationFee: new BN(data.liquidation_fee),
			forceCancelFee: new BN(data.force_cancel_fee),
			insuranceFundFee: new BN(data.insurance_fund_fee),
			priceImpactFactor: new BN(data.price_impact_factor)
		} as MarketParams;
	};

	public static marketStateFromRawData = (data: any) => {
		return {
			cumulativeFundingRate: new BN(data.cum_funding_rate),
			fundingRateTimestamp: Number(data.funding_rate_ts),
			lastIndexPrice: new BN(data.last_index_price),
			lastIndexTwap: new BN(data.last_index_ts),
			lastIndexTimestamp: Number(data.last_index_ts),
			lastMarkPrice: new BN(data.last_mark_price),
			lastMarkTwap: new BN(data.last_mark_price),
			lastMarkTimestamp: Number(data.last_mark_ts),
			openInterest: new BN(data.open_interest)
		} as MarketState;
	};

	/////////////////////////////////////////////////////////////////////
	//// Orderbook
	/////////////////////////////////////////////////////////////////////
	public static critBitTreeFromAny = (data: any): CritBitTree<Order> => {
		return {
			root: BigInt(data.fields.root),
			innerNode: PerpetualsCasting.innerNodeFromAny(data.fields.inner_nodes),
			outerNode: PerpetualsCasting.outerNodeFromAny(data.fields.outer_nodes),
		} as CritBitTree<Order>;
	};

	public static innerNodeFromAny = (data: any): InnerNode[] => {
		const innerNodes: InnerNode[] = [];
		for (const node of data) {
			innerNodes.push({
				criticalBit: BigInt(node.fields.critical_bit),
				parentIndex: BigInt(node.fields.parent_index),
				leftChildIndex: BigInt(node.fields.left_child_index),
				rightChildIndex: BigInt(node.fields.right_child_index),
			} as InnerNode);
		}
		return innerNodes;
	};

	public static outerNodeFromAny = (data: any): OuterNode<Order>[] => {
		const outerNodes: OuterNode<Order>[] = [];
		for (const node of data) {
			outerNodes.push({
				key: new BN(node.fields.key as string),
				value: PerpetualsCasting.orderFromAny(node.fields.value),
				parentIndex: BigInt(node.fields.parent_index),
			} as OuterNode<Order>);
		}
		return outerNodes;
	};

	public static orderFromAny = (data: any): Order => {
		return {
			user: data.fields.user,
			accountId: BigInt(data.fields.account_id),
			size: BigInt(data.fields.size),
		} as Order;
	};

	public static orderbookFromRawData = (data: any): Orderbook => {
		return {
			objectId: data.id.id,
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			asks: PerpetualsCasting.critBitTreeFromAny(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny(data.bids),
			minAsk: BigInt(data.min_ask),
			minBid: BigInt(data.max_bid),
			counter: BigInt(data.counter),
		} as Orderbook;
	};

	public static priorityQueueOfOrdersFromCritBitTree = (
		tree: CritBitTree<Order>,
		direction: boolean
	): PriorityQueue<OrderCasted> => {
		const comparator: Function = direction
			? compareAskOrders
			: compareBidOrders;
		const priorityQueue = new PriorityQueue<OrderCasted>(
			tree.outerNode.length,
			comparator
		);
		for (const node of tree.outerNode) {
			const orderId = node.key;
			const order = node.value;
			const priceOfOrder = price(orderId);
			const counter = direction ? counterAsk(orderId) : counterBid(orderId);
			const insertedOrder = {
				user: order.user,
				accountId: order.accountId,
				size: order.size,
				price: priceOfOrder,
				counter: counter,
			} as OrderCasted;
			priorityQueue.add(insertedOrder);
		}
		return priorityQueue;
	};

	public static priorityQueuesOfOrdersFromOrderbook = (
		orderbook: Orderbook
	): PriorityQueue<OrderCasted>[] => {
		const priorityQueueOfAskOrders = PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
			orderbook.asks,
			ASK
		);
		const priorityQueueOfBidOrders = PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
			orderbook.bids,
			BID
		);
		return [priorityQueueOfAskOrders, priorityQueueOfBidOrders];
	};

	/////////////////////////////////////////////////////////////////////
	//// Oracle
	/////////////////////////////////////////////////////////////////////
	public static priceFeedStorageFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeedStorage => {
		return {
			objectId: getObjectId(data),
		} as PriceFeedStorage;
	};

	public static priceFeedFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PriceFeed => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectId: getObjectId(data),
			symbol: objectFields.symbol,
			price: objectFields.price,
			decimal: objectFields.decimal,
			timestamp: objectFields.timestamp,
		} as PriceFeed;
	};

}
import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	PerpetualsAccountManagerObject,
	PerpetualsMarketManagerObject,
	PerpetualsMarketState,
	PerpetualsPriceFeedObject,
	PerpetualsPriceFeedStorageObject,
	PerpetualsOrderbookObject,
	PerpetualsOrder,
	PerpetualsCritBitTree,
	PerpetualsOrderCasted,
	PerpetualsMarketManagerDynamicFieldOnChain,
	PerpetualsMarketParamsDynamicFieldOnChain,
	PerpetualsMarketParamsDynamicField,
	PerpetualsMarketParams,
	PerpetualsMarketOrderbookDynamicFieldObject,
	PerpetualsMarketStateDynamicField,
	PerpetualsMarketOrderbookDynamicFieldOnChain,
	PerpetualsMarketManagerStateDynamicFieldOnChain,
	PerpetualsInnerNode,
	PerpetualsOuterNode,
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
import { Helpers } from "../../../general/utils";

export class PerpetualsCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================
	public static accountManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountManagerObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			maxPositionsPerAccount: objectFields.max_positions_per_account,
			maxOpenOrdersPerPosition: objectFields.max_open_orders_per_position,
		};
	};

	// =========================================================================
	//  Market Manager
	// =========================================================================
	public static marketManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsMarketManagerObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			feesAccrued: objectFields.fees_accrued,
			netTransferFromIfToVault: objectFields.net_transfer_from_if,
			minOrderUsdValue: objectFields.min_order_usd_value,
			marketIds: objectFields.market_ids,
		};
	};

	public static marketParamsDynamicFieldFromOnChain = (
		dynamicField: PerpetualsMarketManagerDynamicFieldOnChain
	): PerpetualsMarketParamsDynamicField => {
		if (!isMarketManagerParamsKeyType(dynamicField.data.type))
			throw new Error("not params key type");
		const paramsField =
			dynamicField as PerpetualsMarketParamsDynamicFieldOnChain;
		return {
			value: PerpetualsCasting.marketParamsFromRawData(
				paramsField.data.fields.value.fields
			),
		};
	};

	public static marketManagerStateDynamicFieldFromOnChain = (
		dynamicField: PerpetualsMarketManagerDynamicFieldOnChain
	): PerpetualsMarketStateDynamicField => {
		if (!isMarketManagerStateKeyType(dynamicField.data.type))
			throw new Error("not state key type");
		const stateField =
			dynamicField as PerpetualsMarketManagerStateDynamicFieldOnChain;
		return {
			value: PerpetualsCasting.marketStateFromRawData(
				stateField.data.fields
			),
		};
	};

	public static marketManagerOrderbookDynamicFieldFromOnChain = async (
		dynamicField: PerpetualsMarketManagerDynamicFieldOnChain
	): Promise<PerpetualsMarketOrderbookDynamicFieldObject> => {
		if (!isMarketManagerOrderbookKeyType(dynamicField.data.type))
			throw new Error("not order book key type");
		const orderbookField =
			dynamicField as PerpetualsMarketOrderbookDynamicFieldOnChain;

		const objectType = dynamicField.data.type;

		return {
			objectType,
			objectId: orderbookField.data.fields.id.id,
			value: PerpetualsCasting.orderbookFromRawData(orderbookField.data),
		};
	};

	public static marketParamsFromRawData = (
		data: any
	): PerpetualsMarketParams => {
		return {
			marginRatioInitial: data.margin_ratio_initial,
			marginRatioMaintenance: data.margin_ratio_maintenance,
			baseAssetSymbol: data.base_asset_symbol,
			fundingFrequencyMs: BigInt(data.funding_frequency_ms),
			fundingPeriodMs: BigInt(data.funding_period_ms),
			twapPeriodMs: BigInt(data.twap_period_ms),
			makerFee: data.maker_fee,
			takerFee: data.taker_fee,
			liquidationFee: data.liquidation_fee,
			forceCancelFee: data.force_cancel_fee,
			insuranceFundFee: data.insurance_fund_fee,
			priceImpactFactor: data.price_impact_factor,
		};
	};

	public static marketStateFromRawData = (
		data: any
	): PerpetualsMarketState => {
		return {
			cumulativeFundingRate: data.cum_funding_rate,
			fundingRateTimestamp: Number(data.funding_rate_ts),
			lastIndexPrice: data.last_index_price,
			lastIndexTwap: data.last_index_ts,
			lastIndexTimestamp: Number(data.last_index_ts),
			lastMarkPrice: data.last_mark_price,
			lastMarkTwap: data.last_mark_price,
			lastMarkTimestamp: Number(data.last_mark_ts),
			openInterest: data.open_interest,
		};
	};

	// =========================================================================
	//  Orderbook
	// =========================================================================
	public static critBitTreeFromAny = (
		data: any
	): PerpetualsCritBitTree<PerpetualsOrder> => {
		return {
			root: BigInt(data.fields.root),
			innerNode: PerpetualsCasting.innerNodeFromAny(
				data.fields.inner_nodes
			),
			outerNode: PerpetualsCasting.outerNodeFromAny(
				data.fields.outer_nodes
			),
		};
	};

	public static innerNodeFromAny = (data: any): PerpetualsInnerNode[] => {
		const innerNodes: PerpetualsInnerNode[] = [];
		for (const node of data) {
			innerNodes.push({
				criticalBit: BigInt(node.fields.critical_bit),
				parentIndex: BigInt(node.fields.parent_index),
				leftChildIndex: BigInt(node.fields.left_child_index),
				rightChildIndex: BigInt(node.fields.right_child_index),
			} as PerpetualsInnerNode);
		}
		return innerNodes;
	};

	public static outerNodeFromAny = (
		data: any
	): PerpetualsOuterNode<PerpetualsOrder>[] => {
		const outerNodes: PerpetualsOuterNode<PerpetualsOrder>[] = [];
		for (const node of data) {
			outerNodes.push({
				key: node.fields.key,
				value: PerpetualsCasting.orderFromAny(node.fields.value),
				parentIndex: BigInt(node.fields.parent_index),
			} as PerpetualsOuterNode<PerpetualsOrder>);
		}
		return outerNodes;
	};

	public static orderFromAny = (data: any): PerpetualsOrder => {
		return {
			user: data.fields.user,
			accountId: BigInt(data.fields.account_id),
			size: BigInt(data.fields.size),
		};
	};

	public static orderbookFromRawData = (
		data: any
	): PerpetualsOrderbookObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return {
			objectType,
			objectId: data.id.id,
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			asks: PerpetualsCasting.critBitTreeFromAny(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny(data.bids),
			minAsk: BigInt(data.min_ask),
			minBid: BigInt(data.max_bid),
			counter: BigInt(data.counter),
		};
	};

	public static priorityQueueOfOrdersFromCritBitTree = (
		tree: PerpetualsCritBitTree<PerpetualsOrder>,
		direction: boolean
	): PriorityQueue<PerpetualsOrderCasted> => {
		const comparator: Function = direction
			? compareAskOrders
			: compareBidOrders;
		const priorityQueue = new PriorityQueue<PerpetualsOrderCasted>(
			tree.outerNode.length,
			comparator
		);
		for (const node of tree.outerNode) {
			const orderId = node.key;
			const order = node.value;
			const priceOfOrder = price(orderId);
			const counter = direction
				? counterAsk(orderId)
				: counterBid(orderId);
			const insertedOrder = {
				user: order.user,
				accountId: order.accountId,
				size: order.size,
				price: priceOfOrder,
				counter: counter,
			} as PerpetualsOrderCasted;
			priorityQueue.add(insertedOrder);
		}
		return priorityQueue;
	};

	public static priorityQueuesOfOrdersFromOrderbook = (
		orderbook: PerpetualsOrderbookObject
	): PriorityQueue<PerpetualsOrderCasted>[] => {
		const priorityQueueOfAskOrders =
			PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
				orderbook.asks,
				ASK
			);
		const priorityQueueOfBidOrders =
			PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
				orderbook.bids,
				BID
			);
		return [priorityQueueOfAskOrders, priorityQueueOfBidOrders];
	};

	// =========================================================================
	//  Oracle
	// =========================================================================
	public static priceFeedStorageFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsPriceFeedStorageObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
		};
	};

	public static priceFeedFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsPriceFeedObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			symbol: objectFields.symbol,
			price: objectFields.price,
			decimal: objectFields.decimal,
			timestamp: objectFields.timestamp,
		};
	};
}

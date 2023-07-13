import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectId,
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
    PerpetualsAccountStruct,
    PerpetualsPosition,
    TableV,
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
import { Table } from "../../../general/types";

export class PerpetualsCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================
	public static accountManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountManagerObject => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectId: getObjectId(data),
			maxPositionsPerAccount: objectFields.max_positions_per_account,
			maxPendingOrdersPerPosition:
				objectFields.max_pending_orders_per_position,
			nextAccountId: objectFields.next_account_id,
		};
	};

	public static accountFromSuiDynamicFieldObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsAccountStruct => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		const value = objectFields.value.fields;
		return {
			collateral: value.collateral,
			marketIds: value.market_ids.map((id: any) => BigInt(id)),
			positions: value.positions.map(
				(p: any) => PerpetualsCasting.positionFromRawData(p)
			),
		};
	};

	public static positionFromRawData = (
		data: any
	): PerpetualsPosition => {
		data = data.fields;
		return {
			baseAssetAmount: data.base_asset_amount,
			quoteAssetNotionalAmount: data.quote_asset_notional_amount,
			cumFundingRateLong: data.cum_funding_rate_long,
			cumFundingRateShort: data.cum_funding_rate_short,
			asks: PerpetualsCasting.critBitTreeFromAny<bigint>(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny<bigint>(data.bids),
			asksQuantity: data.asks_quantity,
			bidsQuantity: data.bids_quantity,
		}
	}

	// =========================================================================
	//  Market Manager
	// =========================================================================
	public static marketManagerFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsMarketManagerObject => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectId: getObjectId(data),
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
		return {
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

	public static outerNodeFromSuiDynamicFieldObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsOuterNode<bigint> => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		const value = objectFields.value.fields;
		return {
			key: BigInt(value.key),
			value: BigInt(value.value),
			parentIndex: BigInt(value.parent_index),
		};
	};

	public static critBitTreeFromAny<T>(
		data: any
	): PerpetualsCritBitTree<T> {
		data = data.fields;
		return {
			root: BigInt(data.root),
			innerNodes: PerpetualsCasting.tableVFromAny<PerpetualsInnerNode>(
				data.inner_nodes
			),
			outerNodes: PerpetualsCasting
				.tableVFromAny<PerpetualsOuterNode<T>>(
					data.outer_nodes
				),
		};
	};

	public static tableVFromAny<T>(data: any): TableV<T> {
		return {
			contents: PerpetualsCasting.tableFromAny<number, T>(data.fields.contents),
		};
	}

	public static tableFromAny<K, V>(data: any): Table<K, V> {
		return {
			objectId: data.fields.id.id,
			size: data.fields.size,
		}
	}

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
			accountId: BigInt(data.fields.account_id),
			size: BigInt(data.fields.size),
		};
	};

	public static orderbookFromRawData = (
		data: any
	): PerpetualsOrderbookObject => {
		return {
			objectId: data.id.id,
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			asks: PerpetualsCasting.critBitTreeFromAny<PerpetualsOrder>(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny<PerpetualsOrder>(data.bids),
			minAsk: BigInt(data.min_ask),
			minBid: BigInt(data.max_bid),
			counter: BigInt(data.counter),
		};
	};

	public static priorityQueueOfOrdersFromCritBitTree = async (
		tree: PerpetualsCritBitTree<PerpetualsOrder>,
		direction: boolean
	): Promise<PriorityQueue<PerpetualsOrderCasted>> => {
		const comparator: Function = direction
			? compareAskOrders
			: compareBidOrders;
		const priorityQueue = new PriorityQueue<PerpetualsOrderCasted>(
			tree.outerNodes.contents.size,
			comparator
		);
		// TODO: implement fetching the table vec from the network
		// for (const node of tree.outerNodes) {
		// 	const orderId = node.key;
		// 	const order = node.value;
		// 	const priceOfOrder = price(orderId);
		// 	const counter = direction
		// 		? counterAsk(orderId)
		// 		: counterBid(orderId);
		// 	const insertedOrder = {
		// 		accountId: order.accountId,
		// 		size: order.size,
		// 		price: priceOfOrder,
		// 		counter: counter,
		// 	} as PerpetualsOrderCasted;
		// 	priorityQueue.add(insertedOrder);
		// }
		return priorityQueue;
	};

	public static priorityQueuesOfOrdersFromOrderbook = async (
		orderbook: PerpetualsOrderbookObject
	): Promise<PriorityQueue<PerpetualsOrderCasted>[]> => {
		const priorityQueueOfAskOrders =
			await PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
				orderbook.asks,
				ASK
			);
		const priorityQueueOfBidOrders =
			await PerpetualsCasting.priorityQueueOfOrdersFromCritBitTree(
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
		return {
			objectId: getObjectId(data),
		};
	};

	public static priceFeedFromSuiObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsPriceFeedObject => {
		const objectFields = getObjectFields(data) as ObjectContentFields;
		return {
			objectId: getObjectId(data),
			symbol: objectFields.symbol,
			price: objectFields.price,
			decimal: objectFields.decimal,
			timestamp: objectFields.timestamp,
		};
	};
}

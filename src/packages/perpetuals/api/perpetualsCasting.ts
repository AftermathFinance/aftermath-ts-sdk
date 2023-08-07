import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectId,
	getObjectType,
    SuiRawMoveObject,
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
	AccountStruct,
    PerpetualsPosition,
    TableV,
    bcs,
} from "../perpetualsTypes";
import PriorityQueue from "priority-queue-typescript";
import {
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
			maxPendingOrdersPerPosition:
				objectFields.max_pending_orders_per_position,
			nextAccountId: objectFields.next_account_id,
		};
	};

	public static accountFromSuiDynamicFieldObjectResponse = (
		data: SuiObjectResponse
	): AccountStruct => {
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

	public static accountFromRawData = (
		data: any
	): AccountStruct => {
		return {
			collateral: BigInt(data.collateral),
			marketIds: data.marketIds.map((id: number) => BigInt(id)),
			positions: data.positions.map((pos: any) => PerpetualsCasting.positionFromRawData(pos)),
		}
	}

	public static positionFromRawData = (
		data: any
	): PerpetualsPosition => {
		return {
			baseAssetAmount: BigInt(data.baseAssetAmount),
			quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			asks: PerpetualsCasting.critBitTreeFromAny<bigint>(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny<bigint>(data.bids),
			asksQuantity: BigInt(data.asksQuantity),
			bidsQuantity: BigInt(data.bidsQuantity),
		}
	}

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

	public static outerNodeFromSuiDynamicFieldObjectResponse = (
		data: SuiObjectResponse
	): PerpetualsOuterNode<bigint> => {
		const rawObj = data.data?.bcs! as SuiRawMoveObject;
		const outerNode = bcs.de("OuterNode<u64>", rawObj.bcsBytes, "base64");
		return {
			key: BigInt(outerNode.key),
			value: BigInt(outerNode.value),
			parentIndex: BigInt(outerNode.parent_index),
		};
	};

	public static critBitTreeFromAny<T>(
		data: any
	): PerpetualsCritBitTree<T> {
		return {
			root: BigInt(data.root),
			innerNodes: PerpetualsCasting.tableVFromAny<PerpetualsInnerNode>(
				data.innerNodes
			),
			outerNodes: PerpetualsCasting
				.tableVFromAny<PerpetualsOuterNode<T>>(
					data.outerNodes
				),
		};
	};

	public static tableVFromAny<T>(data: any): TableV<T> {
		return {
			contents: PerpetualsCasting.tableFromAny<number, T>(data.contents),
		};
	}

	public static tableFromAny<K, V>(data: any): Table<K, V> {
		return {
			objectId: data.id.id,
			size: data.size,
		}
	}

	public static innerNodeFromAny = (data: any): PerpetualsInnerNode[] => {
		const innerNodes: PerpetualsInnerNode[] = [];
		for (const node of data) {
			innerNodes.push({
				criticalBit: BigInt(node.criticalBit),
				parentIndex: BigInt(node.parentIndex),
				leftChildIndex: BigInt(node.leftChildIndex),
				rightChildIndex: BigInt(node.rightChildIndex),
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
				key: BigInt(node.key),
				value: PerpetualsCasting.orderFromAny(node.value),
				parentIndex: BigInt(node.parentIndex),
			} as PerpetualsOuterNode<PerpetualsOrder>);
		}
		return outerNodes;
	};

	public static orderFromAny = (data: any): PerpetualsOrder => {
		return {
			accountId: BigInt(data.accountId),
			size: BigInt(data.size),
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

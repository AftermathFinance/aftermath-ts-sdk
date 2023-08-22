import { TypeName } from "@mysten/bcs";
import {
	SuiObjectResponse,
	ObjectContentFields,
	getObjectFields,
	getObjectType,
    SuiRawMoveObject,
} from "@mysten/sui.js";
import {
	AccountManager,
	AccountManagerObj,
	MarketState,
	Orderbook,
	Order,
	CritBitTree,
	OrderCasted,
	MarketManagerDynamicFieldOnChain,
	MarketParamsDynamicFieldOnChain,
	MarketParamsDynamicField,
	MarketParams,
	MarketOrderbookDynamicFieldObject,
	MarketStateDynamicField,
	MarketOrderbookDynamicFieldOnChain,
	MarketManagerStateDynamicFieldOnChain,
	InnerNode,
	OuterNode,
	AccountStruct,
    Position,
    TableV,
    bcs,
    MarketManagerObj,
    MarketManager,
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

export class PerpetualsCasting {
	// =========================================================================
	//  Account Manager
	// =========================================================================
	public static accountManagerObjFromSuiObjectResponse = (
		data: SuiObjectResponse
	): AccountManagerObj => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const contents = PerpetualsCasting.castObjectBcs({
			resp: data,
			typeName: "AccountManager",
			fromDeserialized: PerpetualsCasting.accountManagerFromRaw,
		})

		return {
			objectType,
			objectId: contents.id,
			...contents
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
	): Position => {
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
	public static marketManagerObjFromSuiObjectResponse = (
		data: SuiObjectResponse
	): MarketManagerObj => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const contents = PerpetualsCasting.castObjectBcs({
			resp: data,
			typeName: "MarketManager",
			fromDeserialized: PerpetualsCasting.marketManagerFromRaw,
		})

		return {
			objectType,
			objectId: contents.id,
			...contents
		};
	};

	public static marketParamsDynamicFieldFromOnChain = (
		dynamicField: MarketManagerDynamicFieldOnChain
	): MarketParamsDynamicField => {
		if (!isMarketManagerParamsKeyType(dynamicField.data.type))
			throw new Error("not params key type");
		const paramsField =
			dynamicField as MarketParamsDynamicFieldOnChain;
		return {
			value: PerpetualsCasting.marketParamsFromRawBcs(
				paramsField.data.fields.value.fields
			),
		};
	};

	public static marketManagerStateDynamicFieldFromOnChain = (
		dynamicField: MarketManagerDynamicFieldOnChain
	): MarketStateDynamicField => {
		if (!isMarketManagerStateKeyType(dynamicField.data.type))
			throw new Error("not state key type");
		const stateField =
			dynamicField as MarketManagerStateDynamicFieldOnChain;
		return {
			value: PerpetualsCasting.marketStateFromRawBcs(
				stateField.data.fields
			),
		};
	};

	public static marketManagerOrderbookDynamicFieldFromOnChain = async (
		dynamicField: MarketManagerDynamicFieldOnChain
	): Promise<MarketOrderbookDynamicFieldObject> => {
		if (!isMarketManagerOrderbookKeyType(dynamicField.data.type))
			throw new Error("not order book key type");
		const orderbookField =
			dynamicField as MarketOrderbookDynamicFieldOnChain;

		const objectType = dynamicField.data.type;

		return {
			objectType,
			objectId: orderbookField.data.fields.id.id,
			value: PerpetualsCasting.orderbookFromRawData(orderbookField.data),
		};
	};

	public static marketParamsFromRawBcs = (
		data: any
	): MarketParams => {
		return {
			baseAssetSymbol: data.baseAssetSymbol,
			marginRatioInitial: BigInt(data.marginRatioInitial),
			marginRatioMaintenance: BigInt(data.marginRatioMaintenance),
			fundingFrequencyMs: BigInt(data.fundingFrequencyMs),
			fundingPeriodMs: BigInt(data.fundingPeriodMs),
			premiumTwapFrequencyMs: BigInt(data.premiumTwapFrequencyMs),
			premiumTwapPeriodMs: BigInt(data.premiumTwapPeriodMs),
			spreadTwapFrequencyMs: BigInt(data.spreadTwapFrequencyMs),
			spreadTwapPeriodMs: BigInt(data.spreadTwapPeriodMs),
			makerFee: BigInt(data.makerFee),
			takerFee: BigInt(data.takerFee),
			liquidationFee: BigInt(data.liquidationFee),
			forceCancelFee: BigInt(data.forceCancelFee),
			insuranceFundFee: BigInt(data.insuranceFundFee),
			insuranceFundId: BigInt(data.insuranceFundId),
		};
	};

	public static marketStateFromRawBcs = (
		data: any
	): MarketState => {
		return {
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			fundingLastUpdMs: Number(data.fundingLastUpdMs),
			premiumTwap: BigInt(data.premiumTwap),
			premiumTwapLastUpdMs: Number(data.premiumTwapLastUpdMs),
			spreadTwap: BigInt(data.spreadTwap),
			spreadTwapLastUpdMs: Number(data.spreadTwapLastUpdMs),
			openInterest: BigInt(data.openInterest),
		};
	};

	// =========================================================================
	//  Orderbook
	// =========================================================================

	public static outerNodeFromSuiDynamicFieldObjectResponse = (
		data: SuiObjectResponse
	): OuterNode<bigint> => {
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
	): CritBitTree<T> {
		return {
			root: BigInt(data.root),
			innerNodes: PerpetualsCasting.tableVFromAny<InnerNode>(
				data.innerNodes
			),
			outerNodes: PerpetualsCasting
				.tableVFromAny<OuterNode<T>>(
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

	public static innerNodeFromAny = (data: any): InnerNode[] => {
		const innerNodes: InnerNode[] = [];
		for (const node of data) {
			innerNodes.push({
				criticalBit: BigInt(node.criticalBit),
				parentIndex: BigInt(node.parentIndex),
				leftChildIndex: BigInt(node.leftChildIndex),
				rightChildIndex: BigInt(node.rightChildIndex),
			} as InnerNode);
		}
		return innerNodes;
	};

	public static outerNodeFromAny = (
		data: any
	): OuterNode<Order>[] => {
		const outerNodes: OuterNode<Order>[] = [];
		for (const node of data) {
			outerNodes.push({
				key: BigInt(node.key),
				value: PerpetualsCasting.orderFromAny(node.value),
				parentIndex: BigInt(node.parentIndex),
			} as OuterNode<Order>);
		}
		return outerNodes;
	};

	public static orderFromAny = (data: any): Order => {
		return {
			accountId: BigInt(data.accountId),
			size: BigInt(data.size),
		};
	};

	public static orderbookFromRawData = (
		data: any
	): Orderbook => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		return {
			objectType,
			objectId: data.id.id,
			lotSize: BigInt(data.lot_size),
			tickSize: BigInt(data.tick_size),
			asks: PerpetualsCasting.critBitTreeFromAny<Order>(data.asks),
			bids: PerpetualsCasting.critBitTreeFromAny<Order>(data.bids),
			minAsk: BigInt(data.min_ask),
			minBid: BigInt(data.max_bid),
			counter: BigInt(data.counter),
		};
	};

	public static priorityQueueOfOrdersFromCritBitTree = async (
		tree: CritBitTree<Order>,
		direction: boolean
	): Promise<PriorityQueue<OrderCasted>> => {
		const comparator: Function = direction
			? compareAskOrders
			: compareBidOrders;
		const priorityQueue = new PriorityQueue<OrderCasted>(
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
		orderbook: Orderbook
	): Promise<PriorityQueue<OrderCasted>[]> => {
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
	//  Types from raw deserialized BCS
	// =========================================================================

	public static accountManagerFromRaw(data: any): AccountManager {
		return {
			id: data.id,
			maxPositionsPerAccount: BigInt(data.maxPositionsPerAccount),
			maxPendingOrdersPerPosition: BigInt(data.maxPendingOrdersPerPosition),
			nextAccountId: BigInt(data.nextAccountId),
		};
	}

	public static marketManagerFromRaw(data: any): MarketManager {
		return {
			id: data.id,
			feesAccrued: BigInt(data.feesAccrued),
			minOrderUsdValue: BigInt(data.minOrderUsdValue),
			liquidationTolerance: BigInt(data.liquidationTolerance),
		}
	}

	public static accountFromRaw(data: any): AccountStruct {
		return {
			collateral: BigInt(data.collateral),
			marketIds: data.marketIds.map((id: number) => BigInt(id)),
			positions: data.positions.map((pos: any) => PerpetualsCasting.positionFromRaw(pos)),
		};
	}

	public static positionFromRaw(data: any): Position {
		return {
			baseAssetAmount: BigInt(data.baseAssetAmount),
			quoteAssetNotionalAmount: BigInt(data.quoteAssetNotionalAmount),
			cumFundingRateLong: BigInt(data.cumFundingRateLong),
			cumFundingRateShort: BigInt(data.cumFundingRateShort),
			asks: PerpetualsCasting.critBitTreeFromRaw<bigint>(data.asks),
			bids: PerpetualsCasting.critBitTreeFromRaw<bigint>(data.bids),
			asksQuantity: BigInt(data.asksQuantity),
			bidsQuantity: BigInt(data.bidsQuantity),
		}
	}

	public static critBitTreeFromRaw<T>(
		data: any,
	): CritBitTree<T> {
		return {
			root: BigInt(data.root),
			innerNodes: PerpetualsCasting.tableVFromRaw<InnerNode>(data.innerNodes),
			outerNodes: PerpetualsCasting.tableVFromRaw<OuterNode<T>>(
				data.outerNodes,
			),
		};
	}

	public static innerNodeFromRaw(data: any): InnerNode {
		return {
			criticalBit: BigInt(data.criticalBit),
			parentIndex: BigInt(data.parentIndex),
			leftChildIndex: BigInt(data.leftChildren),
			rightChildIndex: BigInt(data.rightChildren),
		}
	}

	public static outerNodeFromRawPartial<T>(
		valueFromRaw: (v: any) => T
	): (v: any) => OuterNode<T> {
		return (v: any) => PerpetualsCasting.outerNodeFromRaw(v, valueFromRaw);
	}

	public static outerNodeFromRaw<T>(
		data: any,
		valueFromRaw: (v: any) => T
	): OuterNode<T> {
		return {
			key: BigInt(data.key),
			value: valueFromRaw(data.value),
			parentIndex: BigInt(data.parentIndex),
		}
	}

	public static tableVFromRaw<T>(
		data: any,
	): TableV<T> {
		return {
			contents: PerpetualsCasting.tableFromRaw<number, T>(data.contents),
		};
	}

	public static tableFromRaw<K, V>(data: any): Table<K, V> {
		return {
			objectId: data.id,
			size: data.size,
		};
	}

	// =========================================================================
	//  General
	// =========================================================================

	public static castObjectBcs = <T>(inputs: {
        resp: SuiObjectResponse;
        typeName: TypeName;
        fromDeserialized: (deserialized: any) => T;
    }): T => {
        const { resp, typeName, fromDeserialized } = inputs;
        const rawObj = resp.data?.bcs as SuiRawMoveObject;
        const deserialized = bcs.de(typeName, rawObj.bcsBytes, "base64");
        return fromDeserialized(deserialized);
    }
}

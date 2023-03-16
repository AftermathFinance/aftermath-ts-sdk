import { ObjectId } from "@mysten/sui.js";
import { CoinType } from "../../coin/coinTypes";
import { Pool } from "../../pools";
import { Helpers } from "../../../general/utils/helpers";
import {
	Balance,
	RouterCompleteTradeRoute,
	RouterTradeRoute,
} from "../../../types";

/////////////////////////////////////////////////////////////////////
//// Internal Types
/////////////////////////////////////////////////////////////////////

interface CoinGraph {
	coinNodes: CoinNodes;
	pools: Pools;
}

type CoinNodes = Record<CoinType, CoinNode>;
type Pools = Record<ObjectId, Pool>;

interface CoinNode {
	coin: CoinType;
	toCoinThroughPoolEdges: ToCoinThroughPoolEdges;
}

type ToCoinThroughPoolEdges = Record<CoinType, ObjectId[]>;

/////////////////////////////////////////////////////////////////////
//// Class
/////////////////////////////////////////////////////////////////////

export class RouterGraph {
	/////////////////////////////////////////////////////////////////////
	//// Private Static Contstants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		// NOTE: should this default value be public ?
		defaultMaxRouteLength: 5,
		tradePartitionCount: BigInt(1000),
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Class Members
	/////////////////////////////////////////////////////////////////////

	private readonly graph: CoinGraph;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly pools: Pool[]) {
		if (pools.length <= 0) throw new Error("pools has length of 0");
		// check handle remove duplicate pools (same object Id)
		this.pools = pools;
		this.graph = RouterGraph.createGraph(pools);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	public getRoutes(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: Number = RouterGraph.constants.defaultMaxRouteLength
	): RouterCompleteTradeRoute {
		const routes = RouterGraph.findRoutes(
			this.graph,
			coinIn,
			coinInAmount,
			coinOut,
			maxRouteLength
		);

		const completeRoute = RouterGraph.completeRouteFromRoutes(
			routes,
			coinIn,
			coinInAmount,
			coinOut
		);

		return completeRoute;
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Graph Creation
	/////////////////////////////////////////////////////////////////////

	private static createGraph(pools: Pool[]): CoinGraph {
		const graph: CoinGraph = pools.reduce(
			(graph, pool) => {
				const coinNodes = RouterGraph.updateCoinNodesFromPool(
					graph.coinNodes,
					pool
				);
				const pools: Pools = {
					...graph.pools,
					[pool.pool.objectId]: pool,
				};

				return {
					coinNodes,
					pools,
				};
			},
			{
				coinNodes: {},
				pools: {},
			}
		);
		return graph;
	}

	private static updateCoinNodesFromPool = (
		coinNodes: CoinNodes,
		pool: Pool
	): CoinNodes => {
		const poolObject = pool.pool;

		let newCoinNodes: CoinNodes = { ...coinNodes };

		for (const [index, coinA] of poolObject.fields.coins
			.slice(0, -1)
			.entries()) {
			for (const coinB of poolObject.fields.coins.slice(index + 1)) {
				newCoinNodes =
					coinA in newCoinNodes
						? {
								...newCoinNodes,
								[coinA]: {
									...newCoinNodes[coinA],
									toCoinThroughPoolEdges:
										coinB in
										newCoinNodes[coinA]
											.toCoinThroughPoolEdges
											? {
													...newCoinNodes[coinA]
														.toCoinThroughPoolEdges,
													[coinB]:
														Helpers.uniqueArray([
															...newCoinNodes[
																coinA
															]
																.toCoinThroughPoolEdges[
																coinB
															],
															poolObject.objectId,
														]),
											  }
											: {
													...newCoinNodes[coinA]
														.toCoinThroughPoolEdges,
													[coinB]: [
														poolObject.objectId,
													],
											  },
								},
						  }
						: {
								...newCoinNodes,
								[coinA]: {
									coin: coinA,
									toCoinThroughPoolEdges: {
										[coinB]: [poolObject.objectId],
									},
								},
						  };
			}
		}

		return newCoinNodes;
	};

	/////////////////////////////////////////////////////////////////////
	//// Route Finding
	/////////////////////////////////////////////////////////////////////

	private static findRoutes = (
		graph: CoinGraph,
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength: Number
	): RouterTradeRoute[] => {
		const coinInEdges = graph.coinNodes[coinIn].toCoinThroughPoolEdges;
		const startingRoutes = RouterGraph.createStartingRoutes(
			coinInEdges,
			coinIn,
			coinOut,
			coinInAmount
		);

		const routes = RouterGraph.findCompleteRoutes(startingRoutes);

		return routes;
	};

	private static createStartingRoutes = (
		coinInEdges: ToCoinThroughPoolEdges,
		coinIn: CoinType,
		coinOut: CoinType,
		coinInAmount: Balance
	): RouterTradeRoute[] => {
		let routes: RouterTradeRoute[] = [];
		for (const [toCoin, throughPools] of Object.entries(coinInEdges)) {
			for (const poolObjectId of throughPools) {
				routes.push({
					coinIn,
					coinOut,
					coinInAmount,
					coinOutAmount: BigInt(0),
					tradeFee: BigInt(0),
					spotPrice: 0,
					paths: [
						{
							poolObjectId,
							coinIn,
							coinOut: toCoin,
							coinInAmount: BigInt(0),
							coinOutAmount: BigInt(0),
							tradeFee: BigInt(0),
							spotPrice: 0,
						},
					],
				});
			}
		}

		return routes;
	};

	private static findCompleteRoutes = (
		routes: RouterTradeRoute[],
		maxRouteLength: Number
	): RouterTradeRoute[] => {
		let completeRoutes: RouterTradeRoute[] = [...routes];
		for (const [toCoin, throughPools] of Object.entries(coinInEdges)) {
			for (const poolObjectId of throughPools) {
				completeRoutes.push({
					coinIn,
					coinOut,
					coinInAmount,
					coinOutAmount: BigInt(0),
					tradeFee: BigInt(0),
					spotPrice: 0,
					paths: [
						{
							poolObjectId,
							coinIn,
							coinOut: toCoin,
							coinInAmount: BigInt(0),
							coinOutAmount: BigInt(0),
							tradeFee: BigInt(0),
							spotPrice: 0,
						},
					],
				});
			}
		}

		return completeRoutes;
	};

	private static isRouteComplete = (
		route: RouterTradeRoute,
		coinOut: CoinType
	): boolean =>
		route.paths.length > 0 &&
		route.paths[route.paths.length - 1].coinOut === coinOut;
}

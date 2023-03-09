import { ObjectId } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinType,
	Balance,
	PoolCompleteObject,
	PoolWeight,
} from "../../../types";
import { PoolsApiHelpers } from "../../pools/api/poolsApiHelpers";
import { Graph, GraphPath, Node, Route, RouterPath } from "../routerTypes";

export class RouterApiHelpers extends PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly Provider: AftermathApi) {
		super(Provider);

		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transcations
	/////////////////////////////////////////////////////////////////////

	public intermediateTradeTransactions = (
		path: RouterPath,
		fromCoinId: ObjectId
	) => {
		const coinId = fromCoinId;

		const tradeTransaction = this.tradeTransaction(
			path.pool.objectId,
			coinId,
			path.baseAsset,
			BigInt(0),
			path.quoteAsset,
			path.pool.fields.lpType
		);
		return [tradeTransaction];
	};

	/////////////////////////////////////////////////////////////////////
	//// Graph Creation
	/////////////////////////////////////////////////////////////////////

	protected static calcRouteSpotPrice = (route: Route) => {
		return route.path.reduce((acc, path) => path.spotPrice * acc, 1);
	};

	protected static newGraph = (): Graph => {
		const startingPoints = new Map();
		return {
			pools: {},
			startingPoints,
		};
	};

	protected static addPool = (graph: Graph, pool: PoolCompleteObject) => {
		const coinTypes = pool.pool.fields.coins;

		const balances: { [key: CoinType]: Balance } = {};
		for (const amount of pool.dynamicFields.amountFields)
			balances[amount.coin] = amount.value;

		const weights: { [key: CoinType]: PoolWeight } = {};
		for (let i = 0; i < coinTypes.length; ++i)
			weights[coinTypes[i]] = pool.pool.fields.weights[i];

		const tradeFee = pool.pool.fields.tradeFee;

		const g = graph.startingPoints;
		pool.pool.fields.coins.map((coinType: CoinType) => {
			if (!g.has(coinType))
				g.set(coinType, {
					sourceNode: { coinType },
					routes: [],
				});
		});

		for (let i = 0; i < coinTypes.length; ++i) {
			for (let j = i + 1; j < coinTypes.length; ++j) {
				const nodeI = g.get(coinTypes[i]);
				const nodeJ = g.get(coinTypes[j]);
				if (!nodeI || !nodeJ) throw Error("impossible internal error");
				nodeI.routes.push({
					nodeFrom: nodeI.sourceNode,
					nodeTo: nodeJ.sourceNode,
					alongPool: {
						source: pool,
						balances: Object.assign({}, balances),
						originalBalances: balances,
						weights,
						tradeFee: tradeFee,
					},
					// spotPrice: indicesPoolCalcSpotPrice(
					// 	balances[coinTypes[i]],
					// 	weights[coinTypes[i]],
					// 	balances[coinTypes[j]],
					// 	weights[coinTypes[j]]
					// ),
					spotPrice: 0,
				});
				nodeJ.routes.push({
					nodeFrom: nodeJ.sourceNode,
					nodeTo: nodeI.sourceNode,
					alongPool: {
						source: pool,
						balances: Object.assign({}, balances),
						originalBalances: balances,
						weights,
						tradeFee: tradeFee,
					},
					// spotPrice: indicesPoolCalcSpotPrice(
					// 	balances[coinTypes[j]],
					// 	weights[coinTypes[j]],
					// 	balances[coinTypes[i]],
					// 	weights[coinTypes[i]]
					// ),
					spotPrice: 0,
				});
			}
		}
	};

	protected static pathStart = (path: GraphPath): Node => path[0].nodeFrom;

	protected static pathEnd = (path: GraphPath): Node =>
		path[path.length - 1].nodeTo;

	protected static shrinkCoinType = (coinType: CoinType): string =>
		coinType.split(":").pop() || "[empty]";

	protected static pathToString = (path: GraphPath): string => {
		let line = RouterApiHelpers.shrinkCoinType(path[0].nodeFrom.coinType);
		for (let step of path)
			line += ` --${
				step.alongPool.source.pool.fields.name
			}--> ${RouterApiHelpers.shrinkCoinType(step.nodeTo.coinType)}`;
		return line;
	};

	protected static getPaths = (
		graph: Graph,
		coinStart: CoinType,
		coinEnd: CoinType,
		maxLen: number
	): GraphPath[] => {
		const g = graph.startingPoints;
		let lastPaths: GraphPath[] = [];
		if (!g.has(coinStart) || !g.has(coinEnd) || maxLen < 1)
			return lastPaths;
		const graphError = Error("graph inconsistency");
		const starts = g.get(coinStart);
		if (!starts) throw graphError;
		lastPaths.splice(0, 0, ...starts.routes.map((edge) => [edge]));
		const allPaths: GraphPath[][] = [lastPaths];
		let pathLengths = 0;
		while (++pathLengths < maxLen) {
			let nextPaths: GraphPath[] = [];
			for (const path of lastPaths) {
				// find all steps out of the end of the existing path
				const steps = g.get(RouterApiHelpers.pathEnd(path).coinType);
				if (!steps) throw graphError;
				// concatenate and add to nextPaths
				nextPaths.splice(
					nextPaths.length,
					0,
					...steps.routes.map((step) => path.concat([step]))
				);
			}
			lastPaths = nextPaths;
			allPaths.push(lastPaths);
		}
		return allPaths
			.flat()
			.filter(
				(path) => RouterApiHelpers.pathEnd(path).coinType === coinEnd
			);
	};

	protected static getRoutes = (
		graph: Graph,
		coinStart: CoinType,
		coinEnd: CoinType,
		balanceStart: Balance,
		maxSteps: number
	): Route[] =>
		RouterApiHelpers.getPaths(graph, coinStart, coinEnd, maxSteps).map(
			(path) => {
				let balance = balanceStart;

				// reset pseudopool balances
				for (const poolName in graph.pools) {
					Object.assign(
						graph.pools[poolName].balances,
						graph.pools[poolName].originalBalances
					);
				}

				let prod = 1;

				// follow path and keep track of pool balances
				path.map((step) => {
					const pool = step.alongPool;
					const typeFrom = step.nodeFrom.coinType;
					const typeTo = step.nodeTo.coinType;
					// const newBalance = indicesPoolCalcOutGivenIn(
					// 	pool.balances[typeFrom],
					// 	pool.weights[typeFrom],
					// 	pool.balances[typeTo],
					// 	pool.weights[typeTo],
					// 	balance,
					// 	pool.tradeFee
					// );
					const newBalance = BigInt(0);
					pool.balances[typeFrom] += balance;
					pool.balances[typeTo] -= newBalance;
					balance = newBalance;
				});

				return {
					coinFrom: coinStart,
					coinTo: coinEnd,
					path: path,
					balanceIn: balanceStart,
					balanceOut: balance,
				};
			}
		);

	protected static getBestRoute = (
		graph: Graph,
		coinStart: CoinType,
		coinEnd: CoinType,
		balanceStart: Balance,
		maxSteps: number
	): Route => {
		const routes = RouterApiHelpers.getRoutes(
			graph,
			coinStart,
			coinEnd,
			balanceStart,
			maxSteps
		);
		let max: Balance = BigInt(0);
		let bestRoute: Route = routes[0];

		routes.map((route) => {
			if (max < route.balanceOut) {
				max = route.balanceOut;
				bestRoute = route;
			}
		});

		return bestRoute;
	};
}

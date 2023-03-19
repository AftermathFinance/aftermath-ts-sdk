import {
	Balance,
	CoinType,
	RouterCompleteTradeRoute,
	SuiNetwork,
} from "../../types";
import { Pool } from "../pools/pool";
import { Caller } from "../../general/utils/caller";
import { RouterGraph } from "./utils/routerGraph";
import { Transaction } from "@mysten/sui.js";
import { PoolsApiHelpers } from "../pools/api/poolsApiHelpers";

export class Router extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Public Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly graph: RouterGraph;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pools: Pool[] = [],
		public readonly network?: SuiNetwork
	) {
		super(network, "router");

		// check handle remove duplicate pools (same object Id)
		this.pools = pools;
		this.graph = new RouterGraph(pools);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supportedCoins");
	}

	public getCompleteRoute(
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength?: number
	): RouterCompleteTradeRoute {
		return this.graph.getCompleteRoute(
			coinIn,
			coinInAmount,
			coinOut,
			maxRouteLength
		);
	}
}

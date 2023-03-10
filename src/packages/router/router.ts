import { SuiNetwork } from "../../types";
import { Pool } from "../pools/pool";
import { SignableTransaction } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";

// TODO: create router object
export class Router extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly pools: Pool[],
		public readonly network?: SuiNetwork
	) {
		super(network, "router");
		this.pools = pools;

		// create graph
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	// public async getAllTradeRoutes(): Promise<> {}
	// public async getOptimalTradeRoute(): Promise<> {}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	// public async getTradeTransactions(): Promise<SignableTransaction[]> {}
	// public async getOptimalTradeTransactions(): Promise<
	// 	SignableTransaction[]
	// > {}
}

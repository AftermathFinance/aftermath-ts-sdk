import {
	ApiRouterFirstTradeTransactionsBody,
	ApiRouterIntermediateTradeTransactionsBody,
	ApiRouterPathInfoBody,
	Balance,
	CoinType,
	RouterPath,
	RouterPathInfo,
	SuiNetwork,
} from "../../types";
import { Pool } from "../pools/pool";
import { ObjectId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
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

		// create graph ?
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supportedCoins");
	}

	public async getPathInfo(
		fromCoin: CoinType,
		toCoin: CoinType
	): Promise<RouterPathInfo> {
		return this.fetchApi<RouterPathInfo, ApiRouterPathInfoBody>(
			"pathInfo",
			{
				fromCoin,
				toCoin,
			}
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getFirstTradeTransactions(
		walletAddress: SuiAddress,
		path: RouterPath,
		fromCoinAmount: Balance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRouterFirstTradeTransactionsBody
		>("transactions/trade", {
			walletAddress,
			fromCoinAmount,
			path,
		});
	}

	public async getIntermediateTradeTransactions(
		path: RouterPath,
		fromCoinId: ObjectId
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRouterIntermediateTradeTransactionsBody
		>("transactions/trade", {
			fromCoinId,
			path,
		});
	}
}

import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { RouterGraph } from "../utils/routerGraph";
import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	Slippage,
	SuiNetwork,
	Url,
	RouterProtocolName,
} from "../../../types";
import { SuiAddress } from "@mysten/sui.js";
import { Helpers } from "../../../general/utils/helpers";
import { RouterPoolInterface } from "../utils/routerPoolInterface";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { PoolsApi } from "../../pools/api/poolsApi";

export class RouterApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		private readonly Provider: AftermathApi,
		public readonly protocols: RouterProtocolName[] = ["Aftermath"]
	) {
		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// External Packages
	/////////////////////////////////////////////////////////////////////

	public Aftermath = () => new PoolsApi(this.Provider);
	public Nojo = () => new NojoAmmApi(this.Provider);
	public DeepBook = () => new DeepBookApi(this.Provider);

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchAllPools = async (): Promise<CoinType[]> => {
		const apis = this.Helpers.protocolApisFromNames({
			protocols: this.protocols,
		});

		const poolsByProtocol = await Promise.all(
			apis.map((api) => api.fetchAllPools())
		);

		const pools = poolsByProtocol.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);

		return pools;
	};

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const apis = this.Helpers.protocolApisFromNames({
			protocols: this.protocols,
		});

		const arrayOfArraysOfCoins = await Promise.all(
			apis.map((api) => api.fetchSupportedCoins())
		);

		const allCoins = arrayOfArraysOfCoins.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);
		const coins = Helpers.uniqueArray(allCoins);

		return coins;
	};

	public fetchCompleteTradeRouteGivenAmountIn = async (
		pools: RouterPoolInterface[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		referrer?: SuiAddress,
		externalFee?: RouterExternalFee
		// TODO: add options to set all these params ?
		// maxRouteLength?: number,
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountIn(
			coinIn,
			coinInAmount,
			coinOut,
			referrer,
			externalFee
		);
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (
		pools: RouterPoolInterface[],
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance,
		referrer?: SuiAddress,
		externalFee?: RouterExternalFee
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountOut(
			coinIn,
			coinOut,
			coinOutAmount,
			referrer,
			externalFee
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async fetchTransactionForCompleteTradeRoute(
		// TODO: make it so that api can be called with different rpc nodes ?
		network: SuiNetwork | Url,
		provider: AftermathApi,
		walletAddress: SuiAddress,
		completeRoute: RouterCompleteTradeRoute,
		slippage: Slippage
	): Promise<SerializedTransaction> {
		const tx =
			await this.Helpers.fetchBuildTransactionForCompleteTradeRoute(
				network,
				provider,
				walletAddress,
				completeRoute,
				slippage
			);
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			tx
		);
	}
}

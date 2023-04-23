import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { Pool } from "../../pools";
import { RouterGraph } from "../utils/routerGraph";
import {
	Balance,
	CoinType,
	RouterExternalFee,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	Slippage,
	SuiNetwork,
} from "../../../types";
import { SuiAddress } from "@mysten/sui.js";
import { Helpers } from "../../../general/utils/helpers";
import {
	RouterPoolInterface,
	createRouterPool,
} from "../utils/routerPoolInterface";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";

export class RouterApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new RouterApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// External Packages
	/////////////////////////////////////////////////////////////////////

	public Nojo = () => new NojoAmmApi(this.Provider);

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async () => {
		const pools = await this.Provider.Pools().fetchAllPools();
		const allCoins: CoinType[] = pools
			.map((pool) => Object.keys(pool.coins))
			.reduce((prev, cur) => [...prev, ...cur], []);

		const uniqueCoins = Helpers.uniqueArray(allCoins);
		return uniqueCoins;
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
		network: SuiNetwork,
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
			tx,
			completeRoute.referrer
		);
	}
}

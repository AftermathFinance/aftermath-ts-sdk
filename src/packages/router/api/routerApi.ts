import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import { Pool } from "../../pools";
import { RouterGraph } from "../utils/routerGraph";
import {
	Balance,
	CoinType,
	RouterCompleteTradeRoute,
	SerializedTransaction,
	Slippage,
} from "../../../types";
import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { Helpers } from "../../../general/utils/helpers";

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
		pools: Pool[],
		coinIn: CoinType,
		coinInAmount: Balance,
		coinOut: CoinType,
		maxRouteLength?: number
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountIn(
			coinIn,
			coinInAmount,
			coinOut,
			maxRouteLength
		);
	};

	public fetchCompleteTradeRouteGivenAmountOut = async (
		pools: Pool[],
		coinIn: CoinType,
		coinOut: CoinType,
		coinOutAmount: Balance,
		maxRouteLength?: number
	): Promise<RouterCompleteTradeRoute> => {
		return new RouterGraph(pools).getCompleteRouteGivenAmountOut(
			coinIn,
			coinOut,
			coinOutAmount,
			maxRouteLength
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async fetchTransactionForCompleteTradeRoute(
		walletAddress: SuiAddress,
		completeRoute: RouterCompleteTradeRoute,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<SerializedTransaction> {
		const startTx = new TransactionBlock();
		// PRODUCTION: setSender on all transactions that gather coins !
		startTx.setSender(walletAddress);

		const { coinArgument: coinInArg, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				startTx,
				walletAddress,
				completeRoute.coinIn.type,
				completeRoute.coinIn.amount
			);

		let tx = txWithCoinWithAmount;
		let coinsOut = [];

		for (const route of completeRoute.routes) {
			const [splitCoinArg] = tx.add({
				kind: "SplitCoins",
				coin: coinInArg,
				amounts: [tx.pure(route.coinIn.amount)],
			});

			let coinIn = splitCoinArg;

			for (const path of route.paths) {
				const { tx: newTx, coinOut: newCoinIn } =
					this.Provider.Pools().Helpers.addTradeCommandWithCoinOutToTransaction(
						tx,
						path.poolObjectId,
						coinIn,
						path.coinIn.type,
						path.coinOut.amount,
						path.coinOut.type,
						path.poolLpCoinType,
						slippage,
						referrer
					);
				tx = newTx;
				coinIn = newCoinIn;
			}

			coinsOut.push(coinIn);
		}

		if (coinsOut.length > 1) tx.mergeCoins(coinsOut[0], coinsOut.slice(1));
		tx.transferObjects([coinsOut[0], coinInArg], tx.pure(walletAddress));

		return tx.serialize();
	}
}

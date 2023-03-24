import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterApiHelpers } from "./routerApiHelpers";
import {
	CoinType,
	RouterCompleteTradeRoute,
	SerializedTransaction,
} from "../../../types";
import { SuiAddress, Transaction } from "@mysten/sui.js";
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
			.map((pool) => pool.fields.coins)
			.reduce((prev, cur) => [...prev, ...cur], []);

		const uniqueCoins = Helpers.uniqueArray(allCoins);
		return uniqueCoins;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getTransactionForCompleteTradeRoute(
		walletAddress: SuiAddress,
		completeRoute: RouterCompleteTradeRoute
	): Promise<SerializedTransaction> {
		const startTx = new Transaction();

		const { coinWithAmountObjectId: coinInId, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				startTx,
				walletAddress,
				completeRoute.coinIn,
				completeRoute.coinInAmount
			);

		let tx = txWithCoinWithAmount;

		for (const route of completeRoute.routes) {
			tx.add({
				kind: "SplitCoins",
				coin: tx.object(coinInId),
				amounts: [tx.pure(route.coinInAmount)],
			});

			for (const [index, path] of route.paths.entries()) {
				tx =
					await this.Provider.Pools().Helpers.addTradeCommandToTransaction(
						tx,
						path.poolObjectId,
						index === 0
							? coinInId
							: {
									kind: "Result",
									index: 0,
							  },
						path.coinIn,
						BigInt(0), // TODO: calc slippage amount
						path.coinOut,
						path.poolLpCoinType
					);
			}
		}

		return tx.serialize();
	}
}

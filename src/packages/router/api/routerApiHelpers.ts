import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterCompleteTradeRoute } from "../routerTypes";
import { Slippage, SuiNetwork } from "../../../types";
import { createRouterPool } from "../utils/routerPoolInterface";

export class RouterApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	public async fetchBuildTransactionForCompleteTradeRoute(
		network: SuiNetwork,
		provider: AftermathApi,
		walletAddress: SuiAddress,
		completeRoute: RouterCompleteTradeRoute,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<TransactionBlock> {
		const startTx = new TransactionBlock();
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
				const { tx: newTx, coinOut: newCoinIn } = createRouterPool({
					pool: path.pool,
					network,
				}).addTradeCommandToTransaction({
					provider,
					tx,
					coinIn,
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
					expectedAmountOut: path.coinOut.amount,
					slippage,
					referrer,
				});

				tx = newTx;
				coinIn = newCoinIn;
			}

			coinsOut.push(coinIn);
		}

		if (coinsOut.length > 1) tx.mergeCoins(coinsOut[0], coinsOut.slice(1));
		tx.transferObjects([coinsOut[0], coinInArg], tx.pure(walletAddress));

		return tx;
	}
}

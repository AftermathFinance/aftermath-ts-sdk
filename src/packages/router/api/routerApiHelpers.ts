import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { RouterCompleteTradeRoute, RouterExternalFee } from "../routerTypes";
import { Slippage, SuiNetwork } from "../../../types";
import { createRouterPool } from "../utils/routerPoolInterface";
import { Router } from "../router";

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
		slippage: Slippage
	): Promise<TransactionBlock> {
		const referrer = completeRoute.referrer;
		const externalFee = completeRoute.externalFee;
		if (
			externalFee &&
			externalFee.feePercentage >=
				Router.constants.maxExternalFeePercentage
		)
			throw new Error(
				`external fee percentage exceeds max of ${Router.constants.maxExternalFeePercentage}`
			);

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

		const coinOut = coinsOut[0];

		// merge all coinsOut into a single coin
		if (coinsOut.length > 1) tx.mergeCoins(coinOut, coinsOut.slice(1));

		if (externalFee) {
			const feeAmount =
				externalFee.feePercentage *
				Number(completeRoute.coinOut.amount);

			const [feeCoin] = tx.add({
				kind: "SplitCoins",
				coin: coinOut,
				amounts: [tx.pure(feeAmount)],
			});
			tx.transferObjects([feeCoin], tx.pure(externalFee.recipient));
		}

		tx.transferObjects([coinOut, coinInArg], tx.pure(walletAddress));

		return tx;
	}
}

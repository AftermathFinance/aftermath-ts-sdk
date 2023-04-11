import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { PoolsApiHelpers } from "../../pools/api/poolsApiHelpers";
import { RouterCompleteTradeRoute } from "../routerTypes";
import { SerializedTransaction, Slippage } from "../../../types";

export class RouterApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	public async fetchBuildTransactionForCompleteTradeRoute(
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

		tx.setGasBudget(1000000000); // 1 sui
		return tx;
	}
}

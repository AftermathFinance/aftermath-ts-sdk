import { SuiAddress, TransactionDigest } from "@mysten/sui.js";
import { Helpers } from "../utils/helpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";
import { AftermathApi } from "../providers/aftermathApi";
import {
	CoinType,
	CoinWithBalance,
	CoinsToBalance,
} from "../../packages/coin/coinTypes";

export class WalletApi {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Coins
	/////////////////////////////////////////////////////////////////////

	public fetchCoinBalance = async (account: SuiAddress, coin: CoinType) => {
		const coinBalance = await this.Provider.provider.getBalance(
			account,
			Helpers.stripLeadingZeroesFromType(coin)
		);
		return BigInt(Math.floor(coinBalance.totalBalance));
	};

	// TODO: make toBigIntSafe function ?
	// TODO: return prices here as well and sort ?
	// TODO: remove all CoinWithBalance and similar types
	public fetchAllCoinBalances = async (
		address: SuiAddress
	): Promise<CoinsToBalance> => {
		const allBalances = await this.Provider.provider.getAllBalances(
			address
		);

		const coinsToBalance: CoinsToBalance = allBalances.reduce(
			(acc, balance, index) => {
				return {
					...acc,
					[balance.coinType]: BigInt(
						Math.floor(balance.totalBalance)
					),
				};
			},
			{}
		);

		return coinsToBalance;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchTransactionHistory = async (
		address: SuiAddress,
		cursor?: TransactionDigest,
		limit?: number
	) => {
		const transactionsWithCursor = await new TransactionsApiHelpers(
			this.Provider
		).fetchTransactionsWithCursor(
			{
				FromAddress: address,
			},
			cursor,
			limit
		);

		return transactionsWithCursor;
	};
}

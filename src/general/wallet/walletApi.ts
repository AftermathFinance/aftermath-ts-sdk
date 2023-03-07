import { SuiAddress, TransactionDigest } from "@mysten/sui.js";
import { Helpers } from "../utils/helpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType, CoinWithBalance } from "../../packages/coin/coinTypes";

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

	public fetchWalletCoinBalance = async (
		account: SuiAddress,
		coin: CoinType
	) => {
		const coinBalance = await this.Provider.provider.getBalance(
			account,
			Helpers.stripLeadingZeroesFromType(coin)
		);
		return BigInt(Math.floor(coinBalance.totalBalance));
	};

	// TODO: make toBigIntSafe function
	// TODO: return prices here as well and sort ?
	public fetchWalletAllCoinBalances = async (
		address: SuiAddress
	): Promise<CoinWithBalance[]> => {
		const allBalances = await this.Provider.provider.getAllBalances(
			address
		);
		// TODO: make this into object [coinType]: Balance ?
		return allBalances
			.map((coinBalance) => {
				return {
					coin: coinBalance.coinType,
					balance: BigInt(Math.floor(coinBalance.totalBalance)),
				};
			})
			.sort((a, b) => Number(b.balance - a.balance));
	};

	public fetchWalletTransactionHistory = async (
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

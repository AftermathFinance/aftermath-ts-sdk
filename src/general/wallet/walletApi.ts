import { Helpers } from "../utils/helpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";
import { AftermathApi } from "../providers/aftermathApi";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes";
import { SuiAddress, TransactionDigest } from "../types";

export class WalletApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Coins
	// =========================================================================

	public fetchCoinBalance = async (account: SuiAddress, coin: CoinType) => {
		const coinBalance = await this.Provider.provider.getBalance({
			owner: account,
			coinType: Helpers.stripLeadingZeroesFromType(coin),
		});
		return BigInt(coinBalance.totalBalance);
	};

	// TODO: make toBigIntSafe function ?
	// TODO: return prices here as well and sort ?
	public fetchAllCoinBalances = async (
		address: SuiAddress
	): Promise<CoinsToBalance> => {
		const allBalances = await this.Provider.provider.getAllBalances({
			owner: address,
		});

		const coinsToBalance: CoinsToBalance = allBalances.reduce(
			(acc, balance) => {
				return {
					...acc,
					[Helpers.addLeadingZeroesToType(balance.coinType)]: BigInt(
						balance.totalBalance
					),
				};
			},
			{}
		);

		return coinsToBalance;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// TODO: make this only look at aftermath relevant addresses in to address
	// TODO: restrict all filtering for events, etc. similarly using updated sdk filters
	public fetchPastAftermathTransactions = async (
		address: SuiAddress,
		cursor?: TransactionDigest,
		limit?: number
	) => {
		const transactionsWithCursor = await new TransactionsApiHelpers(
			this.Provider
		).fetchTransactionsWithCursor(
			{
				filter: {
					FromAddress: address,
				},
			},
			cursor,
			limit
		);

		return transactionsWithCursor;
	};
}

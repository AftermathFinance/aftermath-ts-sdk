import { Helpers } from "../utils/helpers.ts";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers.ts";
import { AftermathApi } from "../providers/aftermathApi.ts";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes.ts";
import { SuiAddress, TransactionDigest } from "../types/index.ts";

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

	public fetchCoinBalance = async (inputs: {
		walletAddress: SuiAddress;
		coin: CoinType;
	}) => {
		const { walletAddress, coin } = inputs;
		const coinBalance = await this.Provider.provider.getBalance({
			owner: walletAddress,
			coinType: Helpers.stripLeadingZeroesFromType(coin),
		});
		return BigInt(coinBalance.totalBalance);
	};

	// TODO: make toBigIntSafe function ?
	// TODO: return prices here as well and sort ?
	public fetchAllCoinBalances = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<CoinsToBalance> => {
		const { walletAddress } = inputs;

		const allBalances = await this.Provider.provider.getAllBalances({
			owner: walletAddress,
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
	public fetchPastTransactions = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: TransactionDigest;
		limit?: number;
	}) => {
		const { walletAddress, cursor, limit } = inputs;

		const transactionsWithCursor =
			await this.Provider.Transactions().fetchTransactionsWithCursor({
				query: {
					filter: {
						FromAddress: walletAddress,
					},
				},
				cursor,
				limit,
			});

		return transactionsWithCursor;
	};
}

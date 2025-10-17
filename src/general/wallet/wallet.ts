import {
	ApiTransactionsBody,
	Balance,
	CallerConfig,
	SuiAddress,
	TransactionsWithCursor,
} from "../types/generalTypes";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { AftermathApi } from "../providers";

/**
 * The `Wallet` class allows querying a user's balances and transactions.
 * It handles fetching coin balances, transactions, and more by leveraging
 * an `AftermathApi.Wallet` provider.
 */
export class Wallet extends Caller {
	/**
	 * Creates a new `Wallet` instance for a specific address.
	 *
	 * @param address - The Sui address for this wallet (e.g., "0x<address>").
	 * @param config - An optional caller configuration including network and authentication.
	 * @param Provider - An optional `AftermathApi` instance for wallet-specific methods.
	 */
	constructor(
		public readonly address: SuiAddress,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, `wallet`);
	}

	// =========================================================================
	//  Balances
	// =========================================================================

	/**
	 * Fetches the balance for a single coin type in this wallet.
	 *
	 * @param inputs - An object containing the `coin` type to look up (e.g., "0x2::sui::SUI").
	 * @returns A promise that resolves to the coin balance as a bigint.
	 *
	 * @example
	 * ```typescript
	 *
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const wallet = afSdk.Wallet("0x<address>");
	 *
	 * const suiBalance = await wallet.getBalance({ coin: "0x2::sui::SUI" });
	 * console.log("SUI Balance:", suiBalance.toString());
	 * ```
	 */
	public async getBalance(inputs: { coin: CoinType }): Promise<Balance> {
		return (await this.getBalances({ coins: [inputs.coin] }))[0];
	}

	/**
	 * Fetches the balances for multiple specified coin types in this wallet.
	 * This method currently returns an array of balances in the same order
	 * as the requested coins.
	 *
	 * @param inputs - An object containing an array of `coins` (coin types).
	 * @returns A promise resolving to an array of `Balance`s, each matching the corresponding coin in `inputs.coins`.
	 *
	 * @example
	 * ```typescript
	 * const wallet = new Wallet("0x<address>");
	 * const balances = await wallet.getBalances({ coins: ["0x2::sui::SUI", "0x<...>"] });
	 * console.log(balances); // e.g. [1000000000n, 50000000000n]
	 * ```
	 */
	public async getBalances(inputs: {
		coins: CoinType[];
	}): Promise<Balance[]> {
		return this.fetchApi(`coin-balances`, {
			...inputs,
			walletAddress: this.address,
		});
	}

	/**
	 * Fetches all coin balances held by this wallet address, returning a record
	 * keyed by coin type.
	 *
	 * @returns A promise resolving to an object mapping coin types to balances (bigints).
	 *
	 * @example
	 * ```typescript
	 * const wallet = new Wallet("0x<address>");
	 * const allBalances = await wallet.getAllBalances();
	 * console.log(allBalances); // { "0x2::sui::SUI": 1000000000n, "0x<other_coin>": 5000000000n, ... }
	 * ```
	 */
	public async getAllBalances(): Promise<CoinsToBalance> {
		return this.fetchApi(`all-coin-balances`, {
			walletAddress: this.address,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches a paginated list of past transactions for this wallet address.
	 *
	 * @param inputs - An object implementing `ApiTransactionsBody`, which includes pagination parameters (`cursor`, `limit`) and an optional `order` or other fields.
	 * @returns A promise that resolves to transaction details, including a cursor if more results exist.
	 *
	 * @example
	 * ```typescript
	 * const wallet = new Wallet("0x<address>");
	 * const txHistory = await wallet.getPastTransactions({ cursor: "abc123", limit: 10 });
	 * console.log(txHistory.transactions, txHistory.nextCursor);
	 * ```
	 */
	public async getPastTransactions(
		inputs: ApiTransactionsBody
	): Promise<TransactionsWithCursor> {
		return this.fetchApi(`past-transactions`, {
			...inputs,
			walletAddress: this.address,
		});
	}
}

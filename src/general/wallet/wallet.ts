import type { CoinsToBalance, CoinType } from "../../packages/coin/coinTypes";
import type { AftermathApi } from "../providers";
import type {
	ApiTransactionsBody,
	Balance,
	CallerConfig,
	SuiAddress,
	TransactionsWithCursor,
} from "../types/generalTypes";
import { Caller } from "../utils/caller";

/**
 * Provides balance and transaction-history queries for one Sui address.
 *
 * The methods send POST requests through the configured Aftermath HTTP API under
 * `/api/wallet` by default. The `apiEndpoint` setting can change that prefix.
 * Balance values are `bigint`s in each coin's smallest unit. These methods do
 * not accept an `AbortSignal`, so callers cannot cancel their requests through
 * this class. Coin types are passed to the endpoint without local validation.
 * If neither `network` nor `baseUrl` is configured, a request rejects with an
 * `AftermathTransportError` whose `kind` is `"network"`.
 */
export class Wallet extends Caller {
	/**
	 * Creates a wallet service for a specific Sui address.
	 *
	 * @param address - The Sui address string whose balances and transaction history
	 * to query. The address is passed to the API as `walletAddress` and is not
	 * validated or normalized by this constructor.
	 * @param config - Optional HTTP caller configuration. Set `network` or `baseUrl`
	 * to select the API host. Set `accessToken` to send a bearer token.
	 * @param api - Optional low-level `AftermathApi` instance associated with the
	 * wallet. The current methods use the HTTP API configured by `config`.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const sdk = await Aftermath.create({ network: "MAINNET" });
	 * const wallet = sdk.Wallet(
	 * 	"0x00000000000000000000000000000000000000000000000000000000000000aa"
	 * );
	 * ```
	 */
	constructor(
		/** The Sui address whose balances and history this instance queries. */
		public readonly address: SuiAddress,
		config?: CallerConfig,
		/** The optional low-level API provider associated with this wallet. */
		public readonly api?: AftermathApi
	) {
		super(config, "wallet");
	}

	// =========================================================================
	//  Balances
	// =========================================================================

	/**
	 * Fetches one coin balance for this wallet.
	 *
	 * This method sends the request `{ coins: [inputs.coin], walletAddress: address }`
	 * to the wallet balance endpoint and returns the first balance in the response.
	 * The balance is a `bigint` in the coin's smallest unit, such as MIST for SUI.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - The balance request.
	 * @param inputs.coin - The Sui coin type to query, such as
	 * `"0x2::sui::SUI"`.
	 * @returns The requested coin balance in its smallest unit.
	 * @throws `AftermathTransportError` when the HTTP request fails or its response
	 * cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 *
	 * const wallet = afSdk.Wallet(
	 * 	"0x00000000000000000000000000000000000000000000000000000000000000aa"
	 * );
	 *
	 * const suiBalance = await wallet.getBalance({ coin: "0x2::sui::SUI" });
	 * console.log("SUI balance in MIST:", suiBalance.toString());
	 * ```
	 */
	public async getBalance(inputs: { coin: CoinType }): Promise<Balance> {
		return (await this.getBalances({ coins: [inputs.coin] }))[0];
	}

	/**
	 * Fetches balances for the requested coin types.
	 *
	 * This method sends `{ coins, walletAddress: address }` as a JSON POST body to
	 * the wallet balance endpoint. The API returns one `bigint` balance per coin in
	 * the same order as `inputs.coins`, with each value in the coin's smallest unit.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - The balance request.
	 * @param inputs.coins - The Sui coin types to query, such as
	 * `["0x2::sui::SUI"]`.
	 * @returns The balances in the request order. Each balance is a `bigint` in
	 * the corresponding coin's smallest unit.
	 * @throws `AftermathTransportError` when the HTTP request fails or its response
	 * cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 * const wallet = afSdk.Wallet(
	 * 	"0x00000000000000000000000000000000000000000000000000000000000000aa"
	 * );
	 * const balances = await wallet.getBalances({
	 * 	coins: ["0x2::sui::SUI"],
	 * });
	 * console.log(balances); // e.g. [1000000000n]
	 * ```
	 */
	public async getBalances(inputs: { coins: CoinType[] }): Promise<Balance[]> {
		return this.fetchApi("coin-balances", {
			...inputs,
			walletAddress: this.address,
		});
	}

	/**
	 * Fetches every coin balance held by this wallet address.
	 *
	 * This method sends `{ walletAddress: address }` as a JSON POST body to the
	 * wallet balance endpoint. The response is a record keyed by the coin types
	 * returned by the API. Each value is a `bigint` in that coin's smallest unit.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @returns A record mapping returned coin types to balances in smallest units.
	 * @throws `AftermathTransportError` when the HTTP request fails or its response
	 * cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 * const wallet = afSdk.Wallet(
	 * 	"0x00000000000000000000000000000000000000000000000000000000000000aa"
	 * );
	 * const allBalances = await wallet.getAllBalances();
	 * console.log(allBalances);
	 * ```
	 */
	public async getAllBalances(): Promise<CoinsToBalance> {
		return this.fetchApi("all-coin-balances", {
			walletAddress: this.address,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches a page of transactions sent from this wallet address.
	 *
	 * This method sends `{ ...inputs, walletAddress: address }` as a JSON POST body
	 * to the wallet transaction-history endpoint. The `cursor` and `limit` values
	 * control pagination. The returned `nextCursor` is `null` when the response has
	 * no more transactions.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - Pagination options.
	 * @returns The transaction page and its next transaction digest, if another
	 * page exists.
	 * @throws `AftermathTransportError` when the HTTP request fails or its response
	 * cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 * const wallet = afSdk.Wallet(
	 * 	"0x00000000000000000000000000000000000000000000000000000000000000aa"
	 * );
	 * const txHistory = await wallet.getPastTransactions({ limit: 10 });
	 * console.log(txHistory.transactions, txHistory.nextCursor);
	 * ```
	 */
	public async getPastTransactions(
		inputs: ApiTransactionsBody
	): Promise<TransactionsWithCursor> {
		return this.fetchApi("past-transactions", {
			...inputs,
			walletAddress: this.address,
		});
	}
}

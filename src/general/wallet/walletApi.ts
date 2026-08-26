import type { SuiClientTypes } from "@mysten/sui/client";
import type { CoinsToBalance, CoinType } from "../../packages/coin/coinTypes";
import type { AftermathApi } from "../providers/aftermathApi";
import type { SuiAddress, TransactionDigest } from "../types";
import { Helpers } from "../utils/helpers";

/**
 * Provides low-level wallet queries through a configured `AftermathApi`.
 *
 * Balance methods call the configured `SuiGrpcClient` and return on-chain
 * balances as `bigint`s in smallest units. Transaction history uses the
 * optional JSON-RPC client because the Sui gRPC client has no equivalent query.
 * None of these methods accepts an `AbortSignal`.
 *
 * Prefer {@link AftermathApi.Wallet} when the caller already has an
 * `AftermathApi` instance.
 */
export class WalletApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a low-level wallet query helper.
	 *
	 * @param api - Configured `AftermathApi` whose gRPC client supplies balance
	 * data and whose optional JSON-RPC client supplies transaction history.
	 *
	 * @example
	 * ```typescript
	 * import { AftermathApi } from "aftermath-ts-sdk";
	 * import { SuiGrpcClient } from "@mysten/sui/grpc";
	 *
	 * const api = new AftermathApi(
	 * 	new SuiGrpcClient({
	 * 		network: "mainnet",
	 * 		baseUrl: "https://fullnode.mainnet.sui.io:443",
	 * 	}),
	 * 	{}
	 * );
	 * const walletApi = api.Wallet();
	 * ```
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Coins
	// =========================================================================

	/**
	 * Fetches one coin balance for a wallet address through Sui gRPC.
	 *
	 * The owner address is sent unchanged. The coin type is stripped of leading
	 * zeroes before it is sent to `SuiGrpcClient.getBalance`. The returned decimal
	 * balance is converted to a `bigint` in the coin's smallest unit.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - The wallet balance request.
	 * @param inputs.walletAddress - The Sui address string that owns the balance.
	 * @param inputs.coin - The Sui coin type to query, such as
	 * `"0x2::sui::SUI"`.
	 * @returns The balance in the coin's smallest unit.
	 * @throws Errors from the configured gRPC client or from converting the
	 * returned balance to `bigint`.
	 */
	public fetchCoinBalance = async (inputs: {
		walletAddress: SuiAddress;
		coin: CoinType;
	}) => {
		const { walletAddress, coin } = inputs;
		// @dev: gRPC nests the result under `balance` and names the total `balance`
		// (JSON-RPC returned a flat `totalBalance`). Values are identical.
		const { balance } = await this.api.client.getBalance({
			owner: walletAddress,
			coinType: Helpers.stripLeadingZeroesFromType(coin),
		});
		return BigInt(balance.balance);
	};

	// TODO: make toBigIntSafe function ?
	// TODO: return prices here as well and sort ?
	/**
	 * Fetches every coin balance for a wallet address through paginated Sui gRPC
	 * requests.
	 *
	 * The helper follows `listBalances` cursors until the client reports no next
	 * page. It returns each balance as a `bigint` in the coin's smallest unit and
	 * pads the package address in each returned coin type to 64 hexadecimal digits.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - The wallet balance request.
	 * @param inputs.walletAddress - The Sui address string whose balances to fetch.
	 * @returns A record keyed by normalized coin types with balances in smallest
	 * units.
	 * @throws Errors from the configured gRPC client, coin-type normalization, or
	 * conversion of a returned balance to `bigint`.
	 */
	public fetchAllCoinBalances = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<CoinsToBalance> => {
		const { walletAddress } = inputs;

		// @dev: JSON-RPC's `getAllBalances` returned every balance in one array;
		// gRPC's `listBalances` pages. Page to exhaustion to preserve behaviour.
		const coinsToBalance: CoinsToBalance = {};
		let cursor: string | undefined;

		do {
			const page: SuiClientTypes.ListBalancesResponse =
				await this.api.client.listBalances({
					owner: walletAddress,
					cursor,
				});

			for (const balance of page.balances) {
				coinsToBalance[Helpers.addLeadingZeroesToType(balance.coinType)] =
					BigInt(balance.balance);
			}

			cursor =
				page.balances.length > 0 && page.hasNextPage && page.cursor
					? page.cursor
					: undefined;
		} while (cursor !== undefined);

		return coinsToBalance;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// TODO: make this only look at aftermath relevant addresses in to address
	// TODO: restrict all filtering for events, etc. similarly using updated sdk filters
	/**
	 * Fetches a page of transactions whose sender is the supplied wallet address.
	 *
	 * This method calls `Transactions().fetchTransactionsWithCursor` with a
	 * `FromAddress` filter. It requests events, balance changes, effects, object
	 * changes, and transaction input in each result. The optional cursor and limit
	 * control pagination, and the returned `nextCursor` is `null` when no page
	 * remains.
	 *
	 * This method does not accept an `AbortSignal`.
	 *
	 * @param inputs - The sender filter and pagination options.
	 * @param inputs.walletAddress - The Sui address string used as the `FromAddress`
	 * filter. This method does not include transactions where the address only
	 * appears as a recipient or another participant.
	 * @param inputs.cursor - An optional transaction digest from the previous page.
	 * @param inputs.limit - An optional maximum number of transactions to request.
	 * @returns The transaction page and its next transaction digest, if another
	 * page exists.
	 * @remarks This method uses the remaining Sui JSON-RPC transaction-query
	 * surface. Prefer `Wallet.getPastTransactions` for the Aftermath API
	 * transaction-history endpoint.
	 * @throws `Error` if the `AftermathApi` has no JSON-RPC client.
	 * @throws Errors from the configured JSON-RPC client when the query fails.
	 */
	public fetchPastTransactions = async (inputs: {
		walletAddress: SuiAddress;
		cursor?: TransactionDigest;
		limit?: number;
	}) => {
		const { walletAddress, cursor, limit } = inputs;

		const transactionsWithCursor = await this.api
			.Transactions()
			.fetchTransactionsWithCursor({
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

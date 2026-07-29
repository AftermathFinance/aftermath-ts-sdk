import type { SuiClientTypes } from "@mysten/sui/client";
import type { CoinsToBalance, CoinType } from "../../packages/coin/coinTypes";
import type { AftermathApi } from "../providers/aftermathApi";
import type { SuiAddress, TransactionDigest } from "../types";
import { Helpers } from "../utils/helpers";

export class WalletApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly api: AftermathApi) {}

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
	public fetchAllCoinBalances = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<CoinsToBalance> => {
		const { walletAddress } = inputs;

		// @dev: JSON-RPC's `getAllBalances` returned every balance in one array;
		// gRPC's `listBalances` pages. Page to exhaustion to preserve behaviour.
		const allBalances: SuiClientTypes.Balance[] = [];
		let cursor: string | null | undefined;
		do {
			const page = await this.api.client.listBalances({
				owner: walletAddress,
				cursor,
			});
			allBalances.push(...page.balances);

			if (page.balances.length === 0 || !page.hasNextPage || !page.cursor) {
				break;
			}
			cursor = page.cursor;
		} while (true);

		const coinsToBalance: CoinsToBalance = allBalances.reduce(
			(acc: CoinsToBalance, balance) => {
				return {
					...acc,
					[Helpers.addLeadingZeroesToType(balance.coinType)]: BigInt(
						balance.balance
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

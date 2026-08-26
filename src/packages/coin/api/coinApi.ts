import type { SuiClientTypes } from "@mysten/sui/client";
import type { CoinStruct } from "@mysten/sui/jsonRpc";
import {
	coinWithBalance,
	type Transaction,
	type TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import { GrpcCasting } from "../../../general/utils/grpcCasting";
import { Helpers } from "../../../general/utils/helpers";
import type { Balance, CoinType, ObjectId, SuiAddress } from "../../../types";

// Backstop for coin-dust wallets (100k+ coin objects): a tx merging this many
// coins would exceed protocol limits (256 gas-payment objects) anyway, so stop
// paging rather than fetching the whole wallet.
const MAX_COIN_FETCH_PAGES = 50;

/**
 * Provides coin-object queries and transaction arguments for `AftermathApi`.
 *
 * The query methods use the provider's Sui client, and the transaction methods
 * append commands to the supplied `Transaction`.
 */
export class CoinApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a coin API helper backed by an Aftermath provider.
	 *
	 * @param api - Provider that supplies the Sui client used for coin queries.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	/**
	 * Creates a transaction argument for a requested amount of one coin type.
	 *
	 * The method sets the transaction sender. For a sponsored transaction, it
	 * selects owned coin objects and appends raw merge and split commands. For a
	 * non-sponsored transaction, it checks the total balance before adding a
	 * `CoinWithBalance` intent.
	 *
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.walletAddress - Address that owns the coin and signs the transaction.
	 * @param inputs.coinType - Coin type to select.
	 * @param inputs.coinAmount - Amount to represent in the transaction, as a bigint in the coin's smallest unit.
	 * @param inputs.isSponsoredTx - Whether the transaction uses an external gas sponsor.
	 * @returns A transaction argument representing exactly `coinAmount` of `coinType`.
	 * @throws `Error` when the wallet lacks sufficient balance or has too many coin objects for sponsored selection.
	 */
	public fetchCoinWithAmountTx = async (inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
		isSponsoredTx?: boolean;
	}): Promise<TransactionObjectArgument> => {
		const { tx, walletAddress, coinType, coinAmount, isSponsoredTx } = inputs;

		tx.setSender(walletAddress);

		if (isSponsoredTx) {
			const coinData = await this.fetchCoinsWithAtLeastAmount(inputs);
			return CoinApi.sponsoredCoinWithAmountTx({
				tx,
				coinData,
				coinAmount,
				coinType,
			});
		}

		await this.assertSufficientTotalBalance(inputs);

		return coinWithBalance({ type: coinType, balance: coinAmount })(tx);
	};

	/**
	 * Creates transaction arguments for several coin types and amounts.
	 *
	 * The method processes `coinTypes` and `coinAmounts` by matching array index
	 * and appends each result to the supplied transaction.
	 *
	 * @param inputs.tx - Transaction to mutate.
	 * @param inputs.walletAddress - Address that owns the coins and signs the transaction.
	 * @param inputs.coinTypes - Coin types to select, in the order of the returned arguments.
	 * @param inputs.coinAmounts - Amounts corresponding to `coinTypes` by index, in each coin's smallest unit.
	 * @param inputs.isSponsoredTx - Whether to use owned coin objects instead of a `CoinWithBalance` intent.
	 * @returns Transaction arguments in the same order as `coinTypes`.
	 * @throws `Error` when any requested amount cannot be selected.
	 */
	public fetchCoinsWithAmountTx = async (inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		coinTypes: CoinType[];
		coinAmounts: Balance[];
		isSponsoredTx?: boolean;
	}): Promise<TransactionObjectArgument[]> => {
		const { coinTypes, coinAmounts } = inputs;

		const coinArgs: TransactionObjectArgument[] = [];
		for (const [index, coinType] of coinTypes.entries()) {
			coinArgs.push(
				await this.fetchCoinWithAmountTx({
					...inputs,
					coinType,
					coinAmount: coinAmounts[index],
				})
			);
		}
		return coinArgs;
	};

	/**
	 * Fetches owned coin objects until their combined balances cover an amount.
	 *
	 * The method selects the largest balances found across pages and stops after
	 * 50 pages to avoid creating an oversized transaction for a dust-heavy wallet.
	 *
	 * @param inputs.walletAddress - Address whose coin objects to query.
	 * @param inputs.coinType - Coin type to query.
	 * @param inputs.coinAmount - Minimum combined balance to select, in the coin's smallest unit.
	 * @returns The selected coin objects, ordered from largest balance to smallest.
	 * @throws `Error` when the wallet cannot cover the amount or the balance is spread across more than 50 pages.
	 */
	public fetchCoinsWithAtLeastAmount = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}): Promise<CoinStruct[]> => {
		const allCoinData: CoinStruct[] = [];
		let cursor: string | null | undefined;

		for (let page = 0; page < MAX_COIN_FETCH_PAGES; page++) {
			// @dev: `getCoins` -> `listCoins`; `res.data` -> `res.objects` and
			// `res.nextCursor` -> `res.cursor`. See `GrpcCasting` for the
			// per-coin reshape.
			const paginatedCoins: SuiClientTypes.ListCoinsResponse =
				await this.api.client.listCoins({
					coinType: inputs.coinType,
					owner: inputs.walletAddress,
					cursor,
				});

			allCoinData.push(
				...paginatedCoins.objects.map(GrpcCasting.coinStructFromGrpcCoin)
			);

			// Return the fewest (largest) coins fetched so far that cover the
			// amount. Exiting as soon as they do keeps pagination proportional
			// to the amount needed, not to the wallet's total coin count.
			allCoinData.sort((b, a) => Number(BigInt(a.balance) - BigInt(b.balance)));

			const selectedCoins: CoinStruct[] = [];
			let sum = BigInt(0);
			for (const coinData of allCoinData) {
				selectedCoins.push(coinData);
				sum += BigInt(coinData.balance);

				if (sum >= inputs.coinAmount) {
					return selectedCoins;
				}
			}

			if (
				paginatedCoins.objects.length === 0 ||
				!paginatedCoins.hasNextPage ||
				!paginatedCoins.cursor
			) {
				throw new Error("wallet does not have coins of sufficient balance");
			}

			cursor = paginatedCoins.cursor;
		}

		throw new Error("wallet balance is spread across too many coin objects");
	};

	/**
	 * Fetches every owned coin object for a coin type.
	 *
	 * The method follows all available pages and returns the objects sorted by
	 * numeric coin object ID in ascending order.
	 *
	 * @param inputs.walletAddress - Address whose coin objects to query.
	 * @param inputs.coinType - Coin type to query.
	 * @returns All matching coin objects from the wallet.
	 */
	public fetchAllCoins = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<CoinStruct[]> => {
		const allCoinData: CoinStruct[] = [];
		let cursor: string | undefined;

		do {
			const paginatedCoins: SuiClientTypes.ListCoinsResponse =
				await this.api.client.listCoins({
					coinType: inputs.coinType,
					owner: inputs.walletAddress,
					cursor,
				});

			allCoinData.push(
				...paginatedCoins.objects.map(GrpcCasting.coinStructFromGrpcCoin)
			);

			cursor =
				paginatedCoins.objects.length > 0 &&
				paginatedCoins.hasNextPage &&
				paginatedCoins.cursor
					? paginatedCoins.cursor
					: undefined;
		} while (cursor !== undefined);

		return allCoinData.sort((b, a) =>
			Number(BigInt(b.coinObjectId) - BigInt(a.coinObjectId))
		);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Checks the wallet's TOTAL balance (owned coins + SIP-58 address balance)
	 * covers `coinAmount`, throwing the canonical insufficient-balance error
	 * otherwise. `coinWithBalance` can source from both, so this is the correct
	 * spendability check for the non-sponsored path.
	 */
	private assertSufficientTotalBalance = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}): Promise<void> => {
		const { balance } = await this.api.client.getBalance({
			owner: inputs.walletAddress,
			coinType: Helpers.stripLeadingZeroesFromType(inputs.coinType),
		});
		if (BigInt(balance.balance) < inputs.coinAmount) {
			throw new Error("wallet does not have coins of sufficient balance");
		}
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	/**
	 * Owned-coin arg for the sponsored path: merge the selected coins and split
	 * the amount without touching `tx.gas` (that's the sponsor's coin) and via
	 * raw commands only, since the tx is serialized unbuilt. `coinData` comes
	 * from `fetchCoinsWithAtLeastAmount`, which guarantees it covers
	 * `coinAmount`.
	 */
	private static sponsoredCoinWithAmountTx = (inputs: {
		tx: Transaction;
		coinData: CoinStruct[];
		coinAmount: Balance;
		coinType: CoinType;
	}): TransactionObjectArgument => {
		const { tx, coinData, coinAmount, coinType } = inputs;

		const coinObjectIds = coinData.map((data) => data.coinObjectId);
		const mergedCoinObjectId: ObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			tx.add({
				$kind: "MergeCoins",
				MergeCoins: {
					destination: tx.object(mergedCoinObjectId),
					sources: [
						...coinObjectIds.slice(1).map((coinId) => tx.object(coinId)),
					],
				},
			});
		}

		return TransactionsApiHelpers.splitCoinTx({
			tx,
			coinId: mergedCoinObjectId,
			amount: coinAmount,
			coinType,
		});
	};
}

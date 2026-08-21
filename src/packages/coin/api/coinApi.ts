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

export class CoinApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

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
			// amount — exiting as soon as they do keeps pagination proportional
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

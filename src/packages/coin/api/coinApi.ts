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
import { Coin } from "../coin";

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
			return CoinApi.coinWithAmountTx({
				tx,
				coinData,
				coinAmount,
				coinType,
				isSponsoredTx,
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

	private static coinWithAmountTx = (inputs: {
		tx: Transaction;
		coinData: CoinStruct[];
		coinAmount: Balance;
		coinType: CoinType;
		isSponsoredTx?: boolean;
	}): TransactionObjectArgument => {
		const { tx, coinData, coinAmount, coinType, isSponsoredTx } = inputs;

		if (coinData.length <= 0) {
			throw new Error("wallet does not have coins of sufficient balance");
		}

		const isSuiCoin = Coin.isSuiCoin(coinData[0].coinType);

		const totalCoinBalance = Helpers.sumBigInt(
			coinData.map((data) => BigInt(data.balance))
		);
		if (totalCoinBalance < coinAmount) {
			throw new Error("wallet does not have coins of sufficient balance");
		}

		if (!isSponsoredTx && isSuiCoin) {
			tx.setGasPayment(
				coinData.map((obj) => {
					return {
						...obj,
						objectId: obj.coinObjectId,
					};
				})
			);

			return tx.splitCoins(tx.gas, [coinAmount]);
		}

		const coinObjectIds = coinData.map((data) => data.coinObjectId);
		const mergedCoinObjectId: ObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			if (isSponsoredTx) {
				tx.add({
					$kind: "MergeCoins",
					MergeCoins: {
						destination: tx.object(mergedCoinObjectId),
						sources: [
							...coinObjectIds.slice(1).map((coinId) => tx.object(coinId)),
						],
					},
				});
			} else {
				tx.mergeCoins(tx.object(mergedCoinObjectId), [
					...coinObjectIds.slice(1).map((coinId) => tx.object(coinId)),
				]);
			}
		}

		return isSponsoredTx
			? TransactionsApiHelpers.splitCoinTx({
					tx,
					coinId: mergedCoinObjectId,
					amount: coinAmount,
					coinType,
				})
			: tx.splitCoins(mergedCoinObjectId, [coinAmount]);
	};
}

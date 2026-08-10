import type { SuiClientTypes } from "@mysten/sui/client";
import type { CoinStruct } from "@mysten/sui/jsonRpc";
import type {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import { GrpcCasting } from "../../../general/utils/grpcCasting";
import { Helpers } from "../../../general/utils/helpers";
import type { Balance, CoinType, ObjectId, SuiAddress } from "../../../types";
import { Coin } from "../coin";
// import { ethers, Networkish } from "ethers";

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

		const coinData = await this.fetchCoinsWithAtLeastAmount(inputs);
		return CoinApi.coinWithAmountTx({
			tx,
			coinData,
			coinAmount,
			coinType,
			isSponsoredTx,
		});
	};

	public fetchCoinsWithAmountTx = async (inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		coinTypes: CoinType[];
		coinAmounts: Balance[];
		isSponsoredTx?: boolean;
	}): Promise<TransactionObjectArgument[]> => {
		const { tx, walletAddress, coinTypes, coinAmounts, isSponsoredTx } = inputs;

		tx.setSender(walletAddress);

		const allCoinsData = await Promise.all(
			coinTypes.map(async (coinType, index) =>
				this.fetchCoinsWithAtLeastAmount({
					...inputs,
					coinAmount: coinAmounts[index],
					coinType,
				})
			)
		);

		let coinArgs: TransactionObjectArgument[] = [];
		for (const [index, coinData] of allCoinsData.entries()) {
			const coinArg = CoinApi.coinWithAmountTx({
				tx,
				coinData,
				coinAmount: coinAmounts[index],
				coinType: coinTypes[index],
				isSponsoredTx,
			});

			coinArgs = [...coinArgs, coinArg];
		}

		return coinArgs;
	};

	public fetchCoinsWithAtLeastAmount = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}): Promise<CoinStruct[]> => {
		let allCoinData: CoinStruct[] = [];
		let cursor: string | null | undefined;
		do {
			// @dev: `getCoins` -> `listCoins`; `res.data` -> `res.objects` and
			// `res.nextCursor` -> `res.cursor`. See `GrpcCasting` for the
			// per-coin reshape.
			const paginatedCoins: SuiClientTypes.ListCoinsResponse =
				await this.api.client.listCoins({
					coinType: inputs.coinType,
					owner: inputs.walletAddress,
					cursor,
				});

			const coinData = paginatedCoins.objects.map(
				GrpcCasting.coinStructFromGrpcCoin
			);
			allCoinData = [...allCoinData, ...coinData];

			if (
				paginatedCoins.objects.length === 0 ||
				!paginatedCoins.hasNextPage ||
				!paginatedCoins.cursor
			) {
				allCoinData.sort((b, a) =>
					Number(BigInt(a.balance) - BigInt(b.balance))
				);

				const coinDatas: CoinStruct[] = [];
				let sum = BigInt(0);
				for (const coinData of allCoinData) {
					coinDatas.push(coinData);
					sum += BigInt(coinData.balance);

					if (sum >= inputs.coinAmount) {
						return coinDatas;
					}
				}
				throw new Error("wallet does not have coins of sufficient balance");
			}

			cursor = paginatedCoins.cursor;
		} while (true);
	};

	// fetchCoinsUntilAmountReachedOrEnd
	public fetchAllCoins = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		// coinAmount: Balance;
	}): Promise<CoinStruct[]> => {
		let allCoinData: CoinStruct[] = [];
		let cursor: string | null | undefined;
		do {
			const paginatedCoins: SuiClientTypes.ListCoinsResponse =
				await this.api.client.listCoins({
					coinType: inputs.coinType,
					owner: inputs.walletAddress,
					cursor,
				});

			// const coinData = paginatedCoins.objects.filter(
			// 	(data) => BigInt(data.balance) > BigInt(0)
			// );
			const coinData = paginatedCoins.objects.map(
				GrpcCasting.coinStructFromGrpcCoin
			);
			allCoinData = [...allCoinData, ...coinData];

			// const totalAmount = Helpers.sumBigInt(
			// 	allCoinData.map((data) => BigInt(data.balance))
			// );
			// if (totalAmount >= inputs.coinAmount) return allCoinData;

			if (
				paginatedCoins.objects.length === 0 ||
				!paginatedCoins.hasNextPage ||
				!paginatedCoins.cursor
			) {
				return allCoinData.sort((b, a) =>
					Number(BigInt(b.coinObjectId) - BigInt(a.coinObjectId))
				);
			}

			cursor = paginatedCoins.cursor;
		} while (true);
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
			// return Helpers.transactions.splitCoinsTx({
			// 	tx,
			// 	coinId: tx.gas,
			// 	amounts: [coinAmount],
			// 	coinType,
			// });
		}

		const coinObjectIds = coinData.map((data) => data.coinObjectId);
		const mergedCoinObjectId: ObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			// TODO: fix this (v1)

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

		// return tx.add({
		// 	kind: "SplitCoins",
		// 	coin: tx.object(mergedCoinObjectId),
		// 	amounts: [tx.pure(coinAmount)],
		// });
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

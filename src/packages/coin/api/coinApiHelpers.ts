import {
	CoinStruct,
	ObjectId,
	PaginatedCoins,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Balance, CoinType } from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Casting } from "../../../general/utils/casting";

export class CoinApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	// public fetchCoinDecimals = async (coin: CoinType) => {
	// 	const coinMetadata = await new CoinApi(this.Provider).fetchCoinMetadata(
	// 		coin
	// 	);
	// 	const decimals = coinMetadata?.decimals;
	// 	if (decimals === undefined)
	// 		throw Error("unable to obtain decimals for coin: " + coin);

	// 	return decimals as CoinDecimal;
	// };

	// TODO: use this everywhere in backend calls ?
	// TODO: handle coins where there is no coin metadata on chain
	// public fetchCoinDecimalsNormalizeBalance = async (
	// 	coin: CoinType,
	// 	amount: number
	// ) => {
	// 	const decimals = await this.fetchCoinDecimals(coin);
	// 	return Coin.normalizeBalance(amount, decimals);
	// };

	// public fetchCoinDecimalsApplyToBalance = async (
	// 	coin: CoinType,
	// 	balance: Balance
	// ) => {
	// 	const decimals = await this.fetchCoinDecimals(coin);
	// 	return Coin.balanceWithDecimals(balance, decimals);
	// };

	// public fetchCoinsToDecimals = async (coins: CoinType[]) => {
	// 	let allDecimals: number[] = [];
	// 	for (const coin of coins) {
	// 		const decimals = await this.fetchCoinDecimals(coin);
	// 		allDecimals.push(decimals);
	// 	}

	// 	const coinsToDecimals: Record<CoinType, CoinDecimal> =
	// 		allDecimals.reduce((acc, decimals, index) => {
	// 			return { ...acc, [coins[index]]: decimals };
	// 		}, {});
	// 	return coinsToDecimals;
	// };

	// public fetchNormalizeCoinAmounts = async (
	// 	coins: CoinType[],
	// 	amounts: number[]
	// ) => {
	// 	const normalizedAmounts = await Promise.all(
	// 		coins.map(
	// 			async (coin, index) =>
	// 				await this.fetchCoinDecimalsNormalizeBalance(
	// 					coin,
	// 					amounts[index]
	// 				)
	// 		)
	// 	);

	// 	return normalizedAmounts;
	// };

	// public async fetchCoinsToDecimalsAndPrices(coins: CoinType[]): Promise<
	// 	Record<
	// 		CoinType,
	// 		{
	// 			decimals: CoinDecimal;
	// 			price: number;
	// 		}
	// 	>
	// > {
	// 	const [coinsToPrices, coinsToDecimals] = await Promise.all([
	// 		this.Provider.Prices().fetchCoinsToPrice(coins),
	// 		this.fetchCoinsToDecimals(coins),
	// 	]);

	// 	const coinsToDecimalsAndPrices = Object.keys(coinsToPrices).reduce(
	// 		(acc, coin) => {
	// 			return {
	// 				...acc,
	// 				[coin]: {
	// 					decimals: coinsToDecimals[coin],
	// 					price:
	// 						coinsToPrices[coin] < 0 ? 0 : coinsToPrices[coin],
	// 				},
	// 			};
	// 		},
	// 		{}
	// 	);

	// 	return coinsToDecimalsAndPrices;
	// }

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) => Casting.u8VectorFromString(coin.slice(2))); // slice to remove 0x

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchCoinWithAmountTx = async (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}): Promise<TransactionArgument> => {
		const { tx, walletAddress, coinType, coinAmount } = inputs;

		tx.setSender(walletAddress);

		const coinData = await this.fetchCoinsUntilAmountReachedOrEnd(inputs);
		return CoinApiHelpers.coinWithAmountTx({
			tx,
			coinData,
			coinAmount,
		});
	};

	public fetchCoinsWithAmountTx = async (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		coinTypes: CoinType[];
		coinAmounts: Balance[];
	}): Promise<TransactionArgument[]> => {
		const { tx, walletAddress, coinTypes, coinAmounts } = inputs;

		tx.setSender(walletAddress);

		// TODO: handle cursoring until necessary coin amount is found
		const allCoinsData = await Promise.all(
			coinTypes.map(async (coinType, index) =>
				this.fetchCoinsUntilAmountReachedOrEnd({
					...inputs,
					coinAmount: coinAmounts[index],
					coinType,
				})
			)
		);

		let coinArgs: TransactionArgument[] = [];
		for (const [index, coinData] of allCoinsData.entries()) {
			const coinArg = CoinApiHelpers.coinWithAmountTx({
				tx,
				coinData,
				coinAmount: coinAmounts[index],
			});

			coinArgs = [...coinArgs, coinArg];
		}

		return coinArgs;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private fetchCoinsUntilAmountReachedOrEnd = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: Balance;
	}) => {
		let allCoinData: CoinStruct[] = [];
		let cursor: string | undefined = undefined;
		do {
			const paginatedCoins: PaginatedCoins =
				await this.Provider.provider.getCoins({
					...inputs,
					owner: inputs.walletAddress,
					cursor,
				});

			const coinData = paginatedCoins.data.filter(
				(data) =>
					!data.lockedUntilEpoch && BigInt(data.balance) > BigInt(0)
			);
			allCoinData = [...allCoinData, ...coinData];

			const totalAmount = Helpers.sumBigInt(
				allCoinData.map((data) => BigInt(data.balance))
			);
			if (totalAmount >= inputs.coinAmount) return allCoinData;

			if (
				paginatedCoins.data.length === 0 ||
				!paginatedCoins.hasNextPage ||
				!paginatedCoins.nextCursor
			)
				return allCoinData;

			cursor = paginatedCoins.nextCursor;
		} while (true);
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	private static coinWithAmountTx = (inputs: {
		tx: TransactionBlock;
		coinData: CoinStruct[];
		coinAmount: Balance;
	}): TransactionArgument => {
		const { tx, coinData, coinAmount } = inputs;

		const isSuiCoin = Coin.isSuiCoin(coinData[0].coinType);

		const totalCoinBalance = Helpers.sumBigInt(
			coinData.map((data) => BigInt(data.balance))
		);
		if (totalCoinBalance < coinAmount)
			throw new Error("wallet does not have coins of sufficient balance");

		if (isSuiCoin) {
			tx.setGasPayment(
				coinData.map((obj) => {
					return {
						...obj,
						objectId: obj.coinObjectId,
					};
				})
			);

			return tx.splitCoins(tx.gas, [tx.pure(coinAmount)]);
		}

		const coinObjectIds = coinData.map((data) => data.coinObjectId);
		const mergedCoinObjectId: ObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			tx.add({
				kind: "MergeCoins",
				destination: tx.object(mergedCoinObjectId),
				sources: [
					...coinObjectIds
						.slice(1)
						.map((coinId) => tx.object(coinId)),
				],
			});
		}

		return tx.add({
			kind: "SplitCoins",
			coin: tx.object(mergedCoinObjectId),
			amounts: [tx.pure(coinAmount)],
		});
	};
}

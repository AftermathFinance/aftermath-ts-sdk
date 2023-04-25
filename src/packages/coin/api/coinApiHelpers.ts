import {
	ObjectId,
	PaginatedCoins,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
	TransactionBlockInput,
} from "@mysten/sui.js";
import { Balance, CoinDecimal, CoinType } from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CoinApi } from "./coinApi";
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

	public fetchCoinDecimals = async (coin: CoinType) => {
		const coinMetadata = await new CoinApi(this.Provider).fetchCoinMetadata(
			coin
		);
		const decimals = coinMetadata?.decimals;
		if (decimals === undefined)
			throw Error("unable to obtain decimals for coin: " + coin);

		return decimals as CoinDecimal;
	};

	// TODO: use this everywhere in backend calls ?
	// TODO: handle coins where there is no coin metadata on chain
	public fetchCoinDecimalsNormalizeBalance = async (
		coin: CoinType,
		amount: number
	) => {
		const decimals = await this.fetchCoinDecimals(coin);
		return Coin.normalizeBalance(amount, decimals);
	};

	public fetchCoinDecimalsApplyToBalance = async (
		coin: CoinType,
		balance: Balance
	) => {
		const decimals = await this.fetchCoinDecimals(coin);
		return Coin.balanceWithDecimals(balance, decimals);
	};

	public fetchCoinsToDecimals = async (coins: CoinType[]) => {
		let allDecimals: number[] = [];
		for (const coin of coins) {
			const decimals = await this.fetchCoinDecimals(coin);
			allDecimals.push(decimals);
		}

		const coinsToDecimals: Record<CoinType, CoinDecimal> =
			allDecimals.reduce((acc, decimals, index) => {
				return { ...acc, [coins[index]]: decimals };
			}, {});
		return coinsToDecimals;
	};

	public fetchNormalizeCoinAmounts = async (
		coins: CoinType[],
		amounts: number[]
	) => {
		const normalizedAmounts = await Promise.all(
			coins.map(
				async (coin, index) =>
					await this.fetchCoinDecimalsNormalizeBalance(
						coin,
						amounts[index]
					)
			)
		);

		return normalizedAmounts;
	};

	public async fetchCoinsToDecimalsAndPrices(coins: CoinType[]): Promise<
		Record<
			CoinType,
			{
				decimals: CoinDecimal;
				price: number;
			}
		>
	> {
		const [coinsToPrices, coinsToDecimals] = await Promise.all([
			this.Provider.Prices().fetchCoinsToPrice(coins),
			this.fetchCoinsToDecimals(coins),
		]);

		const coinsToDecimalsAndPrices = Object.keys(coinsToPrices).reduce(
			(acc, coin) => {
				return {
					...acc,
					[coin]: {
						decimals: coinsToDecimals[coin],
						price:
							coinsToPrices[coin] < 0 ? 0 : coinsToPrices[coin],
					},
				};
			},
			{}
		);

		return coinsToDecimalsAndPrices;
	}

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) => Casting.u8VectorFromString(coin.slice(2))); // slice to remove 0x

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchAddCoinWithAmountCommandsToTransaction = async (
		tx: TransactionBlock,
		walletAddress: SuiAddress,
		coinType: CoinType,
		coinAmount: Balance
	): Promise<{
		coinArgument: TransactionArgument;
		txWithCoinWithAmount: TransactionBlock;
	}> => {
		tx.setSender(walletAddress);

		// TODO: handle cursoring until necessary coin amount is found
		const paginatedCoins = await this.Provider.provider.getCoins({
			owner: walletAddress,
			coinType,
		});

		return CoinApiHelpers.addCoinWithAmountCommandsToTransaction(
			tx,
			paginatedCoins,
			coinAmount
		);
	};

	public fetchAddCoinsWithAmountCommandsToTransaction = async (
		tx: TransactionBlock,
		walletAddress: SuiAddress,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<{
		coinArguments: TransactionArgument[];
		txWithCoinsWithAmount: TransactionBlock;
	}> => {
		tx.setSender(walletAddress);

		// TODO: handle cursoring until necessary coin amount is found
		const allPaginatedCoins = await Promise.all(
			coinTypes.map((coinType) =>
				this.Provider.provider.getCoins({
					owner: walletAddress,
					coinType,
				})
			)
		);

		const coinObjectIdsAndTransaction = allPaginatedCoins.reduce<{
			coinArguments: TransactionArgument[];
			txWithCoinsWithAmount: TransactionBlock;
		}>(
			(acc, paginatedCoins, index) => {
				const { coinArgument, txWithCoinWithAmount } =
					CoinApiHelpers.addCoinWithAmountCommandsToTransaction(
						acc.txWithCoinsWithAmount,
						paginatedCoins,
						coinAmounts[index]
					);

				return {
					coinArguments: [...acc.coinArguments, coinArgument],
					txWithCoinsWithAmount: txWithCoinWithAmount,
				};
			},
			{
				coinArguments: [],
				txWithCoinsWithAmount: tx,
			}
		);

		return coinObjectIdsAndTransaction;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static addCoinWithAmountCommandsToTransaction = (
		tx: TransactionBlock,
		paginatedCoins: PaginatedCoins,
		coinAmount: Balance
	): {
		coinArgument: TransactionArgument;
		txWithCoinWithAmount: TransactionBlock;
	} => {
		const totalCoinBalance = Helpers.sumBigInt(
			paginatedCoins.data.map((data) => BigInt(data.balance))
		);

		if (totalCoinBalance < coinAmount)
			throw new Error("wallet does not have coins of sufficient balance");

		// TODO: handle data.lockedUntilEpoch ?
		const coinObjectIds = paginatedCoins.data
			.filter((data) => BigInt(data.balance) > BigInt(0))
			.map((data) => data.coinObjectId);

		const mergedCoinObjectId = coinObjectIds[0];

		if (coinObjectIds.length > 1) {
			tx.add({
				kind: "MergeCoins",
				destination: tx.object(mergedCoinObjectId),
				sources: coinObjectIds
					.slice(1)
					.map((coinId) => tx.object(coinId)),
			});
		}

		const [splitCoin] = tx.add({
			kind: "SplitCoins",
			coin: tx.object(mergedCoinObjectId),
			amounts: [tx.pure(coinAmount)],
		});

		return {
			coinArgument: splitCoin,
			txWithCoinWithAmount: tx,
		};
	};
}

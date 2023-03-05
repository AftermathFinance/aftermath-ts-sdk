import {
	GetObjectDataResponse,
	getObjectId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
} from "@mysten/sui.js";
import { Balance, CoinDecimal, CoinType, GasBudget } from "../types";
import { Helpers } from "../utils/helpers";
import { Coin } from "./coin";

export class CoinApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public static fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual =
		async (
			walletAddress: SuiAddress,
			coinType: CoinType,
			coinAmount: Balance
		): Promise<GetObjectDataResponse[]> => {
			const response = (
				await provider.selectCoinSetWithCombinedBalanceGreaterThanOrEqual(
					walletAddress,
					coinAmount,
					Helpers.stripLeadingZeroesFromType(coinType)
				)
			).filter(
				// Safe check to avoid coins with value 0
				(getObjectDataResponse) =>
					Coin.getBalance(getObjectDataResponse)
			);

			if (response.length === 0)
				throw new Error(
					"wallet does not have coins of sufficient balance"
				);
			return response;
		};

	// TODO: use this everywhere in sdk ! (instead of just router)
	public static fetchCoinJoinAndSplitWithExactAmountTransactions = async (
		walletAddress: SuiAddress,
		coin: CoinType,
		coinAmount: Balance
	): Promise<{
		coinObjectId: ObjectId;
		joinAndSplitTransactions: SignableTransaction[];
	}> => {
		// i. obtain object ids of coin to swap from
		const response =
			await CoinApiHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				coin,
				coinAmount
			);

		const coinObjectId = getObjectId(response[0]);

		// ii. the user doesn't have a coin of type `coin` with exact
		// value of `balance`, so we need to create it
		const joinAndSplitTransactions =
			CoinApiHelpers.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				coin,
				coinAmount
			);

		return {
			coinObjectId,
			joinAndSplitTransactions,
		};
	};

	public static fetchCoinDecimals = async (coin: CoinType) => {
		const coinMetadata = await fetchCoinMetadata(coin);
		const decimals = coinMetadata?.decimals;
		if (decimals === undefined)
			throw Error("unable to obtain decimals for coin: " + coin);

		return decimals as CoinDecimal;
	};
	// TODO: use this everywhere in backend calls
	// TODO: handle coins where there is no coin metadata on chain
	public static fetchCoinDecimalsNormalizeBalance = async (
		coin: CoinType,
		amount: number
	) => {
		const decimals = await CoinApiHelpers.fetchCoinDecimals(coin);
		return Coin.normalizeBalance(amount, decimals);
	};

	public static fetchCoinDecimalsApplyToBalance = async (
		coin: CoinType,
		balance: Balance
	) => {
		const decimals = await CoinApiHelpers.fetchCoinDecimals(coin);
		return Coin.balanceWithDecimals(balance, decimals);
	};

	public static fetchCoinsToDecimals = async (coins: CoinType[]) => {
		let allDecimals: number[] = [];
		for (const coin of coins) {
			const decimals = await CoinApiHelpers.fetchCoinDecimals(coin);
			allDecimals.push(decimals);
		}

		const coinsToDecimals: Record<CoinType, CoinDecimal> =
			allDecimals.reduce((acc, decimals, index) => {
				return { ...acc, [coins[index]]: decimals };
			}, {});
		return coinsToDecimals;
	};

	public static fetchNormalizeCoinAmounts = async (
		coins: CoinType[],
		amounts: number[]
	) => {
		const normalizedAmounts = await Promise.all(
			coins.map(
				async (coin, index) =>
					await CoinApiHelpers.fetchCoinDecimalsNormalizeBalance(
						coin,
						amounts[index]
					)
			)
		);

		return normalizedAmounts;
	};

	public static async fetchCoinsToDecimalsAndPrices(
		coins: CoinType[]
	): Promise<
		Record<
			CoinType,
			{
				decimals: CoinDecimal;
				price: number;
			}
		>
	> {
		const [coinsToPrices, coinsToDecimals] = await Promise.all([
			fetchCoinsToPythPrices(coins),
			CoinApiHelpers.fetchCoinsToDecimals(coins),
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
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	private static coinJoinVecTransaction = (
		coin: ObjectId,
		coins: ObjectId[],
		coinType: CoinType,
		gasBudget: GasBudget = config.sui.pay.functions.joinVec.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: config.sui.packageId,
				module: config.sui.pay.module,
				function: config.sui.pay.functions.joinVec.name,
				typeArguments: [coinType],
				arguments: [coin, coins],
				gasBudget: gasBudget,
			},
		};
	};

	private static coinSplitTransaction = (
		coin: ObjectId,
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = config.sui.pay.functions.split.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: config.sui.packageId,
				module: config.sui.pay.module,
				function: config.sui.pay.functions.split.name,
				typeArguments: [coinType],
				arguments: [coin, amount.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	private static coinJoinVecAndSplitTransaction = (
		coin: ObjectId,
		coins: ObjectId[],
		coinType: CoinType,
		amount: Balance,
		gasBudget: GasBudget = config.utilities.pay.functions.joinVecAndSplit
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: config.utilities.packageId,
				module: config.utilities.pay.module,
				function: config.utilities.pay.functions.joinVecAndSplit.name,
				typeArguments: [coinType],
				arguments: [coin, coins, amount.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	/*
        @assumes: the combined balance of `coin` + `coinsToJoin` is at least `amount`.
        @returns: undefined if `Coin.getBalance(coin)` returns undefined, an array of 
        `SignableTransactions` otherwise.
    */
	public static coinJoinAndSplitWithExactAmountTransactions = (
		coin: GetObjectDataResponse,
		coinsToJoin: GetObjectDataResponse[],
		coinType: CoinType,
		amount: Balance
	): SignableTransaction[] => {
		const coinBalance = Coin.getBalance(coin);
		if (!coinBalance)
			throw new Error("wallet does not have balance of coin");
		// there are now four scenarios:
		//    i. the user has a coin of type `coinType` with balance equal to `amount`.
		if (coinBalance === amount) return [];

		const coinId = getObjectId(coin);
		//   ii. the user has a coin of type `coinType` with balance greater than `amount`
		//       and needs to remove `coinBalance` - `amount` from the coin.
		if (coinBalance > amount)
			return [
				CoinApiHelpers.coinSplitTransaction(
					coinId,
					coinType,
					coinBalance - amount
				),
			];

		const joinedBalance = coinBalance + Coin.totalBalance(coinsToJoin);
		const coinIdsToJoin = coinsToJoin.map((getObjectDataResponse) =>
			getObjectId(getObjectDataResponse)
		);
		//  iii. the user has multiple coins of type `coinType` that sum to `amount`, so
		//       these coins need to be joined.
		if (joinedBalance === amount)
			return [
				CoinApiHelpers.coinJoinVecTransaction(
					coinId,
					coinIdsToJoin,
					coinType
				),
			];

		//   iv. the user has multiple coins of type `coinType` whose sum is greater than
		//       `amount`, so these coins need to be joined and `joinedBalance` - `amount`
		//       needs to be removed from the coin.
		return [
			CoinApiHelpers.coinJoinVecAndSplitTransaction(
				coinId,
				coinIdsToJoin,
				coinType,
				joinedBalance - amount
			),
		];
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) => u8VectorFromString(coin.slice(2))); // slice to remove 0x
}

import {
	Coin,
	GetObjectDataResponse,
	getObjectId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
} from "@mysten/sui.js";
import {
	Balance,
	CoinDecimal,
	CoinsToBalance,
	CoinType,
	CoinWithAmount,
	CoinWithAmountOrUndefined,
	KeyType,
} from "../types";
import { Helpers } from "../utils/helpers";

export class Coins {
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
				coinSplitTransaction(coinId, coinType, coinBalance - amount),
			];

		const joinedBalance = coinBalance + Coin.totalBalance(coinsToJoin);
		const coinIdsToJoin = coinsToJoin.map((getObjectDataResponse) =>
			getObjectId(getObjectDataResponse)
		);
		//  iii. the user has multiple coins of type `coinType` that sum to `amount`, so
		//       these coins need to be joined.
		if (joinedBalance === amount)
			return [coinJoinVecTransaction(coinId, coinIdsToJoin, coinType)];

		//   iv. the user has multiple coins of type `coinType` whose sum is greater than
		//       `amount`, so these coins need to be joined and `joinedBalance` - `amount`
		//       needs to be removed from the coin.
		return [
			coinJoinVecAndSplitTransaction(
				coinId,
				coinIdsToJoin,
				coinType,
				joinedBalance - amount
			),
		];
	};

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

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
			await Coins.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				coin,
				coinAmount
			);

		const coinObjectId = getObjectId(response[0]);

		// ii. the user doesn't have a coin of type `coin` with exact
		// value of `balance`, so we need to create it
		const joinAndSplitTransactions =
			Coins.coinJoinAndSplitWithExactAmountTransactions(
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
		const decimals = await Coins.fetchCoinDecimals(coin);
		return Coins.normalizeBalance(amount, decimals);
	};

	public static fetchCoinDecimalsApplyToBalance = async (
		coin: CoinType,
		balance: Balance
	) => {
		const decimals = await Coins.fetchCoinDecimals(coin);
		return Coins.balanceWithDecimals(balance, decimals);
	};

	public static fetchCoinsToDecimals = async (coins: CoinType[]) => {
		let allDecimals: number[] = [];
		for (const coin of coins) {
			const decimals = await Coins.fetchCoinDecimals(coin);
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
					await Coins.fetchCoinDecimalsNormalizeBalance(
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
			Coins.fetchCoinsToDecimals(coins),
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
	//// Balance
	/////////////////////////////////////////////////////////////////////

	/*
        Convert user-inputted values into their onchain counterparts (e.g. u64)
        TO-DO: change name
    */
	public static normalizeBalance = (
		balance: number,
		decimals: CoinDecimal
	): Balance =>
		BigInt(
			// Take the floor in case user provides greater than `decimals` decimals
			Math.floor(balance * 10 ** decimals)
		);

	public static balanceWithDecimals = (
		amount: bigint | number,
		decimals: number
	) => {
		// TO-DO: make this conversion via string so no overflow or loss when bigint to number
		return Number(amount) / Number(10 ** decimals);
	};

	public static balanceWithDecimalsUsd = (
		amount: bigint | number,
		decimals: number,
		price: number
	) => {
		return Coins.balanceWithDecimals(amount, decimals) * price;
	};

	/////////////////////////////////////////////////////////////////////
	//// Coin Type
	/////////////////////////////////////////////////////////////////////

	public static coinTypeFromKeyType = (keyType: KeyType) => {
		const startIndex = keyType.lastIndexOf("<") + 1;
		const endIndex = keyType.indexOf(">", startIndex);
		return keyType.slice(startIndex, endIndex);
	};

	public static coinTypePackageName = (coinType: CoinType): string => {
		const splitCoin = coinType.split("::");
		const packageName = splitCoin[splitCoin.length - 2];
		if (!packageName) throw new Error("no coin type package name found");
		return packageName;
	};

	public static coinTypeSymbol = (coinType: CoinType): string => {
		const startIndex = coinType.lastIndexOf("::") + 2;
		if (startIndex <= 1) throw new Error("no coin type found");

		const foundEndIndex = coinType.indexOf(">");
		const endIndex = foundEndIndex < 0 ? coinType.length : foundEndIndex;

		const displayType = coinType.slice(startIndex, endIndex);
		return displayType;
	};

	public static extractInnerCoinType = (coin: CoinType) =>
		coin.split("<")[1].slice(0, -1);

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static coinsAndAmountsOverZero = (
		coinAmounts: Record<CoinType, number>
	) => {
		// NOTE: will these loops always run in same order (is this a js gurantee or not) ?
		const coins = Object.keys(coinAmounts).filter(
			(key) => coinAmounts[key] > 0
		);
		const amounts = Object.values(coinAmounts).filter(
			(amount) => amount > 0
		);

		return { coins, amounts };
	};

	public static coinsAndBalancesOverZero = (
		coinsToBalance: CoinsToBalance
	) => {
		// NOTE: will these loops always run in same order (is this a js gurantee or not) ?
		const coins = Object.keys(coinsToBalance).filter(
			(key) => BigInt(coinsToBalance[key]) > BigInt(0)
		);
		const balances = Object.values(coinsToBalance)
			.map(BigInt)
			.filter((amount) => amount > BigInt(0));

		return { coins, balances };
	};

	public static tryToCoinWithAmount = (
		uncheckedCoinWithAmount: CoinWithAmountOrUndefined | undefined
	): CoinWithAmount | undefined =>
		uncheckedCoinWithAmount === undefined
			? undefined
			: uncheckedCoinWithAmount.coin === undefined
			? undefined
			: (uncheckedCoinWithAmount as CoinWithAmount);

	public static formatCoinTypesForMoveCall = (coins: CoinType[]) =>
		coins.map((coin) => u8VectorFromString(coin.slice(2))); // slice to remove 0x
}

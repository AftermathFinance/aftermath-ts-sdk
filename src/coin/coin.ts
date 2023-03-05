import { Coin as SuiCoin } from "@mysten/sui.js";
import {
	Balance,
	CoinDecimal,
	CoinsToBalance,
	CoinType,
	CoinWithAmount,
	CoinWithAmountOrUndefined,
	KeyType,
} from "../types";

export class Coin extends SuiCoin {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public readonly coinTypePackageName: string;
	public readonly coinTypeSymbol: string;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly coinType: CoinType) {
		super();
		this.coinType = coinType;
		this.coinTypePackageName = this.getCoinTypePackageName();
		this.coinTypeSymbol = Coin.getCoinSymbol(coinType);
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Coin Type
	/////////////////////////////////////////////////////////////////////

	// TODO: remove in favor of sui js implementation Coin.getCoinStructTag() if it is the same
	private getCoinTypePackageName = (): string => {
		Coin.getCoinStructTag;
		const splitCoin = this.coinType.split("::");
		const packageName = splitCoin[splitCoin.length - 2];
		if (!packageName) throw new Error("no coin type package name found");
		return packageName;
	};

	// TODO: remove in favor of sui js implementation
	private getCoinTypeSymbol = (): string => {
		const startIndex = this.coinType.lastIndexOf("::") + 2;
		if (startIndex <= 1) throw new Error("no coin type found");

		const foundEndIndex = this.coinType.indexOf(">");
		const endIndex =
			foundEndIndex < 0 ? this.coinType.length : foundEndIndex;

		const displayType = this.coinType.slice(startIndex, endIndex);
		return displayType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Coin Type
	/////////////////////////////////////////////////////////////////////

	public static coinTypeFromKeyType = (keyType: KeyType) => {
		const startIndex = keyType.lastIndexOf("<") + 1;
		const endIndex = keyType.indexOf(">", startIndex);
		return keyType.slice(startIndex, endIndex);
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
		return Coin.balanceWithDecimals(amount, decimals) * price;
	};
}

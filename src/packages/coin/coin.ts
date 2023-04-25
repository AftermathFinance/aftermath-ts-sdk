import {
	Balance,
	CoinDecimal,
	CoinsToBalance,
	CoinType,
	CoinWithAmount,
	CoinWithAmountOrUndefined,
	KeyType,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";
import { CoinMetadata } from "@mysten/sui.js";
import { Prices } from "../../general/prices/prices";

export class Coin extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		suiCoinType: "0x0000000000000000000000000000000000000002::sui::SUI",
	};

	/////////////////////////////////////////////////////////////////////
	//// Public Members
	/////////////////////////////////////////////////////////////////////

	public readonly coinTypePackageName: string;
	public readonly coinTypeSymbol: string;
	public readonly innerCoinType: string;

	public metadata: CoinMetadata | undefined;
	public price: number | undefined;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly coinType: CoinType,
		public readonly network?: SuiNetwork
	) {
		super(network, "coins");
		this.coinType = coinType;

		this.coinTypePackageName = Coin.getCoinTypePackageName(this.coinType);
		this.coinTypeSymbol = Coin.getCoinTypeSymbol(this.coinType);
		this.innerCoinType = Coin.getInnerCoinType(this.coinType);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getCoinMetadata(): Promise<CoinMetadata> {
		if (this.metadata) return this.metadata;

		const metadata = await this.fetchApi<CoinMetadata>(this.coinType);
		this.setCoinMetadata(metadata);
		return metadata;
	}

	public setCoinMetadata(metadata: CoinMetadata) {
		this.metadata = metadata;
	}

	public async getPrice(): Promise<number> {
		if (this.price !== undefined) return this.price;

		const price = await new Prices(this.network).getCoinPrice({
			coin: this.coinType,
		});

		// NOTE: do we want this here ? (unexpected behavior)
		// if (price <= 0) throw new Error("No price found.")

		this.setPrice(price);
		return price;
	}

	public setPrice(price: number) {
		this.price = price;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Coin Type
	/////////////////////////////////////////////////////////////////////

	// TODO: remove in favor of sui js implementation Coin.getCoinStructTag() if it is the same
	public static getCoinTypePackageName = (coin: CoinType): string => {
		const splitCoin = coin.split("::");
		if (splitCoin.length !== 3) return "";
		const packageName = splitCoin[splitCoin.length - 2];
		if (!packageName) return "";
		return packageName;
	};

	// TODO: remove in favor of sui js implementation ?
	public static getCoinTypeSymbol = (coin: CoinType): string => {
		const startIndex = coin.lastIndexOf("::") + 2;
		if (startIndex <= 1) return "";

		const foundEndIndex = coin.indexOf(">");
		const endIndex = foundEndIndex < 0 ? coin.length : foundEndIndex;

		const displayType = coin.slice(startIndex, endIndex);
		return displayType;
	};

	public static getInnerCoinType = (coin: CoinType) =>
		coin.includes("<") ? coin.split("<")[1].slice(0, -1) : "";

	public static coinTypeFromKeyType = (keyType: KeyType) => {
		const startIndex = keyType.lastIndexOf("<") + 1;
		const endIndex = keyType.indexOf(">", startIndex);
		return keyType.slice(startIndex, endIndex);
	};

	public static isSuiCoin = (coin: CoinType) =>
		Helpers.stripLeadingZeroesFromType(coin) ===
		Helpers.stripLeadingZeroesFromType(Coin.constants.suiCoinType);

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

	public static trycoinOutWithAmount = (
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

	/////////////////////////////////////////////////////////////////////
	//// Convervsions
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

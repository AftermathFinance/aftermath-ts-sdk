import {
	AnyObjectType,
	Balance,
	CallerConfig,
	CoinDecimal,
	CoinMetadaWithInfo,
	CoinPriceInfo,
	CoinsToBalance,
	CoinsToDecimals,
	CoinSymbol,
	CoinSymbolToCoinTypes,
	CoinType,
	KeyType,
	SuiNetwork,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Helpers } from "../../general/utils/helpers";
import { Prices } from "../../general/prices/prices";
import { AftermathApi } from "../../general/providers";
import { CoinMetadata } from "@mysten/sui/client";

export class Coin extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		suiCoinType:
			"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
		suiCoinDecimals: 9,
		coinObjectType:
			"0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin",
	};

	// =========================================================================
	//  Public Members
	// =========================================================================

	public readonly coinTypePackageName: string;
	public readonly coinTypeSymbol: string;
	public readonly innerCoinType: string;

	public metadata: CoinMetadaWithInfo | undefined;
	public priceInfo: CoinPriceInfo | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	// TODO: update this class to not be instantiated with a coin type at all
	constructor(
		public readonly coinType: CoinType | undefined = undefined,
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "coins");
		this.coinType = coinType;

		this.coinTypePackageName = this.coinType
			? Coin.getCoinTypePackageName(this.coinType)
			: "";
		this.coinTypeSymbol = this.coinType
			? Coin.getCoinTypeSymbol(this.coinType)
			: "";
		this.innerCoinType = this.coinType
			? Coin.getInnerCoinType(this.coinType)
			: "";
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getCoinsToDecimals(inputs: {
		coins: CoinType[];
	}): Promise<CoinsToDecimals> {
		const { coins } = inputs;

		const metadatas = await this.getCoinMetadatas(inputs);

		const coinsToDecimals: Record<CoinType, CoinDecimal> = metadatas
			.map((data) => data.decimals)
			.reduce((acc, decimals, index) => {
				return { ...acc, [coins[index]]: decimals };
			}, {});
		return coinsToDecimals;
	}

	public async getCoinMetadata(coin?: CoinType): Promise<CoinMetadaWithInfo> {
		if (this.metadata) return this.metadata;

		const coinType = this.coinType ?? coin;
		if (!coinType) throw new Error("no valid coin type");

		const [metadata] = await this.getCoinMetadatas({ coins: [coinType] });
		this.setCoinMetadata(metadata);
		return metadata;
	}

	public async getCoinMetadatas(inputs: {
		coins: CoinType[];
	}): Promise<CoinMetadaWithInfo[]> {
		return this.fetchApi<CoinMetadaWithInfo[], { coins: CoinType[] }>(
			"metadata",
			inputs
		);
	}

	public setCoinMetadata(metadata: CoinMetadaWithInfo) {
		this.metadata = metadata;
	}

	public async getPrice(coin?: CoinType): Promise<CoinPriceInfo> {
		if (this.priceInfo !== undefined) return this.priceInfo;

		const coinType = this.coinType ?? coin;
		if (!coinType) throw new Error("no valid coin type");

		const priceInfo = await new Prices(this.config).getCoinPriceInfo({
			coin: coinType,
		});

		// NOTE: do we want this here ? (unexpected behavior)
		// if (price <= 0) throw new Error("No price found.")

		this.setPriceInfo(priceInfo);
		return priceInfo;
	}

	public setPriceInfo(priceInfo: CoinPriceInfo) {
		this.priceInfo = priceInfo;
	}

	public async getVerifiedCoins() {
		return this.fetchApi<CoinType[]>("verified");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Coin Type
	// =========================================================================

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
		// NOTE: should error if coin is not a valid coin type instead of empty string ?
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

	public static isCoinObjectType = (objectType: AnyObjectType) =>
		Helpers.stripLeadingZeroesFromType(objectType).startsWith(
			Helpers.stripLeadingZeroesFromType(Coin.constants.coinObjectType)
		);

	// =========================================================================
	//  Helpers
	// =========================================================================

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

	public static filterCoinsByType = (inputs: {
		filter: string;
		coinTypes: CoinType[];
	}): CoinType[] => {
		const filter = inputs.filter.toLowerCase().trim();
		return inputs.coinTypes?.filter((coinType) => {
			try {
				return (
					Helpers.stripLeadingZeroesFromType(coinType)
						.toLowerCase()
						.includes(Helpers.stripLeadingZeroesFromType(filter)) ||
					coinType
						.toLowerCase()
						.includes(Helpers.addLeadingZeroesToType(filter))
				);
			} catch (e) {}
			return (
				Helpers.stripLeadingZeroesFromType(coinType)
					.toLowerCase()
					.includes(filter) || coinType.toLowerCase().includes(filter)
			);
		});
	};

	public static filterCoinsByMetadata = (inputs: {
		filter: string;
		coinMetadatas: Record<CoinType, CoinMetadata>;
	}): CoinType[] => {
		return Object.entries(inputs.coinMetadatas)
			?.filter(([coin, metadata]) => {
				const cleanInput = inputs.filter.toLowerCase().trim();
				return (
					coin.startsWith(cleanInput) ||
					[metadata.name, metadata.symbol].some((str) =>
						str.toLowerCase().includes(cleanInput)
					)
				);
			})
			.map(([coin]) => coin);
	};

	// =========================================================================
	//  Balance
	// =========================================================================

	// =========================================================================
	//  Conversions
	// =========================================================================

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

	public static coinSymbolForCoinType = (inputs: {
		coinType: CoinType;
		coinSymbolToCoinTypes: CoinSymbolToCoinTypes;
	}): CoinSymbol | undefined => {
		const { coinType, coinSymbolToCoinTypes } = inputs;
		try {
			const fullCoinType = Helpers.addLeadingZeroesToType(coinType);
			const foundCoinData = Object.entries(coinSymbolToCoinTypes).find(
				([, coinsTypes]) =>
					coinsTypes
						.map(Helpers.addLeadingZeroesToType)
						.includes(fullCoinType)
			);

			const foundCoinSymbol = foundCoinData?.[0];
			return foundCoinSymbol;
		} catch (e) {
			return undefined;
		}
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Coin();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

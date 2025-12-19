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

/**
 * The `Coin` class provides functionality to manage and inspect coin types,
 * retrieve metadata and prices, and convert balances with respect to coin decimals.
 * It can be instantiated with or without a specific `coinType` for convenience.
 *
 * @example
 * ```typescript
 *
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init(); // initialize provider
 *
 * const coin = afSdk.Coin("0x2::sui::SUI");
 *
 * const metadata = await coin.getCoinMetadata(); // fetch metadata for SUI coin
 * ```
 */
export class Coin extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Static configuration and defaults for Sui coin types, including the standard
	 * SUI coin type, default decimals, and coin object type path.
	 */
	public static readonly constants = {
		/**
		 * The canonical coin type string for SUI.
		 */
		suiCoinType:
			"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
		/**
		 * The default number of decimals for SUI (9).
		 */
		suiCoinDecimals: 9,
		/**
		 * The canonical coin object type path for Sui's Move module, used in verifying coin objects.
		 */
		coinObjectType:
			"0x0000000000000000000000000000000000000000000000000000000000000002::coin::Coin",
		/**
		 * The maximum number of decimals
		 */
		maxCoinDecimals: 18,
		/**
		 * Default decimals for various blockchains or ecosystems. For instance,
		 * "sui" => 9, "evm" => 18, etc.
		 */
		defaultCoinDecimals: {
			sui: 9,
			evm: 18,
			svm: 9,
		},
	};

	// =========================================================================
	//  Public Members
	// =========================================================================

	/**
	 * The Move package name portion of this coin type, e.g. the middle "module" from "0x2::sui::SUI".
	 * Will be empty if no `coinType` is provided.
	 */
	public readonly coinTypePackageName: string;
	/**
	 * The final part of the coin type (the "symbol" or short name) from "0x2::sui::SUI".
	 * Will be empty if no `coinType` is provided.
	 */
	public readonly coinTypeSymbol: string;
	/**
	 * If the coin type includes a generic argument (like `Coin<0x...>`), this is extracted. Else empty.
	 * E.g. "0x5::coin::Coin<0x2::sui::SUI>" => "0x2::sui::SUI".
	 */
	public readonly innerCoinType: string;

	/**
	 * An optional cached coin metadata object retrieved by `getCoinMetadata`.
	 */
	public metadata: CoinMetadaWithInfo | undefined;
	/**
	 * An optional cached price info object retrieved by `getPrice`.
	 */
	public priceInfo: CoinPriceInfo | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of `Coin`.
	 *
	 * @param coinType - The coin's type string (e.g., "0x2::sui::SUI"). If omitted, methods that require a type will need it passed in manually.
	 * @param config - Optional caller configuration (network, access token).
	 * @param Provider - An optional `AftermathApi` instance for coin-specific API calls.
	 */
	constructor(
		public readonly coinType: CoinType | undefined = undefined,
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "coins");
		this.coinType = coinType;

		// Pre-extract segments for convenience
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

	/**
	 * Retrieves the decimals for multiple coins by calling the Aftermath API for metadata
	 * and extracting the `decimals` property.
	 *
	 * @param inputs - An object containing an array of coin types.
	 * @returns An object mapping each coin type to a numeric decimal count.
	 *
	 * @example
	 * ```typescript
	 * const decimals = await coin.getCoinsToDecimals({ coins: ["0x2::sui::SUI", "0x<...>"] });
	 * console.log(decimals); // { "0x2::sui::SUI": 9, "0x<...>": 6 }
	 * ```
	 */
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

	/**
	 * Fetches the metadata (name, symbol, decimals) for this coin type or a provided one,
	 * caching it if already requested.
	 *
	 * @param coin - Optionally override the constructor coinType.
	 * @returns The `CoinMetadaWithInfo` object containing metadata and optional external references.
	 * @throws If neither constructor nor argument coinType is available.
	 *
	 * @example
	 * ```typescript
	 * const metadata = await coin.getCoinMetadata("0x2::sui::SUI");
	 * console.log(metadata.name, metadata.symbol, metadata.decimals);
	 * ```
	 */
	public async getCoinMetadata(coin?: CoinType): Promise<CoinMetadaWithInfo> {
		if (this.metadata) return this.metadata;

		const coinType = this.coinType ?? coin;
		if (!coinType) throw new Error("no valid coin type");

		const [metadata] = await this.getCoinMetadatas({ coins: [coinType] });
		this.setCoinMetadata(metadata);
		return metadata;
	}

	/**
	 * Fetches metadata for multiple coins at once, returning an array in the same order
	 * as the coin types requested.
	 *
	 * @param inputs - An object with `coins`, an array of coin types.
	 * @returns An array of `CoinMetadaWithInfo` with length matching `coins`.
	 *
	 * @example
	 * ```typescript
	 * const metas = await coin.getCoinMetadatas({
	 *   coins: ["0x2::sui::SUI", "0x<custom::TOKEN>"]
	 * });
	 * console.log(metas[0].symbol, metas[1].symbol);
	 * ```
	 */
	public async getCoinMetadatas(inputs: {
		coins: CoinType[];
	}): Promise<CoinMetadaWithInfo[]> {
		return this.fetchApi<CoinMetadaWithInfo[], { coins: CoinType[] }>(
			"metadata",
			{
				coins: inputs.coins.map((coin) =>
					Helpers.addLeadingZeroesToType(coin)
				),
			}
		);
	}

	/**
	 * Manually sets the metadata in this Coin instance, storing it in `this.metadata`.
	 *
	 * @param metadata - A `CoinMetadaWithInfo` object to cache in this instance.
	 */
	public setCoinMetadata(metadata: CoinMetadaWithInfo) {
		this.metadata = metadata;
	}

	/**
	 * Retrieves price information (including current price and 24h change) for this coin or a provided coin.
	 * If already fetched, it returns the cached data.
	 *
	 * @param coin - Optionally override the constructor coinType.
	 * @returns A `CoinPriceInfo` with `price` and `priceChange24HoursPercentage`.
	 * @throws If no valid coin type is present.
	 *
	 * @example
	 * ```typescript
	 * const priceInfo = await coin.getPrice("0x2::sui::SUI");
	 * console.log(priceInfo.price, priceInfo.priceChange24HoursPercentage);
	 * ```
	 */
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

	/**
	 * Manually sets the price info in this Coin instance, storing it in `this.priceInfo`.
	 *
	 * @param priceInfo - A `CoinPriceInfo` object to cache in this instance.
	 */
	public setPriceInfo(priceInfo: CoinPriceInfo) {
		this.priceInfo = priceInfo;
	}

	/**
	 * Fetches a list of "verified" coin types from the Aftermath backend. Verified coins
	 * typically pass certain safety or liquidity checks.
	 *
	 * @returns An array of `CoinType` strings that are considered verified.
	 *
	 * @example
	 * ```typescript
	 * const verified = await coin.getVerifiedCoins();
	 * console.log(verified); // e.g. ["0x2::sui::SUI", "0x...::MYCOIN", ...]
	 * ```
	 */
	public async getVerifiedCoins() {
		return this.fetchApi<CoinType[]>("verified");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Coin Type
	// =========================================================================

	/**
	 * Extracts the Move package name portion from a coin type string.
	 * E.g., "0x2::sui::SUI" => "sui".
	 *
	 * @param coin - The coin type string (e.g., "0x2::sui::SUI").
	 * @returns The middle segment of the type or empty string if not parseable.
	 */
	public static getCoinTypePackageName = (coin: CoinType): string => {
		const splitCoin = coin.split("::");
		if (splitCoin.length !== 3) return "";
		const packageName = splitCoin[splitCoin.length - 2];
		if (!packageName) return "";
		return packageName;
	};

	/**
	 * Extracts the final part of the coin type (the symbol or short name).
	 * For example, "0x2::sui::SUI" => "SUI".
	 *
	 * @param coin - The coin type string.
	 * @returns The extracted symbol or empty string if not found.
	 */
	public static getCoinTypeSymbol = (coin: CoinType): string => {
		const startIndex = coin.lastIndexOf("::") + 2;
		// NOTE: should error if coin is not a valid coin type instead of empty string ?
		if (startIndex <= 1) return "";

		const foundEndIndex = coin.indexOf(">");
		const endIndex = foundEndIndex < 0 ? coin.length : foundEndIndex;

		const displayType = coin.slice(startIndex, endIndex);
		return displayType;
	};

	/**
	 * Extracts the inner generic argument of a coin type if present. E.g.,
	 * "0x2::coin::Coin<0x2::sui::SUI>" => "0x2::sui::SUI".
	 *
	 * @param coin - The coin type with a possible `<...>` suffix.
	 * @returns The inner type or an empty string if not found.
	 */
	public static getInnerCoinType = (coin: CoinType) =>
		coin.includes("<") ? coin.split("<")[1].slice(0, -1) : "";

	/**
	 * If a `KeyType` string references a type in angle brackets, extracts the type
	 * inside. Typically for "0x2::coin::Coin<0x2::mycoin::MYCOIN>" -> "0x2::mycoin::MYCOIN".
	 *
	 * @param keyType - The key type string to parse.
	 * @returns The substring inside `<...>` or the original if no brackets found.
	 */
	public static coinTypeFromKeyType = (keyType: KeyType) => {
		const startIndex = keyType.lastIndexOf("<") + 1;
		const endIndex = keyType.indexOf(">", startIndex);
		return keyType.slice(startIndex, endIndex);
	};

	/**
	 * Checks if a coin type string corresponds to the canonical SUI coin.
	 *
	 * @param coin - A coin type string.
	 * @returns `true` if it matches "0x2::sui::SUI", otherwise `false`.
	 */
	public static isSuiCoin = (coin: CoinType) =>
		Helpers.stripLeadingZeroesFromType(coin) ===
		Helpers.stripLeadingZeroesFromType(Coin.constants.suiCoinType);

	/**
	 * Checks if an object type string is a `Coin<...>` object from the standard Sui Move module.
	 *
	 * @param objectType - The object type to test.
	 * @returns `true` if it matches "0x2::coin::Coin<...>", otherwise `false`.
	 */
	public static isCoinObjectType = (objectType: AnyObjectType) =>
		Helpers.stripLeadingZeroesFromType(objectType).startsWith(
			Helpers.stripLeadingZeroesFromType(Coin.constants.coinObjectType)
		);

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Given a record of coin types => numeric amounts, filters out those
	 * with zero or negative amounts, returning only the positive pairs.
	 *
	 * @param coinAmounts - A record mapping coin types to numeric amounts.
	 * @returns An object with `coins` array and `amounts` array in matching indexes.
	 */
	public static coinsAndAmountsOverZero = (
		coinAmounts: Record<CoinType, number>
	) => {
		// NOTE: will these loops always run in same order (is this a js guarantee or not) ?
		const coins = Object.keys(coinAmounts).filter(
			(key) => coinAmounts[key] > 0
		);
		const amounts = Object.values(coinAmounts).filter(
			(amount) => amount > 0
		);

		return { coins, amounts };
	};

	/**
	 * Given a record of coin types => bigint balances, filters out those with zero
	 * or negative balances, returning only the positive pairs.
	 *
	 * @param coinsToBalance - A record mapping coin types to bigints.
	 * @returns An object with `coins` array and `balances` array in matching indexes.
	 */
	public static coinsAndBalancesOverZero = (
		coinsToBalance: CoinsToBalance
	) => {
		// NOTE: will these loops always run in same order (is this a js guarantee or not) ?
		const coins = Object.keys(coinsToBalance).filter(
			(key) => BigInt(coinsToBalance[key]) > BigInt(0)
		);
		const balances = Object.values(coinsToBalance)
			.map(BigInt)
			.filter((amount) => amount > BigInt(0));

		return { coins, balances };
	};

	/**
	 * Filters a list of `coinTypes` by a textual query, matching against both zero-padded
	 * and non-padded forms as well as substring checks.
	 *
	 * @param inputs - Contains `filter` (the search string) and `coinTypes`.
	 * @returns An array of coin types that match the filter in either raw or zero-padded form.
	 *
	 * @example
	 * ```typescript
	 * const filtered = Coin.filterCoinsByType({
	 *   filter: "sui",
	 *   coinTypes: ["0x2::sui::SUI", "0x<...>"]
	 * });
	 * ```
	 */
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

	/**
	 * Filters a record of coin metadata by a textual query, matching both the coin type
	 * and the metadata's name/symbol fields.
	 *
	 * @param inputs - An object containing `filter` and a record of `coinMetadatas`.
	 * @returns An array of coin types that match the search criteria.
	 */
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

	/**
	 * Converts a user-friendly decimal number (e.g., 1.5) to a raw on-chain
	 * integer representation by scaling with the given coin decimals.
	 * For example, `1.5` with `decimals = 9` => `1500000000n`.
	 *
	 * @param balance - The user-friendly balance as a number.
	 * @param decimals - Number of decimal places for this coin.
	 * @returns A bigint representing the raw on-chain balance.
	 */
	public static normalizeBalance = (
		balance: number,
		decimals: CoinDecimal
	): Balance => BigInt(Math.floor(balance * 10 ** decimals));

	/**
	 * Scales a raw bigint or numeric `amount` down by `decimals` to get a display-friendly float.
	 * For example, `1500000000n` with `decimals = 9` => `1.5`.
	 *
	 * @param amount - The raw on-chain amount as `bigint` or `number`.
	 * @param decimals - Number of decimal places for this coin.
	 * @returns The resulting float as an easily readable balance.
	 */
	public static balanceWithDecimals = (
		amount: bigint | number,
		decimals: number
	) => {
		// TODO: make this conversion via string so no overflow or loss when bigint to number ?
		return Number(amount) / Number(10 ** decimals);
	};

	/**
	 * Scales a raw `amount` down by `decimals` and multiplies by a `price` in USD,
	 * returning a final USD value. E.g., `1500000000n`, `decimals=9`, `price=2.0` => `3.0`.
	 *
	 * @param amount - The raw balance as bigint or number.
	 * @param decimals - The coin decimals.
	 * @param price - The coin's price in USD.
	 * @returns The computed float in USD.
	 */
	public static balanceWithDecimalsUsd = (
		amount: bigint | number,
		decimals: number,
		price: number
	) => {
		return Coin.balanceWithDecimals(amount, decimals) * price;
	};

	/**
	 * Looks up a coin's symbol if it is known in a provided `coinSymbolToCoinTypes`
	 * record. For instance, if "SUI" => `["0x2::sui::SUI"]`, we can find "SUI" from
	 * the coin type "0x2::sui::SUI".
	 *
	 * @param inputs - An object with `coinType` and `coinSymbolToCoinTypes`.
	 * @returns The coin symbol string or `undefined` if not found.
	 */
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
		} catch {
			return undefined;
		}
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	/**
	 * Internal method to retrieve a specialized coin-related API from `AftermathApi`.
	 * Throws an error if no provider is set.
	 */
	private useProvider = () => {
		const provider = this.Provider?.Coin();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

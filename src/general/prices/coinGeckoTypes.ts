import type { CoinSymbol, CoinType } from "../../types";

// =========================================================================
//  Coin Gecko
// =========================================================================

/**
 * A lowercase chain label supported by the CoinGecko price integration.
 *
 * The labels follow the Wormhole chain naming scheme. The union currently
 * includes `ethereum`, `arbitrum`, `bsc`, `solana`, `sui`, `polygon`,
 * `avalanche`, `optimism`, and `base`.
 */
export type CoinGeckoChain = Lowercase<
	| "Ethereum"
	| "Arbitrum"
	| "Bsc"
	| "Solana"
	| "Sui"
	| "Polygon"
	| "Avalanche"
	| "Optimism"
	| "Base"

	// | "Oasis"
	// | "Terra"
	// | "Algorand"
	// | "Aurora"
	// | "Fantom"
	// | "Karura"
	// | "Acala"
	// | "Klaytn"
	// | "Celo"
	// | "Near"
	// | "Moonbeam"
	// | "Neon"
	// | "Terra2"
	// | "Injective"
	// | "Osmosis"
	// | "Aptos"
	// | "Gnosis"
	// | "Pythnet"
	// | "Xpla"
	// | "Btc"
	// | "Sei"
	// | "Rootstock"
	// | "Scroll"
	// | "Mantle"
	// | "Blast"
	// | "Xlayer"
	// | "Linea"
	// | "Berachain"
	// | "Seievm"
	// | "Wormchain"
	// | "Cosmoshub"
	// | "Evmos"
	// | "Kujira"
	// | "Neutron"
	// | "Celestia"
	// | "Stargaze"
	// | "Seda"
	// | "Dymension"
	// | "Provenance"
	// | "Sepolia"
	// | "ArbitrumSepolia"
	// | "BaseSepolia"
	// | "OptimismSepolia"
	// | "Holesky"
	// | "PolygonSepolia"
>;

// =========================================================================
//  Name Only
// =========================================================================

/**
 * The string identifier that CoinGecko uses for a coin in its API.
 */
export type CoinGeckoCoinApiId = string;

// =========================================================================
//  Data
// =========================================================================

/**
 * Coin metadata that associates a CoinGecko identifier with a chain and coin
 * type.
 */
export interface CoinGeckoCoinData {
	/** The lowercase chain label, or `""` when no chain label is assigned. */
	chain: CoinGeckoChain | "";
	/** The coin's identifier in the CoinGecko API. */
	apiId: CoinGeckoCoinApiId;
	/** The coin's display name. */
	name: string;
	/** The coin's short symbol or ticker. */
	symbol: CoinSymbol;
	/** The coin type associated with this metadata record. */
	coinType: CoinType;
}

/**
 * Coin metadata that associates a CoinGecko identifier with a coin symbol.
 */
export interface CoinGeckoCoinSymbolData {
	/** The coin's identifier in the CoinGecko API. */
	apiId: CoinGeckoCoinApiId;
	/** The coin's display name. */
	name: string;
	/** The coin's short symbol or ticker. */
	symbol: CoinSymbol;
}

import { CoinSymbol, CoinType } from "../../types";

// =========================================================================
//  Coin Gecko
// =========================================================================

// NOTE: these are taken from wormhole chain naming scheme
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

export type CoinGeckoCoinApiId = string;

// =========================================================================
//  Data
// =========================================================================

export interface CoinGeckoCoinData {
	chain: CoinGeckoChain | "";
	apiId: CoinGeckoCoinApiId;
	name: string;
	symbol: CoinSymbol;
	coinType: CoinType;
}

export interface CoinGeckoCoinSymbolData {
	apiId: CoinGeckoCoinApiId;
	name: string;
	symbol: CoinSymbol;
}

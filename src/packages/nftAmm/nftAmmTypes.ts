import type {
	AnyObjectType,
	Balance,
	CoinType,
	Object,
	ObjectId,
	PoolObject,
	Slippage,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Objects
// =========================================================================

/**
 * Describes an NFT AMM market returned by the Aftermath API.
 *
 * The market exposes the pool used for pricing, the fractionalized coin that
 * represents one NFT share, and the Move type arguments required by NFT AMM
 * transaction calls. Balance fields use the smallest unit of their respective
 * coin and remain `bigint` values.
 */
export interface NftAmmMarketObject extends Object {
	/** Dynamic-field table that stores the NFTs available in this market. */
	nftsTable: {
		/** On-chain object ID of the NFT dynamic-field table. */
		objectId: ObjectId;
		/** Number of NFT entries currently stored in the table. */
		size: bigint;
	};
	/** Pool that prices the asset coin against the fractionalized coin. */
	pool: PoolObject;
	/** Total fractionalized coin supply in the coin's smallest unit. */
	fractionalizedSupply: Balance;
	/** Fractionalized coin amount represented by one NFT, in smallest units. */
	fractionalizedCoinAmount: Balance;
	/** Move coin type of the fractionalized coin. */
	fractionalizedCoinType: CoinType;
	/** Move coin type deposited into or received from the market pool. */
	assetCoinType: CoinType;
	/** Move coin type of the pool's liquidity-provider token. */
	lpCoinType: CoinType;
	/** Move object type of the NFTs traded by this market. */
	nftType: AnyObjectType;
}

// =========================================================================
//  Generic Types
// =========================================================================

/**
 * Move type arguments used by the NFT AMM interface and action functions.
 *
 * Keep this tuple in the order shown when passing it to a low-level transaction
 * command: LP coin, fractionalized coin, asset coin, then NFT object type.
 */
export type NftAmmInterfaceGenericTypes = [
	/** Move type of the liquidity-provider token. */
	lpCoinType: CoinType,
	/** Move type of the fractionalized coin. */
	fractionalizedCoinType: CoinType,
	/** Move type of the market's asset coin. */
	assetCoinType: CoinType,
	/** Move type of the traded NFTs. */
	nftType: AnyObjectType,
];

// =========================================================================
//  API
// =========================================================================

/**
 * Inputs for building a transaction that buys selected NFTs from an NFT AMM
 * market.
 */
export interface ApiNftAmmBuyBody {
	/** On-chain object ID of the NFT AMM market. */
	marketObjectId: ObjectId;
	/** Transaction sender and wallet that supplies the asset coin. */
	walletAddress: SuiAddress;
	/** On-chain IDs of the NFTs to buy from the market. */
	nftObjectIds: ObjectId[];
	/** Decimal slippage tolerance, where `0.01` means 1%. */
	slippage: Slippage;
	/** Optional referral address used for referral-aware quote calculations. */
	referrer?: SuiAddress;
}

/**
 * Inputs for building a transaction that sells selected NFTs to an NFT AMM
 * market.
 */
export interface ApiNftAmmSellBody {
	/** On-chain object ID of the NFT AMM market. */
	marketObjectId: ObjectId;
	/** Transaction sender and wallet that owns the NFTs. */
	walletAddress: SuiAddress;
	/** On-chain IDs of the NFTs to sell into the market. */
	nftObjectIds: ObjectId[];
	/** Decimal slippage tolerance, where `0.01` means 1%. */
	slippage: Slippage;
	/** Optional referral address used for referral-aware quote calculations. */
	referrer?: SuiAddress;
}

/**
 * Inputs for building a transaction that deposits an asset coin and NFTs into
 * an NFT AMM market.
 */
export interface ApiNftAmmDepositBody {
	/** Transaction sender and wallet that owns the deposit inputs. */
	walletAddress: SuiAddress;
	/** On-chain object ID of the NFT AMM market. */
	marketObjectId: ObjectId;
	/** Asset-coin amount to deposit, in the asset coin's smallest unit. */
	assetCoinAmountIn: Balance;
	/** On-chain IDs of the NFTs to deposit. */
	nftObjectIds: ObjectId[];
	/** Decimal slippage tolerance, where `0.01` means 1%. */
	slippage: Slippage;
	/** Optional referral address used for referral-aware quote calculations. */
	referrer?: SuiAddress;
}

/**
 * Inputs for building a transaction that withdraws an asset coin and selected
 * NFTs from an NFT AMM market.
 */
export interface ApiNftAmmWithdrawBody {
	/** Transaction sender and wallet that owns the LP coin input. */
	walletAddress: SuiAddress;
	/** On-chain object ID of the NFT AMM market. */
	marketObjectId: ObjectId;
	/** LP-coin amount to burn, in the LP coin's smallest unit. */
	lpCoinAmount: Balance;
	/** On-chain IDs of the NFTs to withdraw. */
	nftObjectIds: ObjectId[];
	/** Decimal slippage tolerance, where `0.01` means 1%. */
	slippage: Slippage;
	/** Optional referral address used for referral-aware quote calculations. */
	referrer?: SuiAddress;
}

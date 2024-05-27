import {
	AnyObjectType,
	Balance,
	CoinType,
	Object,
	PoolObject,
	Slippage,
	Url,
	ObjectId,
	SuiAddress,
} from "../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface NftAmmMarketObject extends Object {
	nftsTable: {
		objectId: ObjectId;
		size: bigint;
	};
	pool: PoolObject;
	fractionalizedSupply: Balance;
	fractionalizedCoinAmount: Balance;
	fractionalizedCoinType: CoinType;
	assetCoinType: CoinType;
	lpCoinType: CoinType;
	nftType: AnyObjectType;
}

// =========================================================================
//  Generic Types
// =========================================================================

export type NftAmmInterfaceGenericTypes = [
	lpCoinType: CoinType,
	fractionalizedCoinType: CoinType,
	assetCoinType: CoinType,
	nftType: AnyObjectType
];

// =========================================================================
//  API
// =========================================================================

export interface ApiNftAmmBuyBody {
	marketObjectId: ObjectId;
	walletAddress: SuiAddress;
	nftObjectIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiNftAmmSellBody {
	marketObjectId: ObjectId;
	walletAddress: SuiAddress;
	nftObjectIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiNftAmmDepositBody {
	walletAddress: SuiAddress;
	marketObjectId: ObjectId;
	assetCoinAmountIn: Balance;
	nftObjectIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}

export interface ApiNftAmmWithdrawBody {
	walletAddress: SuiAddress;
	marketObjectId: ObjectId;
	lpCoinAmount: Balance;
	nftObjectIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}

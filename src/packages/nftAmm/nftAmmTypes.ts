import { ObjectId, SuiAddress, TransactionDigest } from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	CoinType,
	Object,
	PoolObject,
	Slippage,
	Url,
} from "../../types";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

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

/////////////////////////////////////////////////////////////////////
//// Object Display
/////////////////////////////////////////////////////////////////////

export interface Nft {
	info: NftInfo;
	display: NftDisplay;
}

export interface NftInfo {
	objectId: ObjectId;
	version: string;
	digest: TransactionDigest;
	type?: AnyObjectType;
}

export interface NftDisplay {
	suggested: NftDisplaySuggested;
	other: NftDisplayOther;
}

export interface NftDisplaySuggested {
	name?: string;
	link?: Url;
	imageUrl?: Url;
	description?: string;
	projectUrl?: Url;
	creator?: string;
}

export type NftDisplayOther = Record<string, string>;

/////////////////////////////////////////////////////////////////////
//// Generic Types
/////////////////////////////////////////////////////////////////////

export type NftAmmInterfaceGenericTypes = [
	lpCoinType: CoinType,
	fractionalizedCoinType: CoinType,
	assetCoinType: CoinType,
	nftType: AnyObjectType
];

/////////////////////////////////////////////////////////////////////
//// API
/////////////////////////////////////////////////////////////////////

export interface ApiNftAmmDepositBody {
	walletAddress: SuiAddress;
	marketObjectId: ObjectId;
	assetCoinAmountIn: Balance;
	nftObjectIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}

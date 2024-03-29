import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	AnyObjectType,
	Balance,
	CoinsToBalance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	Nft,
	NftAmmMarketData,
	ObjectId,
	Slippage,
	SuiAddress,
	SuiNetwork,
} from "../../types";
import { AftermathApi } from "../../general/providers";
import { Pool } from "..";

export interface NftAmmMarketInterface {
	// =========================================================================
	//  Class Members
	// =========================================================================

	readonly pool: Pool;
	readonly market: NftAmmMarketData;
	readonly network?: SuiNetwork;

	// =========================================================================
	//  Objects
	// =========================================================================

	getNfts: NftAmmMarketGetNfts;
	getAllNfts: NftAmmMarketGetAllNfts;

	// =========================================================================
	//  Calculations
	// =========================================================================

	// TODO: clean all this up / do this more effectively
	getNftSpotPriceInAfSui: (inputs?: { withFees: boolean }) => Balance;
	getFractionalCoinToAfSuiSpotPrice: (inputs?: {
		withFees: boolean;
	}) => number;
	getAfSuiToFractionalCoinSpotPrice: (inputs?: {
		withFees: boolean;
	}) => number;
	getBuyAfSuiAmountIn: (inputs: {
		nftsCount: number;
		referral?: boolean;
	}) => Balance;
	getSellAfSuiAmountOut: (inputs: {
		nftsCount: number;
		referral?: boolean;
	}) => Balance;
	getDepositLpAmountOut: (inputs: {
		amountsIn: CoinsToBalance;
		referral?: boolean;
	}) => {
		lpAmountOut: Balance;
		lpRatio: number;
	};
	getDepositNftsLpAmountOut: (inputs: {
		nftsCount: number;
		referral?: boolean;
	}) => {
		lpAmountOut: Balance;
		lpRatio: number;
	};
	getWithdrawFractionalCoinAmountOut: (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}) => Balance;
	getWithdrawAfSuiAmountOut: (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}) => Balance;
	getWithdrawNftsCountOut: (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}) => bigint;

	// =========================================================================
	//  Getters
	// =========================================================================

	fractionalCoinType: () => CoinType;
	afSuiCoinType: () => CoinType;
	lpCoinType: () => CoinType;
	nftType: () => AnyObjectType;
	fractionsAmount: () => Balance;

	// =========================================================================
	//  Transactions
	// =========================================================================

	getBuyNftsTransaction: NftAmmMarketGetBuyNftsTransaction;
	getSellNftsTransaction: NftAmmMarketGetSellNftsTransaction;
	getDepositNftsTransaction: NftAmmMarketGetDepositNftsTransaction;
	getWithdrawNftsTransaction: NftAmmMarketGetWithdrawNftsTransaction;
}

export type NftAmmMarketGetNfts = (inputs: {
	cursor?: ObjectId;
	limit?: number;
}) => Promise<DynamicFieldObjectsWithCursor<Nft>>;

export type NftAmmMarketGetAllNfts = () => Promise<Nft[]>;

export type NftAmmMarketGetBuyNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetSellNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	kioskIds: ObjectId[];
	kioskOwnerCapIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetDepositNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	kioskIds: ObjectId[];
	kioskOwnerCapIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetWithdrawNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	lpCoinAmount: Balance;
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

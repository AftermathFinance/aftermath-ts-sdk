import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	AnyObjectType,
	Balance,
	CoinDecimal,
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
	getBuyNftsAfSuiAmountIn: (inputs: {
		nftsCount: number;
		// slippage: Slippage;
		referral?: boolean;
	}) => Balance;
	getSellNftsAfSuiAmountOut: (inputs: {
		nftsCount: number;
		referral?: boolean;
	}) => Balance;
	getBuyFractionalCoinAfSuiAmountIn: (inputs: {
		fractionalAmountOut: Balance;
		// slippage: Slippage;
		referral?: boolean;
	}) => Balance;
	getBuyFractionalCoinAmountOut: (inputs: {
		afSuiAmountIn: Balance;
		referral?: boolean;
	}) => Balance;
	getSellFractionalCoinAfSuiAmountOut: (inputs: {
		fractionalAmountIn: Balance;
		referral?: boolean;
	}) => Balance;
	getSellFractionalCoinAmountIn: (inputs: {
		afSuiAmountOut: Balance;
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
		lpCoinAmount: Balance;
		referral?: boolean;
	}) => Balance;
	getWithdrawAfSuiAmountOut: (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}) => Balance;
	getWithdrawAmountsOut: (inputs: {
		lpCoinAmount: Balance;
		amountsOutDirection: CoinsToBalance;
		referral?: boolean;
	}) => CoinsToBalance;
	getWithdrawNftsCountOut: (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}) => number;
	getWithdrawNftsLpAmountIn: (inputs: {
		nftsCount: number;
		slippage: Slippage;
		referral?: boolean;
	}) => Balance;
	getWithdrawLpAmountIn: (inputs: {
		amountsOut: CoinsToBalance;
		referral?: boolean;
	}) => Balance;
	getNftEquivalence: (inputs: {
		fractionalAmount: Balance | number;
	}) => number;
	getFractionalCoinEquivalence: (inputs: { nftsCount: number }) => Balance;

	// =========================================================================
	//  Getters
	// =========================================================================

	fractionalCoinType: () => CoinType;
	afSuiCoinType: () => CoinType;
	lpCoinType: () => CoinType;
	nftType: () => AnyObjectType;
	fractionsAmount: () => Balance;
	fractionalCoinDecimals: () => CoinDecimal;
	lpCoinDecimals: () => CoinDecimal;
	afSuiCoinDecimals: () => CoinDecimal;

	// =========================================================================
	//  NFT Transactions
	// =========================================================================

	getBuyNftsTransaction: NftAmmMarketGetBuyNftsTransaction;
	getSellNftsTransaction: NftAmmMarketGetSellNftsTransaction;
	getDepositNftsTransaction: NftAmmMarketGetDepositNftsTransaction;
	getWithdrawNftsTransaction: NftAmmMarketGetWithdrawNftsTransaction;

	// =========================================================================
	//  Coin Transactions
	// =========================================================================

	getBuyFractionalCoinTransaction: NftAmmMarketGetBuyFractionalCoinTransaction;
	getSellFractionalCoinTransaction: NftAmmMarketGetSellFractionalCoinTransaction;
	getDepositCoinsTransaction: NftAmmMarketGetDepositCoinsTransaction;
	getWithdrawCoinsTransaction: NftAmmMarketGetWithdrawCoinsTransaction;
}

export type NftAmmMarketGetNfts = (inputs: {
	cursor?: ObjectId;
	limit?: number;
}) => Promise<DynamicFieldObjectsWithCursor<Nft>>;

export type NftAmmMarketGetAllNfts = () => Promise<Nft[]>;

// =========================================================================
//  NFT Transactions
// =========================================================================

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
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

// =========================================================================
//  Coin Transactions
// =========================================================================

export type NftAmmMarketGetBuyFractionalCoinTransaction = (inputs: {
	walletAddress: SuiAddress;
	fractionalAmountOut: Balance;
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetSellFractionalCoinTransaction = (inputs: {
	walletAddress: SuiAddress;
	fractionalAmountIn: Balance;
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetDepositCoinsTransaction = (inputs: {
	walletAddress: SuiAddress;
	amountsIn: CoinsToBalance;
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetWithdrawCoinsTransaction = (inputs: {
	walletAddress: SuiAddress;
	amountsOutDirection: CoinsToBalance;
	lpCoinAmount: Balance;
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

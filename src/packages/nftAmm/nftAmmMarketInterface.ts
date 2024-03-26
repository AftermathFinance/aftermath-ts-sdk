import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	Balance,
	DynamicFieldObjectsWithCursor,
	Nft,
	ObjectId,
	Slippage,
	SuiAddress,
} from "../../types";

export interface NftAmmMarketInterface {
	getNfts: NftAmmMarketGetNfts;
	getBuyNftsTransaction: NftAmmMarketGetBuyNftsTransaction;
	getSellNftsTransaction: NftAmmMarketGetSellNftsTransaction;
	getDepositNftsTransaction: NftAmmMarketGetDepositNftsTransaction;
	getWithdrawNftsTransaction: NftAmmMarketGetWithdrawNftsTransaction;
}

export type NftAmmMarketGetNfts = (inputs: {
	cursor?: ObjectId;
	limit?: number;
}) => Promise<DynamicFieldObjectsWithCursor<Nft>>;

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

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
	getBuyTransaction: NftAmmMarketGetBuyTransaction;
	getSellTransaction: NftAmmMarketGetSellTransaction;
	getDepositTransaction: NftAmmMarketGetDepositTransaction;
	getWithdrawTransaction: NftAmmMarketGetWithdrawTransaction;
}

export type NftAmmMarketGetNfts = (inputs: {
	cursor?: ObjectId;
	limit?: number;
}) => Promise<DynamicFieldObjectsWithCursor<Nft>>;

export type NftAmmMarketGetBuyTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetSellTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	kioskIds: ObjectId[];
	kioskOwnerCapIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetDepositTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	kioskIds: ObjectId[];
	kioskOwnerCapIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type NftAmmMarketGetWithdrawTransaction = (inputs: {
	walletAddress: SuiAddress;
	lpCoinAmount: Balance;
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

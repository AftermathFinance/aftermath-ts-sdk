import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	AnyObjectType,
	Balance,
	CoinDecimal,
	CoinType,
	DynamicFieldObjectsWithCursor,
	FractionalNftsVaultObject,
	Nft,
	ObjectId,
	Slippage,
	SuiAddress,
	SuiNetwork,
} from "../../types";

export interface FractionalNftsVaultInterface {
	// =========================================================================
	//  Class Members
	// =========================================================================

	readonly vault: FractionalNftsVaultObject;
	readonly network?: SuiNetwork;

	// =========================================================================
	//  Objects
	// =========================================================================

	getNfts: FractionalNftsVaultGetNfts;
	getAllNfts: FractionalNftsVaultGetAllNfts;

	// =========================================================================
	//  Calculations
	// =========================================================================

	// TODO: clean all this up / do this more effectively
	getNftEquivalence: (inputs: { fractionalAmount: Balance }) => number;
	getFractionalCoinEquivalence: (inputs: { nftsCount: number }) => Balance;

	// =========================================================================
	//  Getters
	// =========================================================================

	fractionalCoinType: () => CoinType;
	nftType: () => AnyObjectType;
	fractionsAmount: () => Balance;

	// =========================================================================
	//  Transactions
	// =========================================================================

	getDepositNftsTransaction: FractionalNftsVaultGetDepositNftsTransaction;
	getWithdrawNftsTransaction: FractionalNftsVaultGetWithdrawNftsTransaction;
}

export type FractionalNftsVaultGetNfts = (inputs: {
	cursor?: ObjectId;
	limit?: number;
}) => Promise<DynamicFieldObjectsWithCursor<Nft>>;

export type FractionalNftsVaultGetAllNfts = () => Promise<Nft[]>;

// =========================================================================
//  Transactions
// =========================================================================

export type FractionalNftsVaultGetDepositNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	kioskIds: ObjectId[];
	kioskOwnerCapIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

export type FractionalNftsVaultGetWithdrawNftsTransaction = (inputs: {
	walletAddress: SuiAddress;
	nftIds: ObjectId[];
	slippage: Slippage;
	referrer?: SuiAddress;
}) => Promise<TransactionBlock>;

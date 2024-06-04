import { ObjectId, SuiAddress } from "../../types";
import { CoinType } from "../coin/coinTypes";
import {
	Balance,
	Event,
	IFixed,
	Object,
	Timestamp,
} from "../../general/types/generalTypes";


// =========================================================================
// Helpers
// =========================================================================

export type DcaVaultOrders = DcaVaultOrder[];

// =========================================================================
//  Initialize Vault
// =========================================================================

export interface ApiDcaInitializeVaultStrategy {
    priceMin: Balance;
    priceMax: Balance;
}

export interface ApiDcaInitializeVaultBody {
	walletAddress: SuiAddress;
	allocateCoinType: CoinType;
	allocateCoinAmount: Balance;
    buyCoinType: CoinType;
	timeInterval: Timestamp;
	orderCount: Timestamp;
    straregy?: ApiDcaInitializeVaultStrategy;
}

// =========================================================================
//  DCA Vault
// =========================================================================

export interface DcaVaultOrder {
	allocatedCoin: CoinType;
	allocatedCoinAmount: Balance;
	buyCoin: CoinType;
	buyCoinAmount: Balance;
	buyDate: Timestamp;
}

export interface DcaVaultObject {
	currentAllocatedCoin: CoinType;
	currentAllocatedCoinAmount: Balance;
	currentBuyCoin: CoinType;
	currentBuyCoinAmount: Balance;
	widthrowAmount: Balance;
	totalDeposited: Balance;
	totalSpent: Balance;
	averagePrice: Balance;
	interval: IFixed;
	ordersRemaining: Balance;
	orders: DcaVaultOrders;
}

export interface DcaVaultsOjbect {
	active: DcaVaultObject[];
	past: DcaVaultObject[];
}

// =========================================================================
//  API
// =========================================================================

export interface DcaCreatedVaultEvent extends Event {
	
	// Todo: - update with real smart-contract data

	vaultId: ObjectId;
	allocatedCoin: CoinType;
	allocatedCoinAmount: Balance;
	buyCoin: CoinType;
	buyCoinAmount: Balance;
}

// =========================================================================
//  Owned DCAs
// =========================================================================

export interface ApiDCAsOwnedBody {
	walletAddress: SuiAddress;
}
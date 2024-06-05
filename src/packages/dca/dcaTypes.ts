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

export type DcaVaultOrders = DcaVaultOrderObject[];

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

export interface DcaVaultOrderObject {
	allocatedCoin: CoinType;
	allocatedCoinAmount: Balance;
	buyCoin: CoinType;
	buyCoinAmount: Balance;
	buyDate: Timestamp;
	rate: number;
}

export interface DcaVaultOverviewObject {
	allocatedCoin: CoinType;
	buyCoin: CoinType;
	startAllocatedCoinAmount: Balance;
	currentAllocatedCoinAmount: Balance;
	buyCoinAmount: Balance;
	widthrowAmount: Balance;
	progress: number;

	totalDeposited: Balance;
	totalSpent: Balance;
	eachOrderSize: Balance;
	averagePrice: Balance;

	totalOrders: number;
	interval: IFixed;
	ordersRemaining: number;
	created: Timestamp;
}

export interface DcaVaultObject {
	overview: DcaVaultOverviewObject;
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
import { SuiAddress } from "@mysten/sui.js";
import { CoinType } from "../../../coin/coinTypes";
import {
	Balance,
	RouterAsyncSerializablePool,
	SerializedTransaction,
} from "../../../../types";

// =========================================================================
//  Interface
// =========================================================================

export interface RouterAsyncApiInterface<
	PoolType extends RouterAsyncSerializablePool
> {
	// =========================================================================
	//  Required
	// =========================================================================

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	fetchPoolsForTrade: (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
		maxPools: number;
	}) => Promise<{
		partialMatchPools: PoolType[];
		exactMatchPools: PoolType[];
	}>;

	// =========================================================================
	//  Inspections
	// =========================================================================

	fetchTradeAmountOut: (inputs: {
		pool: PoolType;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}) => Promise<Balance>;

	// fetchTradeAmountIn: (inputs: {
	// 	walletAddress: SuiAddress;
	// 	pool: PoolType;
	// 	coinInType: CoinType;
	// 	coinOutType: CoinType;
	// 	coinInAmount: Balance;
	// }) => Promise<Balance>;

	otherCoinInPool: (inputs: {
		coinType: CoinType;
		pool: PoolType;
	}) => CoinType;
}

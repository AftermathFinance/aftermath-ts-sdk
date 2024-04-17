import { CoinType } from "../../../coin/coinTypes";
import { Balance, RouterAsyncSerializablePool } from "../../../../types";

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

	fetchAllPools: () => Promise<PoolType[]>;

	filterPoolsForTrade: (inputs: {
		pools: PoolType[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		partialMatchPools: PoolType[];
		exactMatchPools: PoolType[];
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	fetchTradeAmountOut: (inputs: {
		pool: PoolType;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}) => Promise<{
		coinOutAmount: Balance;
		feeInAmount: Balance;
		feeOutAmount: Balance;
	}>;

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

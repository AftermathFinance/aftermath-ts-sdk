import { CoinType } from "../../coin/coinTypes";
import {
	BigIntAsString,
	Event,
	Object,
	RouterSerializablePool,
	ObjectId,
	SuiAddress,
} from "../../../types";
import {
	EventOnChain,
	SupplyOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export type BlueMovePoolObject = PartialBlueMovePoolObject &
	(
		| {
				stable: {
					xScale: bigint;
					yScale: bigint;
					fee: bigint;
					daoFee: bigint;
				};
		  }
		| {
				uncorrelated: {
					feeAmountValue: bigint;
					// minimumLiqValue: bigint;
					// kLast: bigint;
					// reserveX: bigint;
					// reserveY: bigint;
				};
		  }
	);
interface PartialBlueMovePoolObject extends Object {
	creator: SuiAddress;
	tokenXValue: bigint;
	tokenYValue: bigint;
	lspSupplyValue: bigint;
	feeXValue: bigint;
	feeYValue: bigint;
	isFreeze: boolean;
	coinTypeX: CoinType;
	coinTypeY: CoinType;
}

export const isBlueMovePoolObject = (
	pool: RouterSerializablePool
): pool is BlueMovePoolObject => {
	return (
		"creator" in pool &&
		"tokenXValue" in pool &&
		"lspSupplyValue" in pool &&
		"feeXValue" in pool &&
		"isFreeze" in pool &&
		"coinTypeX" in pool &&
		("uncorrelated" in pool || "stable" in pool)
	);
};

export interface BlueMovePoolCreatedEvent extends Event {
	poolId: ObjectId;
	creator: SuiAddress;
	tokenXName: string;
	tokenYName: string;
	tokenXAmountIn: bigint;
	tokenYAmountIn: bigint;
	lspBalance: bigint;
}

// =========================================================================
//  On-Chain
// =========================================================================

export interface BlueMovePoolFieldsOnChain {
	creator: SuiAddress;
	token_x: BigIntAsString;
	token_y: BigIntAsString;
	lsp_supply: SupplyOnChain;
	fee_amount: BigIntAsString;
	fee_x: BigIntAsString;
	fee_y: BigIntAsString;
	minimum_liq: BigIntAsString;
	k_last: BigIntAsString;
	reserve_x: BigIntAsString;
	reserve_y: BigIntAsString;
	is_freeze: boolean;
}

export interface BlueMoveStablePoolFieldsOnChain {
	creator: SuiAddress;
	token_x: BigIntAsString;
	token_y: BigIntAsString;
	lsp_supply: SupplyOnChain;
	fee_x: BigIntAsString;
	fee_y: BigIntAsString;
	last_price_x_cumulative: BigIntAsString;
	last_price_y_cumulative: BigIntAsString;
	x_scale: BigIntAsString;
	y_scale: BigIntAsString;
	is_freeze: boolean;
	fee: BigIntAsString;
	dao_fee: BigIntAsString;
	last_block_timestamp: BigIntAsString;
}

export type BlueMoveCreatedPoolEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	creator: BigIntAsString;
	token_x_name: string;
	token_y_name: string;
	token_x_amount_in: BigIntAsString;
	token_y_amount_in: BigIntAsString;
	lsp_balance: BigIntAsString;
}>;

export type BlueMoveCreatedStablePoolEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	creator: BigIntAsString;
	token_x_name: string;
	token_y_name: string;
	token_x_amount_in: BigIntAsString;
	token_y_amount_in: BigIntAsString;
	lsp_balance: BigIntAsString;
}>;

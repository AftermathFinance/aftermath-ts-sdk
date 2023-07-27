import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	BigIntAsString,
	CoinType,
	Event,
	Object,
	RouterSerializablePool,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface SuiswapPoolObject extends Object {
	version: bigint;
	owner: SuiAddress;
	index: bigint;
	poolType: "v2" | "stable";
	lspSupply: bigint;
	isFrozen: boolean;
	tradeEpoch: bigint;
	feeDirection: "X" | "Y";
	feeAdmin: bigint;
	feeLp: bigint;
	feeTh: bigint;
	feeWithdraw: bigint;
	stableAmp: bigint;
	stableXScale: bigint;
	stableYScale: bigint;
	xValue: bigint;
	yValue: bigint;
	xAdminValue: bigint;
	yAdminValue: bigint;
	xThValue: bigint;
	yThValue: bigint;
	bx: bigint;
	by: bigint;
	coinTypeX: CoinType;
	coinTypeY: CoinType;
}

export const isSuiswapPoolObject = (
	pool: RouterSerializablePool
): pool is SuiswapPoolObject => {
	return (
		"poolType" in pool &&
		"lspSupply" in pool &&
		"xValue" in pool &&
		"bx" in pool
	);
};

export interface SuiswapPoolCreateEvent extends Event {
	poolId: ObjectId;
}

// =========================================================================
//  On-Chain
// =========================================================================

export interface SuiswapPoolFieldsOnChain {
	version: BigIntAsString;
	owner: SuiAddress;
	index: BigIntAsString;
	pool_type: BigIntAsString;
	lsp_supply: BigIntAsString;
	freeze: BigIntAsString;
	trade_epoch: BigIntAsString;
	fee: {
		fields: {
			direction: BigIntAsString;
			admin: BigIntAsString;
			lp: BigIntAsString;
			th: BigIntAsString;
			withdraw: BigIntAsString;
		};
	};
	stable: {
		fields: {
			amp: BigIntAsString;
			x_scale: BigIntAsString;
			y_scale: BigIntAsString;
		};
	};
	balance: {
		fields: {
			x: BigIntAsString;
			y: BigIntAsString;
			x_admin: BigIntAsString;
			y_admin: BigIntAsString;
			x_th: BigIntAsString;
			y_th: BigIntAsString;
			bx: BigIntAsString;
			by: BigIntAsString;
		};
	};
}

export type SuiswapPoolCreateEventOnChain = EventOnChain<{
	pool_id: ObjectId;
}>;

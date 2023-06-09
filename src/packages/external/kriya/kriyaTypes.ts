import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { CoinDecimal, CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	Event,
	Object,
	RouterSerializablePool,
} from "../../../types";
import {
	EventOnChain,
	SupplyOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface KriyaPoolObject extends Object {
	objectType: AnyObjectType;
	tokenYValue: bigint;
	tokenXValue: bigint;
	lspSupplyValue: bigint;
	lspLockedValue: bigint;
	lpFeePercent: bigint;
	protocolFeePercent: bigint;
	protocolFeeXValue: bigint;
	protocolFeeYValue: bigint;
	isStable: boolean;
	scalex: bigint;
	scaley: bigint;
	isSwapEnabled: boolean;
	isDepositEnabled: boolean;
	isWithdrawEnabled: boolean;
	coinTypeX: CoinType;
	coinTypeY: CoinType;
}

export const isKriyaPoolObject = (
	pool: RouterSerializablePool
): pool is KriyaPoolObject => {
	return (
		"tokenYValue" in pool &&
		"lspSupplyValue" in pool &&
		"lspLockedValue" in pool &&
		"lpFeePercent" in pool &&
		"protocolFeePercent" in pool &&
		"protocolFeeXValue" in pool &&
		"isStable" in pool &&
		"scalex" in pool &&
		"isSwapEnabled" in pool &&
		"isDepositEnabled" in pool
	);
};

export interface KriyaPoolCreatedEvent extends Event {
	poolId: ObjectId;
	creator: SuiAddress;
	lpFeePercent: bigint;
	protocolFeePercent: bigint;
	isStable: boolean;
	scaleX: bigint;
	scaleY: bigint;
}

// =========================================================================
//  On-Chain
// =========================================================================

export interface KriyaPoolFieldsOnChain {
	token_y: {
		value: BigIntAsString;
	};
	token_x: {
		value: BigIntAsString;
	};
	lsp_supply: SupplyOnChain;
	lsp_locked: {
		value: BigIntAsString;
	};
	lp_fee_percent: BigIntAsString;
	protocol_fee_percent: BigIntAsString;
	protocol_fee_x: {
		value: BigIntAsString;
	};
	protocol_fee_y: {
		value: BigIntAsString;
	};
	is_stable: boolean;
	scaleX: BigIntAsString;
	scaleY: BigIntAsString;
	is_swap_enabled: boolean;
	is_deposit_enabled: boolean;
	is_withdraw_enabled: boolean;
}

export type KriyaPoolCreatedEventOnChain = EventOnChain<{
	pool_id: ObjectId;
	creator: SuiAddress;
	lp_fee_percent: BigIntAsString;
	protocol_fee_percent: BigIntAsString;
	is_stable: boolean;
	scaleX: BigIntAsString;
	scaleY: BigIntAsString;
}>;

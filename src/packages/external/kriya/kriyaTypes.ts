import { CoinDecimal, CoinType } from "../../coin/coinTypes";
import {
	AnyObjectType,
	Balance,
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
	scaleX: bigint;
	scaleY: bigint;
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
		"scaleX" in pool &&
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
	token_y: BigIntAsString;
	token_x: BigIntAsString;
	lsp_supply: SupplyOnChain;
	lsp_locked: BigIntAsString;
	lp_fee_percent: BigIntAsString;
	protocol_fee_percent: BigIntAsString;
	protocol_fee_x: BigIntAsString;
	protocol_fee_y: BigIntAsString;
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

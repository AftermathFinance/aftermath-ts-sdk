import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../types";
import {
	EventOnChain,
	IndexerEventOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Events
// =========================================================================

export interface ValidatorConfigFieldsOnChain {
	sui_address: SuiAddress;
	operation_cap_id: ObjectId;
	fee: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type StakeRequestEventOnChain = IndexerEventOnChain<{
	sui_id: ObjectId;
	staked_sui_id: ObjectId;
	sui_amount: BigIntAsString;
	staker: BigIntAsString;
	validator: SuiAddress;
	epoch: BigIntAsString;
	validator_fee: BigIntAsString;
	is_restaked: boolean;
	referrer: SuiAddress | null;
}>;

export type UnstakeEventOnChain = IndexerEventOnChain<{
	afsui_id: ObjectId;
	payback_coin_id: ObjectId;
	provided_afsui_amount: BigIntAsString;
	withdrawn_sui_amount: BigIntAsString;
	staker: BigIntAsString;
	epoch: BigIntAsString;
}>;

export type AfSuiMintedEventOnChain = IndexerEventOnChain<{
	sui_id: ObjectId;
	staked_sui_amount: BigIntAsString;
	minted_afsui_amount: BigIntAsString;
	staker: BigIntAsString;
	epoch: BigIntAsString;
}>;

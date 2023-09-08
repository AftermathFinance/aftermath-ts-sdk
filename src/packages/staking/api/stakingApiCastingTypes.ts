import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import {
	EventOnChain,
	IndexerEventOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface ValidatorConfigFieldsOnChain {
	sui_address: SuiAddress;
	operation_cap_id: ObjectId;
	fee: BigIntAsString;
}

// =========================================================================
//  Events Fields
// =========================================================================

export interface StakeRequestEventOnChainFields {
	sui_id: ObjectId;
	staked_sui_id: ObjectId;
	sui_amount: BigIntAsString;
	staker: BigIntAsString;
	validator: SuiAddress;
	epoch: BigIntAsString;
	validator_fee: BigIntAsString;
	is_restaked: boolean;
	referrer: SuiAddress | null;
}

export interface UnstakeEventOnChainFields {
	afsui_id: ObjectId;
	payback_coin_id: ObjectId;
	provided_afsui_amount: BigIntAsString;
	withdrawn_sui_amount: BigIntAsString;
	staker: BigIntAsString;
	epoch: BigIntAsString;
}

export interface AfSuiMintedEventOnChainFields {
	sui_id: ObjectId;
	staked_sui_amount: BigIntAsString;
	minted_afsui_amount: BigIntAsString;
	staker: BigIntAsString;
	epoch: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type StakeRequestEventOnChain =
	EventOnChain<StakeRequestEventOnChainFields>;

export type UnstakeEventOnChain = EventOnChain<UnstakeEventOnChainFields>;

export type AfSuiMintedEventOnChain =
	EventOnChain<AfSuiMintedEventOnChainFields>;

// =========================================================================
//  Indexer Events
// =========================================================================

export type StakeRequestIndexerEventOnChain =
	IndexerEventOnChain<StakeRequestEventOnChainFields>;

export type UnstakeIndexerEventOnChain =
	IndexerEventOnChain<UnstakeEventOnChainFields>;

export type AfSuiMintedIndexerEventOnChain =
	IndexerEventOnChain<AfSuiMintedEventOnChainFields>;

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

export interface ValidatorOperationCapFieldsOnChain {
	authorizer_validator_address: SuiAddress;
}

// =========================================================================
//  Events Fields
// =========================================================================

export interface StakedEventOnChainFields {
	staker: SuiAddress;
	validator: SuiAddress;
	staked_sui_id: ObjectId;
	sui_id: ObjectId;
	sui_amount: BigIntAsString;
	afsui_id: ObjectId;
	afsui_amount: BigIntAsString;
	validator_fee: BigIntAsString;
	referrer: SuiAddress | null;
	epoch: BigIntAsString;
	is_restaked: boolean;
}

export interface UnstakedEventOnChainFields {
	afsui_id: ObjectId;
	provided_afsui_amount: BigIntAsString;
	sui_id: ObjectId;
	returned_sui_amount: BigIntAsString;
	requester: SuiAddress;
	epoch: BigIntAsString;
}

export interface UnstakeRequestedEventOnChainFields {
	afsui_id: ObjectId;
	provided_afsui_amount: BigIntAsString;
	requester: SuiAddress;
	epoch: BigIntAsString;
}

export interface EpochWasChangedEventOnChainFields {
	active_epoch: BigIntAsString;
	total_afsui_supply: BigIntAsString;
	total_rewards_amount: BigIntAsString;
	total_sui_amount: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type StakedEventOnChain = EventOnChain<StakedEventOnChainFields>;

export type UnstakedEventOnChain = EventOnChain<UnstakedEventOnChainFields>;

export type UnstakeRequestedEventOnChain =
	EventOnChain<UnstakeRequestedEventOnChainFields>;

export type EpochWasChangedEventOnChain =
	EventOnChain<EpochWasChangedEventOnChainFields>;

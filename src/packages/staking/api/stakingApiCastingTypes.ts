import {
	AnyObjectType,
	BigIntAsString,
	IFixedAsString,
	ObjectId,
	SuiAddress,
} from "../../../types";
import {
	EventOnChain,
	IndexerEventOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface ValidatorOperationCapFieldsOnChain {
	authorizer_validator_address: SuiAddress;
}

export interface StakedSuiVaultStateV1FieldsOnChain {
	active_epoch: BigIntAsString;
	afsui_bin: BigIntAsString;
	atomic_unstake_sui_reserves: BigIntAsString;
	crank_incentive_reward_pool: BigIntAsString;
	epoch_was_changed_state: {
		fields: {
			amount_to_unstake: BigIntAsString;
			is_epoch_processing: boolean;
			is_inactive_stakes_processed: boolean;
			is_pending_unstakes_processed: boolean;
			is_total_sui_amount_updated: boolean;
			is_unstaking_deque_sorted: boolean;
			is_unstaking_from_storage_processed: boolean;
			reserves_before_unstake: BigIntAsString;
		};
	};
	protocol_config: {
		fields: {
			atomic_unstake_protocol_fee: {
				fields: {
					crank_incentive_allocation: BigIntAsString;
					dev_wallet_allocation: BigIntAsString;
					max_fee: BigIntAsString;
					min_fee: BigIntAsString;
					referee_discount: BigIntAsString;
					treasury_allocation: BigIntAsString;
				};
			};
			atomic_unstake_sui_reserves_target_value: BigIntAsString;
			crank_incentive_reward_per_instruction: BigIntAsString;
			default_unstake_protocol_fee: {
				fields: {
					crank_incentive_allocation: BigIntAsString;
					dev_wallet_allocation: BigIntAsString;
					referee_discount: BigIntAsString;
					total_fee: BigIntAsString;
					treasury_allocation: BigIntAsString;
				};
			};
			dev_account: SuiAddress;
			max_crank_incentive_reward: BigIntAsString;
			max_validator_fee: BigIntAsString;
			min_fields_requests_per_tx: BigIntAsString;
			min_staking_threshold: BigIntAsString;
			pool_rates_epoch_gap: BigIntAsString;
			reference_gas_price: BigIntAsString;
			unstaking_bunch_size: BigIntAsString;
		};
	};
	sui_reserves: BigIntAsString;
	total_rewards_amount: BigIntAsString;
	total_sui_amount: BigIntAsString;
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

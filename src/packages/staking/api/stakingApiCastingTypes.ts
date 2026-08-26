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
	MoveStructOnChain,
} from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================


/** Move fields in a validator operation-cap object before normalization. */
export interface ValidatorOperationCapFieldsOnChain {
	/** Validator address authorized by the operation cap. */
	authorizer_validator_address: SuiAddress;
}

/** Move fields that track progress through an afSUI epoch update. */
export interface EpochWasChangedStateFieldsOnChain {
	/** SUI amount queued for processing, as a decimal string in raw units. */
	amount_to_unstake: BigIntAsString;
	/** Whether the vault is currently processing the epoch. */
	is_epoch_processing: boolean;
	/** Whether inactive native stakes have been processed. */
	is_inactive_stakes_processed: boolean;
	/** Whether pending unstake records have been processed. */
	is_pending_unstakes_processed: boolean;
	/** Whether the vault's total SUI amount has been updated. */
	is_total_sui_amount_updated: boolean;
	/** Whether the pending unstake deque has been sorted. */
	is_unstaking_deque_sorted: boolean;
	/** Whether unstake records from storage have been processed. */
	is_unstaking_from_storage_processed: boolean;
	/** SUI reserve amount recorded before unstake processing, in raw units. */
	reserves_before_unstake: BigIntAsString;
}

/** 18-decimal fixed-point fee configuration for atomic unstakes. */
export interface AtomicUnstakeProtocolFeeFieldsOnChain {
	/** Fraction allocated to crank incentives, in the 1e18 fixed-point scale. */
	crank_incentive_allocation: BigIntAsString;
	/** Fraction allocated to the development wallet, in the 1e18 scale. */
	dev_wallet_allocation: BigIntAsString;
	/** Maximum atomic-unstake fee, in the 1e18 fixed-point scale. */
	max_fee: BigIntAsString;
	/** Minimum atomic-unstake fee, in the 1e18 fixed-point scale. */
	min_fee: BigIntAsString;
	/** Referee discount ratio, in the 1e18 fixed-point scale. */
	referee_discount: BigIntAsString;
	/** Fraction allocated to the treasury, in the 1e18 fixed-point scale. */
	treasury_allocation: BigIntAsString;
}

/** 18-decimal fixed-point fee configuration for queued unstakes. */
export interface DefaultUnstakeProtocolFeeFieldsOnChain {
	/** Fraction allocated to crank incentives, in the 1e18 fixed-point scale. */
	crank_incentive_allocation: BigIntAsString;
	/** Fraction allocated to the development wallet, in the 1e18 scale. */
	dev_wallet_allocation: BigIntAsString;
	/** Referee discount ratio, in the 1e18 fixed-point scale. */
	referee_discount: BigIntAsString;
	/** Total queued-unstake fee, in the 1e18 fixed-point scale. */
	total_fee: BigIntAsString;
	/** Fraction allocated to the treasury, in the 1e18 fixed-point scale. */
	treasury_allocation: BigIntAsString;
}

/** Raw Move protocol configuration nested in the stakedSui vault state. */
export interface StakedSuiVaultProtocolConfigFieldsOnChain {
	/** Atomic-unstake fee configuration, in a gRPC or JSON-RPC struct shape. */
	atomic_unstake_protocol_fee: MoveStructOnChain<AtomicUnstakeProtocolFeeFieldsOnChain>;
	/** Target atomic-unstake SUI reserve, as a raw decimal string. */
	atomic_unstake_sui_reserves_target_value: BigIntAsString;
	/** Crank incentive per processed instruction, as a raw protocol integer. */
	crank_incentive_reward_per_instruction: BigIntAsString;
	/** Queued-unstake fee configuration, in a gRPC or JSON-RPC struct shape. */
	default_unstake_protocol_fee: MoveStructOnChain<DefaultUnstakeProtocolFeeFieldsOnChain>;
	/** Development-account address configured by the protocol. */
	dev_account: SuiAddress;
	/** Maximum crank incentive reward, as a raw protocol integer. */
	max_crank_incentive_reward: BigIntAsString;
	/** Maximum validator fee in the 1e18 fixed-point scale. */
	max_validator_fee: BigIntAsString;
	/** Minimum number of field requests allowed in one transaction. */
	min_fields_requests_per_tx: BigIntAsString;
	/** Minimum SUI stake amount, as a raw decimal string. */
	min_staking_threshold: BigIntAsString;
	/** Number of epochs between validator pool-rate updates. */
	pool_rates_epoch_gap: BigIntAsString;
	/** Reference gas price in the protocol's raw gas-price units. */
	reference_gas_price: BigIntAsString;
	/** Number of pending unstakes processed in one protocol batch. */
	unstaking_bunch_size: BigIntAsString;
}

/** Raw Move fields in a version-1 stakedSui vault state object. */
export interface StakedSuiVaultStateV1FieldsOnChain {
	/** Current protocol epoch as a decimal string. */
	active_epoch: BigIntAsString;
	/** afSUI accounting-bin value as a raw decimal string. */
	afsui_bin: BigIntAsString;
	/** Current atomic-unstake SUI reserve in raw units. */
	atomic_unstake_sui_reserves: BigIntAsString;
	/** Accumulated crank incentive reward pool as a raw protocol integer. */
	crank_incentive_reward_pool: BigIntAsString;
	/** Epoch-processing flags and counters. */
	epoch_was_changed_state: MoveStructOnChain<EpochWasChangedStateFieldsOnChain>;
	/** Nested protocol configuration. */
	protocol_config: MoveStructOnChain<StakedSuiVaultProtocolConfigFieldsOnChain>;
	/** SUI reserve held by the vault, as a raw decimal string. */
	sui_reserves: BigIntAsString;
	/** Total accumulated SUI rewards, as a raw decimal string. */
	total_rewards_amount: BigIntAsString;
	/** Total SUI amount tracked by the vault, as a raw decimal string. */
	total_sui_amount: BigIntAsString;
}

// =========================================================================
//  Events Fields
// =========================================================================


/** Raw parsed fields in a liquid-staking event. */
export interface StakedEventOnChainFields {
	/** Address that performed the stake. */
	staker: SuiAddress;
	/** Validator address that received the stake. */
	validator: SuiAddress;
	/** Native staked SUI object ID created by the stake. */
	staked_sui_id: ObjectId;
	/** SUI coin object ID consumed by the stake. */
	sui_id: ObjectId;
	/** SUI amount staked, as a raw decimal string. */
	sui_amount: BigIntAsString;
	/** afSUI coin object ID issued by the stake. */
	afsui_id: ObjectId;
	/** afSUI amount issued, as a raw decimal string. */
	afsui_amount: BigIntAsString;
	/** Validator fee in the 1e18 fixed-point scale. */
	validator_fee: BigIntAsString;
	/** Referrer address, or `null` when no referrer was supplied. */
	referrer: SuiAddress | null;
	/** Protocol epoch in which the stake occurred. */
	epoch: BigIntAsString;
	/** Whether the operation restaked an existing native stake. */
	is_restaked: boolean;
}

/** Raw parsed fields in a completed unstake event. */
export interface UnstakedEventOnChainFields {
	/** afSUI coin object ID burned or converted. */
	afsui_id: ObjectId;
	/** afSUI amount provided, as a raw decimal string. */
	provided_afsui_amount: BigIntAsString;
	/** SUI coin object ID returned to the requester. */
	sui_id: ObjectId;
	/** SUI amount returned, as a raw decimal string. */
	returned_sui_amount: BigIntAsString;
	/** Address that requested the unstake. */
	requester: SuiAddress;
	/** Protocol epoch in which the unstake completed. */
	epoch: BigIntAsString;
}

/** Raw parsed fields in a queued unstake-request event. */
export interface UnstakeRequestedEventOnChainFields {
	/** afSUI coin object ID provided for the request. */
	afsui_id: ObjectId;
	/** afSUI amount provided, as a raw decimal string. */
	provided_afsui_amount: BigIntAsString;
	/** Address that requested the unstake. */
	requester: SuiAddress;
	/** Protocol epoch in which the request was emitted. */
	epoch: BigIntAsString;
}

/** Raw parsed fields in an epoch-change event. */
export interface EpochWasChangedEventOnChainFields {
	/** New active epoch as a decimal string. */
	active_epoch: BigIntAsString;
	/** Total afSUI supply, as a raw decimal string. */
	total_afsui_supply: BigIntAsString;
	/** Total SUI rewards, as a raw decimal string. */
	total_rewards_amount: BigIntAsString;
	/** Total SUI amount, as a raw decimal string. */
	total_sui_amount: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

/** On-chain event envelope for a liquid-staking event. */
export type StakedEventOnChain = EventOnChain<StakedEventOnChainFields>;

/** On-chain event envelope for a completed unstake event. */
export type UnstakedEventOnChain = EventOnChain<UnstakedEventOnChainFields>;

/** On-chain event envelope for a queued unstake-request event. */
export type UnstakeRequestedEventOnChain =
	EventOnChain<UnstakeRequestedEventOnChainFields>;

/** On-chain event envelope for an epoch-change event. */
export type EpochWasChangedEventOnChain =
	EventOnChain<EpochWasChangedEventOnChainFields>;

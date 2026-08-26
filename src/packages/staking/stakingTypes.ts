import { CoinType } from "../..";
import {
	ApiEventsBody,
	Balance,
	Event,
	Object as SuiObject,
	Percentage,
	Timestamp,
	ObjectId,
	SuiAddress,
	TransactionDigest,
	ExternalFee,
} from "../../general/types/generalTypes";

/**
 * Normalized validator configuration returned by the staking API.
 *
 * The object inherits `objectId` and `objectType` from `SuiObject`. `fee` is a
 * decimal ratio, so `0.01` represents a 1% validator fee.
 */
export interface ValidatorConfigObject extends SuiObject {
	/**
	 * Address of the validator whose configuration this object describes.
	 */
	suiAddress: SuiAddress;
	/**
	 * Object ID of the operation cap associated with this validator.
	 */
	operationCapId: ObjectId;
	/**
	 * Current validator fee as a decimal ratio. `0.01` represents 1%.
	 */
	fee: Percentage;
}

/**
 * Normalized validator operation-cap object returned for a wallet.
 *
 * The cap authorizes permissioned validator operations, including validator-fee
 * updates when its authorizer address matches the target validator.
 */
export interface ValidatorOperationCapObject extends SuiObject {
	/**
	 * Validator address authorized by this operation cap.
	 */
	authorizerValidatorAddress: SuiAddress;
}

/**
 * Normalized state of the Aftermath stakedSui vault.
 *
 * Balance fields are raw token amounts represented as `bigint`s. Fee fields
 * use the unsigned 18-decimal fixed-point scale, where
 * `1_000_000_000_000_000_000n` represents 100%.
 */
export interface StakedSuiVaultStateObject extends SuiObject {
	/**
	 * Target SUI reserve for atomic unstakes, in raw SUI units.
	 */
	atomicUnstakeSuiReservesTargetValue: Balance;
	/**
	 * Current SUI reserve available for atomic unstakes, in raw SUI units.
	 */
	atomicUnstakeSuiReserves: Balance;
	/**
	 * Minimum atomic-unstake fee as an 18-decimal fixed-point value.
	 * `50_000_000_000_000_000n` represents 5%.
	 */
	minAtomicUnstakeFee: bigint;
	/**
	 * Maximum atomic-unstake fee as an 18-decimal fixed-point value.
	 */
	maxAtomicUnstakeFee: bigint;
	/**
	 * Total SUI rewards accumulated in the vault, in raw SUI units.
	 */
	totalRewardsAmount: Balance;
	/**
	 * Total SUI amount held by the vault, in raw SUI units.
	 */
	totalSuiAmount: Balance;
	/**
	 * Current protocol epoch as a `bigint`.
	 */
	activeEpoch: bigint;
}

/**
 * Normalized dynamic-field record that stores a stake balance.
 */
export interface StakeBalanceDynamicField {
	/**
	 * Object ID of the dynamic-field record.
	 */
	objectId: ObjectId;
	/**
	 * Stored SUI or afSUI amount in the token's smallest unit.
	 */
	value: Balance;
}

/**
 * State of a native Sui delegated stake.
 *
 * `"Active"` is delegated and active. `"Pending"` has not activated yet.
 * `"Unstaked"` is no longer earning staking rewards.
 */
export type SuiDelegatedStakeState = "Active" | "Pending" | "Unstaked";

/**
 * Native Sui delegated stake returned for a wallet.
 *
 * This type describes a Sui `StakedSui` delegation. It is distinct from an
 * Aftermath `StakingPosition`, which also includes afSUI and unstake events.
 */
export interface SuiDelegatedStake {
	/**
	 * Current native delegation state.
	 */
	status: SuiDelegatedStakeState;
	/**
	 * Object ID of the native staked SUI object.
	 */
	stakedSuiId: ObjectId;
	/**
	 * Epoch in which the delegation request was made.
	 */
	stakeRequestEpoch: bigint;
	/**
	 * Epoch in which the delegation became, or will become, active.
	 */
	stakeActiveEpoch: bigint;
	/**
	 * Delegated principal in raw SUI units.
	 */
	principal: Balance;
	/**
	 * Estimated rewards in raw SUI units, when the endpoint provides them.
	 */
	estimatedReward?: Balance | undefined;
	/**
	 * Address of the validator receiving the delegation.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Address of the native Sui staking pool that manages this stake.
	 */
	stakingPool: SuiAddress;
}

/**
 * Narrows a staking union to a native Sui delegated stake.
 *
 * @param stake - A native delegated stake or an Aftermath staking position.
 * @returns `true` when the object has the native delegated-stake fields.
 */
export const isSuiDelegatedStake = (
	stake: StakingPosition | SuiDelegatedStake
): stake is SuiDelegatedStake => {
	return (
		"stakeRequestEpoch" in stake &&
		"stakeActiveEpoch" in stake &&
		"principal" in stake &&
		"stakingPool" in stake
	);
};

/** A single data point returned by the historical staking-APY endpoint. */
export interface StakingApyDataPoint {
	/**
	 * Timestamp supplied by the API. The `Timestamp` alias does not distinguish
	 * seconds from milliseconds.
	 */
	timestamp: Timestamp;
	/**
	 * APY at that timestamp as a decimal ratio. `0.045` represents 4.5%.
	 */
	apy: number;
}

/**
 * Timeframe keys accepted by the historical staking-APY endpoint.
 */
export type StakingApyTimeframeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

/* -------------------------------------------------------------------------- */
/*                              EVENT INTERFACES                              */
/* -------------------------------------------------------------------------- */

/**
 * Normalized event emitted when SUI is staked for afSUI.
 *
 * The event covers both a new stake and a restake of native `StakedSui`. Amounts
 * are raw SUI or afSUI balances. `validatorFee` is a decimal ratio.
 */
export interface StakedEvent extends Event {
	/**
	 * Object ID of the newly created native staked SUI object.
	 */
	stakedSuiId: ObjectId;
	/**
	 * Object ID of the SUI coin consumed by the stake.
	 */
	suiId: ObjectId;
	/**
	 * Address that performed the stake.
	 */
	staker: SuiAddress;
	/**
	 * Validator that received the stake.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Protocol epoch in which the stake occurred.
	 */
	epoch: bigint;
	/**
	 * SUI amount staked, in raw SUI units.
	 */
	suiStakeAmount: Balance;
	/**
	 * Validator fee as a decimal ratio. `0.01` represents 1%.
	 */
	validatorFee: number;
	/**
	 * Whether the operation restaked an existing native staked SUI object.
	 */
	isRestaked: boolean;
	/**
	 * Object ID of the afSUI coin received by the staker.
	 */
	afSuiId: ObjectId;
	/**
	 * afSUI amount received, in raw afSUI units.
	 */
	afSuiAmount: Balance;
	/**
	 * Referrer address recorded for the stake, when one was supplied.
	 */
	referrer?: SuiAddress;
}

/**
 * Normalized event emitted when a wallet requests a queued afSUI-to-SUI
 * unstake.
 */
export interface UnstakeRequestedEvent extends Event {
	/**
	 * Object ID of the afSUI coin provided for unstaking.
	 */
	afSuiId: ObjectId;
	/**
	 * afSUI amount provided, in raw afSUI units.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * Address that requested the unstake.
	 */
	requester: SuiAddress;
	/**
	 * Protocol epoch in which the request was emitted.
	 */
	epoch: bigint;
}

/**
 * Normalized event emitted when a queued unstake finishes and SUI is minted.
 */
export interface UnstakedEvent extends Event {
	/**
	 * Object ID of the afSUI coin burned or converted.
	 */
	afSuiId: ObjectId;
	/**
	 * afSUI amount provided, in raw afSUI units.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * Object ID of the SUI coin minted for the requester.
	 */
	suiId: ObjectId;
	/**
	 * SUI amount returned, in raw SUI units.
	 */
	returnedSuiAmount: Balance;
	/**
	 * Address that requested the unstake.
	 */
	requester: SuiAddress;
	/**
	 * Protocol epoch in which the unstake finished.
	 */
	epoch: bigint;
}

/**
 * Union of queued-unstake and completed-unstake events.
 */
export type UnstakeEvent = UnstakeRequestedEvent | UnstakedEvent;

/**
 * Narrows a staking event union to a `StakedEvent`.
 *
 * @param event - A stake or unstake event.
 * @returns `true` when the event contains the `StakedEvent` fields.
 */
export const isStakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is StakeEvent => {
	return "staker" in event;
};

/**
 * Narrows a staking event union to an `UnstakeEvent`.
 *
 * @param event - A stake or unstake event.
 * @returns `true` when the event is a queued or completed unstake event.
 */
export const isUnstakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is UnstakeEvent => {
	return !isStakeEvent(event);
};

/**
 * Normalized event emitted while the afSUI vault records an epoch change.
 *
 * The event reports aggregate supply, rewards, and SUI values after the
 * protocol's epoch-processing call.
 */
export interface EpochWasChangedEvent extends Event {
	/**
	 * New active protocol epoch.
	 */
	activeEpoch: bigint;
	/**
	 * Total afSUI supply in raw afSUI units.
	 */
	totalAfSuiSupply: Balance;
	/**
	 * Total accrued SUI rewards in raw SUI units.
	 */
	totalSuiRewardsAmount: Balance;
	/**
	 * Total SUI amount in the system, in raw SUI units.
	 */
	totalSuiAmount: Balance;
}

/**
 * Union containing the normalized stake event variant.
 */
export type StakeEvent = StakedEvent;

/* -------------------------------------------------------------------------- */
/*                          STAKING POSITIONS TYPES                           */
/* -------------------------------------------------------------------------- */

/** A user's normalized stake or unstake position. */
export type StakingPosition = StakePosition | UnstakePosition;

/**
 * A user's stake position created by a `StakedEvent`.
 *
 * Amounts are raw SUI or afSUI balances. `timestamp` can be absent when the
 * source event did not include a timestamp.
 */
export interface StakePosition {
	/**
	 * Object ID of the native staked SUI object.
	 */
	stakedSuiId: ObjectId;
	/**
	 * Object ID of the SUI coin consumed by the stake.
	 */
	suiId: ObjectId;
	/**
	 * Address that performed the stake.
	 */
	staker: SuiAddress;
	/**
	 * Validator that received the stake.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Protocol epoch in which the stake was established.
	 */
	epoch: bigint;
	/**
	 * SUI amount staked, in raw SUI units.
	 */
	suiStakeAmount: Balance;
	/**
	 * Validator fee as a decimal ratio. `0.01` represents 1%.
	 */
	validatorFee: number;
	/**
	 * Whether this position came from a restake operation.
	 */
	isRestaked: boolean;
	/**
	 * Object ID of the afSUI coin issued for the stake.
	 */
	afSuiId: ObjectId;
	/**
	 * afSUI amount issued, in raw afSUI units.
	 */
	afSuiAmount: Balance;
	/**
	 * Event timestamp, when the source event supplied one.
	 */
	timestamp: Timestamp | undefined;
	/**
	 * Digest of the transaction that emitted the stake event.
	 */
	txnDigest: TransactionDigest;
}

/**
 * A user's queued or completed afSUI-to-SUI unstake position.
 *
 * A `REQUEST` position has no returned SUI fields. A `SUI_MINTED` position has
 * the returned coin ID and amount.
 */
export interface UnstakePosition {
	/**
	 * Unstake state: `REQUEST` while queued or `SUI_MINTED` after SUI is returned.
	 */
	state: UnstakePositionState;
	/**
	 * Object ID of the afSUI coin burned or converted.
	 */
	afSuiId: ObjectId;
	/**
	 * afSUI amount provided, in raw afSUI units.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * Address that requested the unstake.
	 */
	requester: SuiAddress;
	/**
	 * Epoch associated with the request. Position updates retain the request
	 * epoch when a matching completion event arrives.
	 */
	epoch: bigint;
	/**
	 * Object ID of the returned SUI coin, present after completion.
	 */
	suiId?: ObjectId;
	/**
	 * Returned SUI amount in raw SUI units, present after completion.
	 */
	returnedSuiAmount?: Balance;
	/**
	 * Event timestamp for the request or completion, when supplied.
	 */
	timestamp: Timestamp | undefined;
	/**
	 * Digest of the transaction that emitted the request or completion event.
	 */
	txnDigest: TransactionDigest;
}

/** States represented by an `UnstakePosition`. */
export type UnstakePositionState = "REQUEST" | "SUI_MINTED";

/**
 * Narrows a `StakingPosition` to a `StakePosition`.
 *
 * @param position - Position to inspect.
 * @returns `true` when the position contains a native staked SUI object ID.
 */
export const isStakePosition = (
	position: StakingPosition
): position is StakePosition => {
	return "stakedSuiId" in position;
};

/**
 * Narrows a `StakingPosition` to an `UnstakePosition`.
 *
 * @param position - Position to inspect.
 * @returns `true` when the position is not a stake position.
 */
export const isUnstakePosition = (
	position: StakingPosition
): position is UnstakePosition => {
	return !isStakePosition(position);
};

/* -------------------------------------------------------------------------- */
/*                             API BODY INTERFACES                            */
/* -------------------------------------------------------------------------- */

/**
 * Inputs for building a liquid-staking transaction that converts SUI to afSUI.
 *
 * `suiStakeAmount` uses raw SUI units. The builder also requires the selected
 * validator to be active and applies the external-fee bounds before it adds
 * the transaction commands.
 */
export interface ApiStakeBody {
	/**
	 * Wallet address that owns the SUI coin and receives the afSUI result.
	 */
	walletAddress: SuiAddress;
	/**
	 * SUI amount to stake, in raw SUI units. `1_000_000_000n` is 1 SUI.
	 */
	suiStakeAmount: Balance;
	/**
	 * Active validator that receives the native stake.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Optional address recorded in the referral vault before staking.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional third-party fee recipient and decimal fee ratio. The builder
	 * requires a ratio greater than 0 and strictly less than `0.5`.
	 */
	externalFee?: ExternalFee;
	/**
	 * Whether the SUI coin-selection helper should build for a sponsored flow.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Inputs for building an afSUI-to-SUI unstaking transaction.
 *
 * `afSuiUnstakeAmount` uses raw afSUI units. Atomic mode depends on the vault's
 * SUI reserves; queued mode creates a request for epoch processing.
 */
export interface ApiUnstakeBody {
	/**
	 * Wallet address that owns the afSUI coin and receives returned SUI in atomic mode.
	 */
	walletAddress: SuiAddress;
	/**
	 * afSUI amount to unstake, in raw afSUI units. `1_000_000_000n` is 1 afSUI.
	 */
	afSuiUnstakeAmount: Balance;
	/**
	 * Selects the atomic entry point when `true` and the queued request entry
	 * point when `false`. Atomic execution can fail with `Insufficient Sui Reserves`.
	 */
	isAtomic: boolean;
	/**
	 * Optional address recorded in the referral vault before unstaking.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional third-party fee recipient and decimal fee ratio. The builder
	 * requires a ratio greater than 0 and strictly less than `0.5`.
	 */
	externalFee?: ExternalFee;
	/**
	 * Sponsorship flag accepted by the shared input shape. The current unstake
	 * builder does not forward it to afSUI coin selection.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Inputs for building a transaction that restakes native `StakedSui` objects
 * for afSUI.
 */
export interface ApiStakeStakedSuiBody {
	/**
	 * Wallet address that owns the native staked SUI objects and receives afSUI.
	 */
	walletAddress: SuiAddress;
	/**
	 * Object IDs of the native `StakedSui` objects to combine into the Move vector.
	 */
	stakedSuiIds: ObjectId[];
	/**
	 * Active validator that receives the restaked objects.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Optional address recorded in the referral vault before restaking.
	 */
	referrer?: SuiAddress;
	/**
	 * Sponsorship flag accepted by the shared input shape. The current restake
	 * builder does not use it because it does not select a coin.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Inputs for building a validator-fee update transaction.
 */
export interface ApiUpdateValidatorFeeBody {
	/**
	 * Wallet address that signs and sends the update.
	 */
	walletAddress: SuiAddress;
	/**
	 * Object ID of the operation cap that authorizes this validator update.
	 */
	validatorOperationCapId: ObjectId;
	/**
	 * New validator fee as a decimal ratio. `0.01` represents 1%.
	 * The builder encodes it as an 18-decimal fixed-point integer, and the Move
	 * contract rejects a value above its configured maximum.
	 */
	newFeePercentage: Percentage;
	/**
	 * Sponsorship flag accepted by the shared input shape. The fee-update builder
	 * does not use it because it creates a local transaction without coin selection.
	 */
	isSponsoredTx?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                             OBJECTS API BODIES                             */
/* -------------------------------------------------------------------------- */

/** Inputs for the paginated staking-position endpoint. */
export interface ApiStakingPositionsBody {
	/**
	 * Wallet address whose positions are queried.
	 */
	walletAddress: SuiAddress;
	/**
	 * Numeric endpoint cursor for the page to fetch.
	 */
	cursor?: number;
	/**
	 * Maximum number of positions requested for the page.
	 */
	limit?: number;
}

/**
 * Inputs for retrieving native Sui delegated stakes.
 */
export interface ApiDelegatedStakesBody {
	/**
	 * Wallet address whose native delegated stakes are queried.
	 */
	walletAddress: SuiAddress;
}

/**
 * Inputs for retrieving validator operation caps owned by a wallet.
 */
export interface ApiValidatorOperationCapsBody {
	/**
	 * Wallet address whose validator operation caps are queried.
	 */
	walletAddress: SuiAddress;
}

/* -------------------------------------------------------------------------- */
/*                                EVENTS API                                  */
/* -------------------------------------------------------------------------- */

/**
 * Inputs for a direct staking-event query.
 *
 * The intersection inherits `cursor?: EventId` and `limit?: number` from
 * `ApiEventsBody` and adds the wallet filter. The high-level `Staking` class
 * exposes normalized positions rather than a method that accepts this body.
 */
export type ApiStakingEventsBody = ApiEventsBody & {
	/**
	 * Wallet address whose staking events are queried.
	 */
	walletAddress: SuiAddress;
};

/* -------------------------------------------------------------------------- */
/*                              ROUTER POOL TYPE                              */
/* -------------------------------------------------------------------------- */

/**
 * Router-pool view of the afSUI vault.
 *
 * Inherits vault reserves, fee configuration, balances, and active epoch from
 * `StakedSuiVaultStateObject`. The exchange rate is a decimal SUI-per-afSUI
 * ratio, while inherited balances remain raw token units.
 */
export type AfSuiRouterPoolObject = StakedSuiVaultStateObject & {
	/**
	 * Fully qualified Move coin type for afSUI, such as
	 * `0x<package>::afsui::AFSUI`.
	 */
	afSuiCoinType: CoinType;
	/**
	 * Configured Aftermath validator address.
	 */
	aftermathValidatorAddress: SuiAddress;
	/**
	 * Current exchange rate expressed as SUI represented by 1 afSUI.
	 */
	afSuiToSuiExchangeRate: number;
};

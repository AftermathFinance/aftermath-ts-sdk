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
 * Represents a validator's configuration object, including its Sui address,
 * operation cap ID, and fee percentage.
 */
export interface ValidatorConfigObject extends SuiObject {
	/**
	 * The Sui address of the validator.
	 */
	suiAddress: SuiAddress;
	/**
	 * The on-chain object ID referencing this validator's operation cap.
	 */
	operationCapId: ObjectId;
	/**
	 * The current fee percentage for this validator (0.01 = 1%).
	 */
	fee: Percentage;
}

/**
 * Represents a validator's operation cap object, which authorizes changes to
 * validator settings like fees.
 */
export interface ValidatorOperationCapObject extends SuiObject {
	/**
	 * The validator address authorized by this operation cap.
	 */
	authorizerValidatorAddress: SuiAddress;
}

/**
 * Represents the on-chain state of the stakedSui vault, which tracks liquidity
 * for atomic unstakes, total SUI amounts, rewards, and fees.
 */
export interface StakedSuiVaultStateObject extends SuiObject {
	/**
	 * The target size for atomic unstake SUI reserves.
	 */
	atomicUnstakeSuiReservesTargetValue: Balance;
	/**
	 * The current size of the SUI reserves for atomic unstakes.
	 */
	atomicUnstakeSuiReserves: Balance;
	/**
	 * The minimum fee for atomic unstakes, expressed as a BigInt-based percentage
	 * (e.g., 50000000n = 5% if using 1e9-based decimals).
	 */
	minAtomicUnstakeFee: bigint;
	/**
	 * The maximum fee for atomic unstakes.
	 */
	maxAtomicUnstakeFee: bigint;
	/**
	 * The total amount of SUI rewards accumulated in the vault.
	 */
	totalRewardsAmount: Balance;
	/**
	 * The total amount of SUI staked in the vault.
	 */
	totalSuiAmount: Balance;
	/**
	 * The current epoch number, as a BigInt.
	 */
	activeEpoch: bigint;
}

/**
 * Represents a dynamic field holding a stake balance. Useful for tracking
 * on-chain data related to a specific stake or delegator.
 */
export interface StakeBalanceDynamicField {
	/**
	 * The on-chain object ID of this stake balance record.
	 */
	objectId: ObjectId;
	/**
	 * The amount of SUI (or afSUI) represented by this field, expressed as a bigint.
	 */
	value: Balance;
}

/**
 * Enumerates the possible states of a delegated stake on the Sui network.
 *
 * - **Active**: The stake is actively earning rewards.
 * - **Pending**: The stake has been requested but not yet activated.
 * - **Unstaked**: The stake has been removed or the SUI is no longer earning rewards.
 */
export type SuiDelegatedStakeState = "Active" | "Pending" | "Unstaked";

/**
 * Represents a delegated stake object in the Sui network. Unlike local
 * Aftermath-specific stake positions, this is a more general Sui system stake
 * that can earn protocol-level rewards.
 */
export interface SuiDelegatedStake {
	/**
	 * The current state of the delegated stake (e.g., Active, Pending, Unstaked).
	 */
	status: SuiDelegatedStakeState;
	/**
	 * The on-chain ID representing this stake position.
	 */
	stakedSuiId: ObjectId;
	/**
	 * The epoch in which this stake request was made.
	 */
	stakeRequestEpoch: bigint;
	/**
	 * The epoch in which this stake became (or will become) active.
	 */
	stakeActiveEpoch: bigint;
	/**
	 * The principal amount of SUI delegated.
	 */
	principal: Balance;
	/**
	 * The estimated rewards accumulated for this stake, if available.
	 */
	estimatedReward?: Balance | undefined;
	/**
	 * The validator to which this stake is delegated.
	 */
	validatorAddress: SuiAddress;
	/**
	 * The staking pool on-chain object that manages this stake.
	 */
	stakingPool: SuiAddress;
}

/**
 * A type guard utility function to check if a position is a native Sui delegated stake
 * (`SuiDelegatedStake`) rather than an Aftermath-specific `StakingPosition`.
 *
 * @param stake - An object that could be either a `StakingPosition` or a `SuiDelegatedStake`.
 * @returns True if the object matches the shape of `SuiDelegatedStake`; otherwise, false.
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

/**
 * Represents a single entry in the historical APY data, including a Unix
 * timestamp and an APY value.
 */
export interface StakingApyDataPoint {
	/**
	 * The Unix timestamp (in milliseconds or seconds) of the data point.
	 */
	timestamp: Timestamp;
	/**
	 * The APY value recorded at that time (e.g., 0.045 = 4.5%).
	 */
	apy: number;
}

/**
 * Enumerates the timeframes available for retrieving historical APY data,
 * such as `"1W"`, `"1M"`, `"1Y"`, etc.
 */
export type StakingApyTimeframeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

/* -------------------------------------------------------------------------- */
/*                              EVENT INTERFACES                              */
/* -------------------------------------------------------------------------- */

/**
 * Represents an event when SUI has been staked, either newly or restaked.
 */
export interface StakedEvent extends Event {
	/**
	 * The on-chain object ID referencing the newly created staked SUI object.
	 */
	stakedSuiId: ObjectId;
	/**
	 * The original SUI coin ID used for staking.
	 */
	suiId: ObjectId;
	/**
	 * The address of the user who performed the staking.
	 */
	staker: SuiAddress;
	/**
	 * The validator address to which the user staked.
	 */
	validatorAddress: SuiAddress;
	/**
	 * The epoch in which staking took place.
	 */
	epoch: bigint;
	/**
	 * The amount of SUI staked.
	 */
	suiStakeAmount: Balance;
	/**
	 * The validator fee percentage for this stake (0.01 = 1%).
	 */
	validatorFee: number;
	/**
	 * Indicates whether this stake is a restake of an already staked position.
	 */
	isRestaked: boolean;
	/**
	 * The on-chain ID of the afSUI object received in exchange for staking.
	 */
	afSuiId: ObjectId;
	/**
	 * The amount of afSUI received.
	 */
	afSuiAmount: Balance;
	/**
	 * (Optional) Referrer address for the stake.
	 */
	referrer?: SuiAddress;
}

/**
 * Represents an event when a user initiates an unstake request, converting
 * afSUI back into SUI.
 */
export interface UnstakeRequestedEvent extends Event {
	/**
	 * The afSUI ID being provided to unstake.
	 */
	afSuiId: ObjectId;
	/**
	 * The amount of afSUI provided by the user.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * The address requesting the unstake.
	 */
	requester: SuiAddress;
	/**
	 * The epoch in which the unstake was requested.
	 */
	epoch: bigint;
}

/**
 * Represents an event after an unstake has fully processed and SUI has
 * been returned to the user.
 */
export interface UnstakedEvent extends Event {
	/**
	 * The afSUI ID that was burned or converted during the unstake.
	 */
	afSuiId: ObjectId;
	/**
	 * The amount of afSUI provided.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * The resulting SUI coin ID received by the user.
	 */
	suiId: ObjectId;
	/**
	 * The amount of SUI returned.
	 */
	returnedSuiAmount: Balance;
	/**
	 * The address that initiated the unstake.
	 */
	requester: SuiAddress;
	/**
	 * The epoch in which the unstake finalized.
	 */
	epoch: bigint;
}

/**
 * Represents a union type covering all possible unstake events, either
 * requested or finalized.
 */
export type UnstakeEvent = UnstakeRequestedEvent | UnstakedEvent;

/**
 * Type guard to check if an event is a `StakedEvent`.
 */
export const isStakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is StakeEvent => {
	return "staker" in event;
};

/**
 * Type guard to check if an event is an `UnstakeEvent`.
 */
export const isUnstakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is UnstakeEvent => {
	return !isStakeEvent(event);
};

/**
 * Represents an event that indicates the epoch has changed, generally used
 * for distributing rewards and updating positions.
 */
export interface EpochWasChangedEvent extends Event {
	/**
	 * The new active epoch as a BigInt.
	 */
	activeEpoch: bigint;
	/**
	 * The total amount of afSUI in circulation.
	 */
	totalAfSuiSupply: Balance;
	/**
	 * The total amount of SUI rewards accrued in the system.
	 */
	totalSuiRewardsAmount: Balance;
	/**
	 * The total amount of SUI staked in the system.
	 */
	totalSuiAmount: Balance;
}

/**
 * Union type for stake events, which can represent any variant of staking.
 */
export type StakeEvent = StakedEvent;

/* -------------------------------------------------------------------------- */
/*                          STAKING POSITIONS TYPES                           */
/* -------------------------------------------------------------------------- */

/**
 * Represents a user's staking position, which could be either a `StakePosition`
 * or an `UnstakePosition`.
 */
export type StakingPosition = StakePosition | UnstakePosition;

/**
 * Indicates a stake position, typically representing active or restaked SUI,
 * along with its associated `afSuiAmount`.
 */
export interface StakePosition {
	/**
	 * The staked SUI object ID referencing this position.
	 */
	stakedSuiId: ObjectId;
	/**
	 * The original SUI coin ID.
	 */
	suiId: ObjectId;
	/**
	 * The address of the staker.
	 */
	staker: SuiAddress;
	/**
	 * The address of the validator to which SUI was staked.
	 */
	validatorAddress: SuiAddress;
	/**
	 * The epoch in which the stake was established.
	 */
	epoch: bigint;
	/**
	 * The amount of SUI staked.
	 */
	suiStakeAmount: Balance;
	/**
	 * The validator fee percentage (0.01 = 1%).
	 */
	validatorFee: number;
	/**
	 * Indicates if this stake is a restake operation.
	 */
	isRestaked: boolean;
	/**
	 * The afSUI object ID generated from staking.
	 */
	afSuiId: ObjectId;
	/**
	 * The amount of afSUI issued to the user.
	 */
	afSuiAmount: Balance;
	/**
	 * The timestamp when the stake was recorded.
	 */
	timestamp: Timestamp | undefined;
	/**
	 * The transaction digest where the stake operation occurred.
	 */
	txnDigest: TransactionDigest;
}

/**
 * Indicates a position related to an unstake operation, either requested or
 * finalized, with optional references to the returned SUI coin and amount.
 */
export interface UnstakePosition {
	/**
	 * The state of the unstake operation: `REQUEST` (in progress) or
	 * `SUI_MINTED` (finalized).
	 */
	state: UnstakePositionState;
	/**
	 * The afSUI object ID being burned or converted.
	 */
	afSuiId: ObjectId;
	/**
	 * The amount of afSUI used to initiate the unstake.
	 */
	providedAfSuiAmount: Balance;
	/**
	 * The address of the requester.
	 */
	requester: SuiAddress;
	/**
	 * The epoch in which the unstake was requested or finalized.
	 */
	epoch: bigint;
	/**
	 * The SUI object ID returned to the user, if unstake has finalized.
	 */
	suiId?: ObjectId;
	/**
	 * The amount of SUI returned to the user, if unstake has finalized.
	 */
	returnedSuiAmount?: Balance;
	/**
	 * The timestamp when the unstake request was recorded or completed.
	 */
	timestamp: Timestamp | undefined;
	/**
	 * The transaction digest where the unstake operation occurred.
	 */
	txnDigest: TransactionDigest;
}

/**
 * Enumerates the possible states of an unstake operation.
 */
export type UnstakePositionState = "REQUEST" | "SUI_MINTED";

/**
 * Type guard that checks whether a given `StakingPosition` is a stake position.
 */
export const isStakePosition = (
	position: StakingPosition
): position is StakePosition => {
	return "stakedSuiId" in position;
};

/**
 * Type guard that checks whether a given `StakingPosition` is an unstake position.
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
 * Body payload for staking SUI.
 */
export interface ApiStakeBody {
	/**
	 * The address performing the stake.
	 */
	walletAddress: SuiAddress;
	/**
	 * The amount of SUI to be staked.
	 */
	suiStakeAmount: Balance;
	/**
	 * The validator address to stake with.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Optional address indicating a referrer.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional external fee object. Must not exceed `maxExternalFeePercentage`.
	 */
	externalFee?: ExternalFee;
	/**
	 * Indicates whether the transaction should be sponsored.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Body payload for unstaking SUI (afSUI -> SUI).
 */
export interface ApiUnstakeBody {
	/**
	 * The address performing the unstake.
	 */
	walletAddress: SuiAddress;
	/**
	 * The amount of afSUI to be unstaked.
	 */
	afSuiUnstakeAmount: Balance;
	/**
	 * If true, the unstake is done atomically if possible, using liquidity reserves.
	 */
	isAtomic: boolean;
	/**
	 * Optional address indicating a referrer.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional external fee object. Must not exceed `maxExternalFeePercentage`.
	 */
	externalFee?: ExternalFee;
	/**
	 * Indicates whether the transaction should be sponsored.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Body payload for staking stakedSUI objects (re-staking).
 */
export interface ApiStakeStakedSuiBody {
	/**
	 * The address performing the re-stake.
	 */
	walletAddress: SuiAddress;
	/**
	 * An array of stakedSui object IDs to re-stake.
	 */
	stakedSuiIds: ObjectId[];
	/**
	 * The validator address to stake with.
	 */
	validatorAddress: SuiAddress;
	/**
	 * Optional address indicating a referrer.
	 */
	referrer?: SuiAddress;
	/**
	 * Indicates whether the transaction should be sponsored.
	 */
	isSponsoredTx?: boolean;
}

/**
 * Body payload for updating a validator's fee settings.
 */
export interface ApiUpdateValidatorFeeBody {
	/**
	 * The address submitting the update transaction.
	 */
	walletAddress: SuiAddress;
	/**
	 * The operation cap object ID that authorizes changes to this validator.
	 */
	validatorOperationCapId: ObjectId;
	/**
	 * The new fee percentage to be set (0.01 = 1%).
	 */
	newFeePercentage: Percentage;
	/**
	 * Indicates whether the transaction should be sponsored.
	 */
	isSponsoredTx?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                             OBJECTS API BODIES                             */
/* -------------------------------------------------------------------------- */

/**
 * Body payload for retrieving staking positions, including pagination.
 */
export interface ApiStakingPositionsBody {
	/**
	 * The address whose staking positions are being queried.
	 */
	walletAddress: SuiAddress;
	/**
	 * Optional cursor for pagination.
	 */
	cursor?: number;
	/**
	 * Optional limit on the number of positions returned.
	 */
	limit?: number;
}

/**
 * Body payload for retrieving delegated stakes, given a wallet address.
 */
export interface ApiDelegatedStakesBody {
	/**
	 * The address whose delegated stakes are being queried.
	 */
	walletAddress: SuiAddress;
}

/**
 * Body payload for retrieving validator operation caps, given a wallet address.
 */
export interface ApiValidatorOperationCapsBody {
	/**
	 * The address whose validator operation caps are being queried.
	 */
	walletAddress: SuiAddress;
}

/* -------------------------------------------------------------------------- */
/*                                EVENTS API                                  */
/* -------------------------------------------------------------------------- */

/**
 * Body payload for retrieving staking-related events, including pagination.
 */
export type ApiStakingEventsBody = ApiEventsBody & {
	/**
	 * The address whose events are being queried.
	 */
	walletAddress: SuiAddress;
};

/* -------------------------------------------------------------------------- */
/*                              ROUTER POOL TYPE                              */
/* -------------------------------------------------------------------------- */

/**
 * Extends the `StakedSuiVaultStateObject` with additional fields relevant
 * to the router pool. This includes the coin type for afSUI, the configured
 * validator address, and the current exchange rate.
 */
export type AfSuiRouterPoolObject = StakedSuiVaultStateObject & {
	/**
	 * The coin type string for afSUI (e.g., "0x<package>::afSUI::AFSUI").
	 */
	afSuiCoinType: CoinType;
	/**
	 * The official Aftermath validator address.
	 */
	aftermathValidatorAddress: SuiAddress;
	/**
	 * The current exchange rate from afSUI to SUI.
	 */
	afSuiToSuiExchangeRate: number;
};

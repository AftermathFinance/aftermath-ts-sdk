import { CoinType } from "../..";
import {
	ApiEventsBody,
	Balance,
	Event,
	Object,
	Percentage,
	Timestamp,
	ObjectId,
	SuiAddress,
	TransactionDigest,
	ExternalFee,
} from "../../general/types/generalTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface ValidatorConfigObject extends Object {
	suiAddress: SuiAddress;
	operationCapId: ObjectId;
	fee: Percentage;
}

export interface ValidatorOperationCapObject extends Object {
	authorizerValidatorAddress: SuiAddress;
}

export interface StakedSuiVaultStateObject extends Object {
	atomicUnstakeSuiReservesTargetValue: Balance;
	atomicUnstakeSuiReserves: Balance;
	minAtomicUnstakeFee: bigint;
	maxAtomicUnstakeFee: bigint;
	totalRewardsAmount: Balance;
	totalSuiAmount: Balance;
}

export interface StakeBalanceDynamicField {
	objectId: ObjectId;
	value: Balance;
}

export type SuiDelegatedStakeState = "Active" | "Pending" | "Unstaked";

export interface SuiDelegatedStake {
	status: SuiDelegatedStakeState;
	stakedSuiId: ObjectId;
	stakeRequestEpoch: bigint;
	stakeActiveEpoch: bigint;
	principal: Balance;
	estimatedReward?: Balance | undefined;
	validatorAddress: SuiAddress;
	stakingPool: SuiAddress;
}

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

// =========================================================================
//  Events
// =========================================================================

export type StakeEvent = StakedEvent;
export type UnstakeEvent = UnstakeRequestedEvent | UnstakedEvent;

export interface StakedEvent extends Event {
	stakedSuiId: ObjectId;
	suiId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	validatorFee: number;
	isRestaked: boolean;
	afSuiId: ObjectId;
	afSuiAmount: Balance;
	referrer?: SuiAddress;
}

export interface UnstakeRequestedEvent extends Event {
	afSuiId: ObjectId;
	providedAfSuiAmount: Balance;
	requester: SuiAddress;
	epoch: bigint;
}

export interface UnstakedEvent extends Event {
	afSuiId: ObjectId;
	providedAfSuiAmount: Balance;
	suiId: ObjectId;
	returnedSuiAmount: Balance;
	requester: SuiAddress;
	epoch: bigint;
}

export const isStakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is StakeEvent => {
	return "staker" in event;
};

export const isUnstakeEvent = (
	event: StakeEvent | UnstakeEvent
): event is UnstakeEvent => {
	return !isStakeEvent(event);
};

export interface EpochWasChangedEvent extends Event {
	activeEpoch: bigint;
	totalAfSuiSupply: Balance;
	totalSuiRewardsAmount: Balance;
	totalSuiAmount: Balance;
}

// =========================================================================
//  Staking Positions
// =========================================================================

export type StakingPosition = StakePosition | UnstakePosition;

export interface StakePosition {
	stakedSuiId: ObjectId;
	suiId: ObjectId;
	staker: SuiAddress;
	validatorAddress: SuiAddress;
	epoch: bigint;
	suiStakeAmount: Balance;
	validatorFee: number;
	isRestaked: boolean;
	afSuiId: ObjectId;
	afSuiAmount: Balance;
	// referrer?: SuiAddress;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export interface UnstakePosition {
	state: UnstakePositionState;
	afSuiId: ObjectId;
	providedAfSuiAmount: Balance;
	requester: SuiAddress;
	epoch: bigint;
	suiId?: ObjectId;
	returnedSuiAmount?: Balance;
	timestamp: Timestamp | undefined;
	txnDigest: TransactionDigest;
}

export type UnstakePositionState = "REQUEST" | "SUI_MINTED";

export const isStakePosition = (
	position: StakingPosition
): position is StakePosition => {
	return "stakedSuiId" in position;
};

export const isUnstakePosition = (
	position: StakingPosition
): position is UnstakePosition => {
	return !isStakePosition(position);
};

// =========================================================================
//  API
// =========================================================================

// =========================================================================
//  Transactions API
// =========================================================================

export interface ApiStakeBody {
	walletAddress: SuiAddress;
	suiStakeAmount: Balance;
	validatorAddress: SuiAddress;
	referrer?: SuiAddress;
	externalFee?: ExternalFee;
	isSponsoredTx?: boolean;
}

export interface ApiUnstakeBody {
	walletAddress: SuiAddress;
	afSuiUnstakeAmount: Balance;
	isAtomic: boolean;
	referrer?: SuiAddress;
	externalFee?: ExternalFee;
	isSponsoredTx?: boolean;
}

export interface ApiStakeStakedSuiBody {
	walletAddress: SuiAddress;
	stakedSuiIds: ObjectId[];
	validatorAddress: SuiAddress;
	referrer?: SuiAddress;
	isSponsoredTx?: boolean;
}

export interface ApiUpdateValidatorFeeBody {
	walletAddress: SuiAddress;
	validatorOperationCapId: ObjectId;
	newFeePercentage: Percentage;
	isSponsoredTx?: boolean;
}

// =========================================================================
//  Objects API
// =========================================================================

export interface ApiStakingPositionsBody {
	walletAddress: SuiAddress;
}

export interface ApiDelegatedStakesBody {
	walletAddress: SuiAddress;
}

export interface ApiValidatorOperationCapsBody {
	walletAddress: SuiAddress;
}

// =========================================================================
//  Events API
// =========================================================================

export type ApiStakingEventsBody = ApiEventsBody & {
	walletAddress: SuiAddress;
};

// =========================================================================
//  Router Pool
// =========================================================================

export type AfSuiRouterPoolObject = StakedSuiVaultStateObject & {
	afSuiCoinType: CoinType;
	aftermathValidatorAddress: SuiAddress;
	afSuiToSuiExchangeRate: number;
};

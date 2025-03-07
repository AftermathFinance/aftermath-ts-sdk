import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	FarmsAddresses,
	Timestamp,
	CoinType,
	ApiFarmsStakeBody,
	ApiHarvestFarmsRewardsBody,
	ApiFarmsDepositPrincipalBody,
	Balance,
	ApiFarmsUnstakeBody,
	FarmsLockEnforcement,
	FarmsMultiplier,
	ApiFarmsCreateStakingPoolBody,
	FarmsStakingPoolObject,
	ApiFarmsTopUpStakingPoolRewardsBody,
	ApiFarmsInitializeStakingPoolRewardBody,
	StakingPoolOwnerCapObject,
	ApiFarmsOwnedStakingPoolOwnerCapsBody,
	ApiFarmsIncreaseStakingPoolRewardsEmissionsBody,
	PartialFarmsStakedPositionObject,
	EventsInputs,
	FarmsStakedEvent,
	FarmsStakedRelaxedEvent,
	FarmsLockedEvent,
	FarmsUnlockedEvent,
	FarmsWithdrewPrincipalEvent,
	FarmsDepositedPrincipalEvent,
	FarmsHarvestedRewardsEvent,
	FarmsCreatedVaultEvent,
	StakingPoolOneTimeAdminCapObject,
	FarmOwnerOrOneTimeAdminCap,
	ObjectId,
	SuiAddress,
	BigIntAsString,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Sui } from "../../sui";
import {
	FarmsCreatedVaultEventOnChain,
	FarmsDepositedPrincipalEventOnChain,
	FarmsHarvestedRewardsEventOnChain,
	FarmsLockedEventOnChain,
	FarmsStakedEventOnChain,
	FarmsStakedRelaxedEventOnChain,
	FarmsUnlockedEventOnChain,
	FarmsWithdrewPrincipalEventOnChain,
} from "./farmsApiCastingTypes";
import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { Coin } from "../..";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";

export class FarmsApi implements MoveErrorsInterface {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			vault: "afterburner_vault",
			stakedPosition: "staked_position",
			vaultRegistry: "vault_registry",
			events: "vents",
		},
		eventNames: {
			// staking pools
			// creation
			createdVault: "CreatedVaultEvent",
			// mutation
			initializedReward: "InitializedRewardEvent",
			addedReward: "AddedRewardEvent",
			increasedEmissions: "IncreasedEmissionsEvent",

			// staking positions
			// creation
			staked: "StakedEvent",
			stakedRelaxed: "StakedEventRelaxed",
			// locking
			locked: "LockedEvent",
			unlocked: "UnlockedEvent",
			// mutation
			joined: "JoinedEvent",
			split: "SplitEvent",
			// staking
			depositedPrincipal: "DepositedPrincipalEvent",
			withdrewPrincipal: "WithdrewPrincipalEvent",
			// reward harvesting
			harvestedRewards: "HarvestedRewardsEvent",
			// destruction
			destroyedStakedPosition: "DestroyedStakedPositionEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: FarmsAddresses;
	public readonly objectTypes: {
		stakedPosition: AnyObjectType;
		stakingPoolOwnerCap: AnyObjectType;
		stakingPoolOneTimeAdminCap: AnyObjectType;
	};
	public readonly eventTypes: {
		// staking pools
		// creation
		createdVault: AnyObjectType;
		// mutation
		initializedReward: AnyObjectType;
		addedReward: AnyObjectType;
		increasedEmissions: AnyObjectType;

		// staking positions
		// creation
		staked: AnyObjectType;
		stakedRelaxed: AnyObjectType;
		// locking
		locked: AnyObjectType;
		unlocked: AnyObjectType;
		// staking
		depositedPrincipal: AnyObjectType;
		withdrewPrincipal: AnyObjectType;
		// reward harvesting
		harvestedRewards: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.farms;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
		this.objectTypes = {
			stakedPosition: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.stakedPosition}::StakedPosition`,
			stakingPoolOwnerCap: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.vault}::OwnerCap`,
			stakingPoolOneTimeAdminCap: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.vault}::OneTimeAdminCap`,
		};
		this.eventTypes = {
			// staking pools
			// creation
			createdVault: this.createdVaultEventType(),
			// mutation
			initializedReward: this.initializedRewardEventType(),
			addedReward: this.addedRewardEventType(),
			increasedEmissions: this.increasedEmissionsEventType(),

			// staking positions
			// creation
			staked: this.stakedEventType(),
			stakedRelaxed: this.stakedRelaxedEventType(),
			// locking
			locked: this.lockedEventType(),
			unlocked: this.unlockedEventType(),
			// staking
			depositedPrincipal: this.depositedPrincipalEventType(),
			withdrewPrincipal: this.withdrewPrincipalEventType(),
			// reward harvesting
			harvestedRewards: this.harvestedRewardsEventType(),
		};
		this.moveErrors = {
			[this.addresses.packages.vaults]: {
				[FarmsApi.constants.moduleNames.vault]: {
					/// A user attempts provides a `Coin` or `u64` with value zero.
					0: "Zero",
					/// A user provides a `StakedPosition` and a `AfterburnerVault` that don't correspond with one
					///  another. This can only occur if two `AfterburnerVault` with the same underlying `STAKED` generic
					///  are created.
					1: "Invalid Afterburner Vault",
					/// A user tries to create an `AfterburnerVault` where `min_lock_duration_ms` is strictly greater than
					///  `max_lock_duration_ms`.
					2: "Invalid Min Max Lock Durations",
					/// The creator of a `AfterburnerVault` tries to update the vault's emission rate or add more rewards
					///  without first initializing the emissions schedule.
					3: "Emissions Not Initialized",
					/// The creator of a `AfterburnerVault` tries to update the vault's emission schedule/rate but
					///  provides a schedule/rate pair that will decrease emissions for the specified reward type.
					4: "Emissions Not Increasing",
					5: "Bad Type",
					/// A user attempts to stake into a `AfterburnerVault` below the vault's `min_stake_amount` or
					///  an amount of principal that would bring their position below the vault's `min_stake_amount`.
					6: "Invalid Stake Amount",
					/// A user attempts to create an `AfterburnerVault` and provides a `lock_enforcement` that doesn't
					///  match one of `STRICT_LOCK_ENFORCEMENT` or `RELAXED_LOCK_ENFORCEMENT`.
					7: "Invalid Lock Enforcement",
					/// A user tries to claim zero rewards
					8: "Zero Claim",
					/// A user provided invalid max lock multiplier (< 1)
					9: "Invalid Lock Multiplier",
					10: "Invalid Argument",
					11: "Deprecated",
					12: "Afterburner Vault Still Active",
				},
				[FarmsApi.constants.moduleNames.stakedPosition]: {
					/// A user attempts provides a `Coin` or `u64` with value zero.
					0: "Zero",
					/// A user attempts to withdraw funds from a `StakedPosition` that is still locked.
					1: "Locked",
					/// A user provides a `StakedPosition` and a `AfterburnerVault` that don't correspond with one another.
					///  This can only occur if two `AfterburnerVault` with the same underlying `STAKED` generic are created.
					2: "Invalid Afterburner Vault",
					/// A user tries to lock the coins in a `AfterburnerVault` with a `lock_duration_ms` below the vault's
					///  `min_lock_duration_ms`.
					3: "Invalid Lock Duration",
					/// A user attempts to destroy a `StakedPosition` that still holds rewards that can be harvested.
					4: "Harvest Rewards",
					/// A user attempts to stake into a `AfterburnerVault` below the vault's `min_stake_amount` or
					///  an amount of principal that would bring their position below the vault's `min_stake_amount`.
					5: "Invalid Stake Amount",
					6: "Invalid Withdraw Amount",
					7: "Invalid Split Amount",
					8: "Uninitialized Vault Rewards",
					9: "Not Implemented",
					/// A user requested to harvest zero base rewards.
					10: "Zero Rewards",
				},
			},
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Staking Pool Objects
	// =========================================================================

	public fetchOwnedStakingPoolOwnerCaps = async (
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	): Promise<StakingPoolOwnerCapObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.stakingPoolOwnerCap,
			objectFromSuiObjectResponse:
				Casting.farms.stakingPoolOwnerCapObjectFromSuiObjectResponse,
		});
	};

	public fetchOwnedStakingPoolOneTimeAdminCaps = async (
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	): Promise<StakingPoolOneTimeAdminCapObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.stakingPoolOneTimeAdminCap,
			objectFromSuiObjectResponse:
				Casting.farms
					.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Staked Position Objects
	// =========================================================================

	public fetchOwnedPartialStakedPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<PartialFarmsStakedPositionObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.stakedPosition,
			objectFromSuiObjectResponse:
				Casting.farms.partialStakedPositionObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Created Vault
	// =========================================================================

	public fetchCreatedVaultEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsCreatedVaultEventOnChain,
			FarmsCreatedVaultEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.createdVault,
			},
			eventFromEventOnChain: Casting.farms.createdVaultEventFromOnChain,
		});

	// =========================================================================
	//  Staking Position Creation
	// =========================================================================

	public fetchStakedEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsStakedEventOnChain,
			FarmsStakedEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.staked,
			},
			eventFromEventOnChain: Casting.farms.stakedEventFromOnChain,
		});

	public fetchStakedRelaxedEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsStakedRelaxedEventOnChain,
			FarmsStakedRelaxedEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.stakedRelaxed,
			},
			eventFromEventOnChain: Casting.farms.stakedRelaxedEventFromOnChain,
		});

	// =========================================================================
	//  Staking Position Locking
	// =========================================================================

	public fetchLockedEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsLockedEventOnChain,
			FarmsLockedEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.locked,
			},
			eventFromEventOnChain: Casting.farms.lockedEventFromOnChain,
		});

	public fetchUnlockedEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsUnlockedEventOnChain,
			FarmsUnlockedEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.unlocked,
			},
			eventFromEventOnChain: Casting.farms.unlockedEventFromOnChain,
		});

	// =========================================================================
	//  Staking Position Staking
	// =========================================================================

	public fetchDepositedPrincipalEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsDepositedPrincipalEventOnChain,
			FarmsDepositedPrincipalEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.depositedPrincipal,
			},
			eventFromEventOnChain:
				Casting.farms.depositedPrincipalEventFromOnChain,
		});

	public fetchWithdrewPrincipalEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsWithdrewPrincipalEventOnChain,
			FarmsWithdrewPrincipalEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.withdrewPrincipal,
			},
			eventFromEventOnChain:
				Casting.farms.withdrewPrincipalEventFromOnChain,
		});

	// =========================================================================
	//  Staking Position Reward Harvesting
	// =========================================================================

	public fetchHarvestedRewardsEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			FarmsHarvestedRewardsEventOnChain,
			FarmsHarvestedRewardsEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.harvestedRewards,
			},
			eventFromEventOnChain:
				Casting.farms.harvestedRewardsEventFromOnChain,
		});

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	public stakeTx = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinId: ObjectId | TransactionArgument;
		lockDurationMs: Timestamp;
		stakeCoinType: CoinType;
	}) /* (StakedPosition) */ => {
		const { tx, stakeCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"stake"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof stakeCoinId === "string"
					? tx.object(stakeCoinId)
					: stakeCoinId, // Coin
				tx.pure.u64(inputs.lockDurationMs),
			],
		});
	};

	public depositPrincipalTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
	}) => {
		const { tx, stakeCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"deposit_principal"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof stakeCoinId === "string"
					? tx.object(stakeCoinId)
					: stakeCoinId, // Coin
			],
		});
	};

	public withdrawPrincipalTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		withdrawAmount: Balance;
		stakeCoinType: CoinType;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"withdraw_principal"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.withdrawAmount),
			],
		});
	};

	public destroyStakedPositionTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"destroy"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public updatePositionTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"update_position"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Locking Transaction Commands
	// =========================================================================

	public lockTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		lockDurationMs: Timestamp;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"lock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.lockDurationMs),
			],
		});
	};

	public renewLockTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"renew_lock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public unlockTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"unlock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Reward Harvesting Transaction Commands
	// =========================================================================

	public beginHarvestTx = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (HarvestedRewardsEventMetadata) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"begin_harvest"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
			],
		});
	};

	public harvestRewardsTx = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		harvestedRewardsEventMetadataId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) /* (Coin) */ => {
		const { tx, harvestedRewardsEventMetadataId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"harvest_rewards"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				typeof harvestedRewardsEventMetadataId === "string"
					? tx.object(harvestedRewardsEventMetadataId)
					: harvestedRewardsEventMetadataId, // HarvestedRewardsEventMetadata
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public endHarvestTx = (inputs: {
		tx: Transaction;
		harvestedRewardsEventMetadataId: ObjectId | TransactionArgument;
	}) => {
		const { tx, harvestedRewardsEventMetadataId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.stakedPosition,
				"end_harvest"
			),
			typeArguments: [],
			arguments: [
				typeof harvestedRewardsEventMetadataId === "string"
					? tx.object(harvestedRewardsEventMetadataId)
					: harvestedRewardsEventMetadataId, // HarvestedRewardsEventMetadata
			],
		});
	};

	// =========================================================================
	//  Staking Pool Creation Transaction Commands
	// =========================================================================

	public newStakingPoolTx = (inputs: {
		tx: Transaction;
		lockEnforcement: FarmsLockEnforcement;
		minLockDurationMs: Timestamp;
		maxLockDurationMs: Timestamp;
		maxLockMultiplier: FarmsMultiplier;
		minStakeAmount: Balance;
		stakeCoinType: CoinType;
	}) /* (AfterburnerVault, OwnerCap) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"new"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.pure.u64(inputs.lockEnforcement === "Strict" ? 0 : 1),
				tx.pure.u64(inputs.minLockDurationMs),
				tx.pure.u64(inputs.maxLockDurationMs),
				tx.pure.u64(inputs.maxLockMultiplier),
				tx.pure.u64(inputs.minStakeAmount),
			],
		});
	};

	public shareStakingPoolTx = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
	}) => {
		const { tx, stakingPoolId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"share_vault"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				typeof stakingPoolId === "string"
					? tx.object(stakingPoolId)
					: stakingPoolId, // AfterburnerVault
			],
		});
	};

	public transferOwnerCapTx = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId | TransactionArgument;
		recipientAddress: SuiAddress;
	}) => {
		const { tx, ownerCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"transfer_owner_cap"
			),
			typeArguments: [],
			arguments: [
				typeof ownerCapId === "string"
					? tx.object(ownerCapId)
					: ownerCapId, // OwnerCap
				tx.pure.address(inputs.recipientAddress),
			],
		});
	};

	public grantOneTimeAdminCapTx = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId | TransactionArgument;
		recipientAddress: SuiAddress;
		rewardCoinType: CoinType;
	}) => {
		const { tx, ownerCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"grant_one_time_admin_cap"
			),
			typeArguments: [inputs.rewardCoinType],
			arguments: [
				typeof ownerCapId === "string"
					? tx.object(ownerCapId)
					: ownerCapId, // OwnerCap
				tx.pure.address(inputs.recipientAddress),
			],
		});
	};

	// =========================================================================
	//  Staking Pool Mutation Transaction Commands
	// =========================================================================

	public initializeStakingPoolRewardTx = (
		inputs: {
			tx: Transaction;
			stakingPoolId: ObjectId;
			rewardCoinId: ObjectId | TransactionArgument;
			emissionScheduleMs: Timestamp;
			emissionRate: bigint;
			emissionDelayTimestampMs: Timestamp;
			stakeCoinType: CoinType;
			rewardCoinType: CoinType;
		} & FarmOwnerOrOneTimeAdminCap
	) => {
		const { tx, rewardCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"initialize_reward" +
					(FarmsApi.isFarmOneTimeAdminCapId(inputs)
						? "_and_consume_admin_cap"
						: "")
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(FarmsApi.farmCapId(inputs)), // OwnerCap / OneTimeAdminCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
				tx.pure.u64(inputs.emissionScheduleMs),
				tx.pure.u64(inputs.emissionRate),
				tx.pure.u64(inputs.emissionDelayTimestampMs),
			],
		});
	};

	public topUpStakingPoolRewardTx = (
		inputs: {
			tx: Transaction;
			stakingPoolId: ObjectId;
			rewardCoinId: ObjectId | TransactionArgument;
			stakeCoinType: CoinType;
			rewardCoinType: CoinType;
		} & FarmOwnerOrOneTimeAdminCap
	) => {
		const { tx, rewardCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"add_reward" +
					(FarmsApi.isFarmOneTimeAdminCapId(inputs)
						? "_and_consume_admin_cap"
						: "")
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(FarmsApi.farmCapId(inputs)), // OwnerCap / OneTimeAdminCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
			],
		});
	};

	public increaseStakingPoolRewardEmissionsTx = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"update_emissions_for"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.emissionScheduleMs),
				tx.pure.u64(inputs.emissionRate),
			],
		});
	};

	public setStakingPoolMinStakeAmountTx = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		minStakeAmount: bigint;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"set_min_stake_amount"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.pure.u64(inputs.minStakeAmount),
			],
		});
	};

	// =========================================================================
	//  Staking Pool Inspection Transaction Commands
	// =========================================================================

	public isVaultUnlockedTx = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (bool) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"is_vault_unlocked"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
			],
		});
	};

	public remainingRewardsTx = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (vector<u64>) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"remaining_rewards"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
			],
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Transactions
	// =========================================================================

	public fetchBuildStakeTx = async (inputs: ApiFarmsStakeBody) => {
		const { walletAddress, isSponsoredTx } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const stakeCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.stakeCoinType,
			coinAmount: inputs.stakeAmount,
			isSponsoredTx,
		});

		const stakedPosition = this.stakeTx({ ...inputs, tx, stakeCoinId });
		tx.transferObjects([stakedPosition], walletAddress);

		return tx;
	};

	public fetchBuildDepositPrincipalTx = async (
		inputs: ApiFarmsDepositPrincipalBody
	) => {
		const { walletAddress, isSponsoredTx } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const stakeCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.stakeCoinType,
			coinAmount: inputs.depositAmount,
			isSponsoredTx,
		});

		this.depositPrincipalTx({
			...inputs,
			tx,
			stakeCoinId,
		});

		return tx;
	};

	public fetchBuildWithdrawPrincipalTx = async (inputs: {
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		withdrawAmount: Balance;
		stakeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const withdrawnCoin = this.withdrawPrincipalTx({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		return tx;
	};

	public fetchBuildUnstakeTx = async (inputs: ApiFarmsUnstakeBody) => {
		const { walletAddress } = inputs;

		let tx;
		if (inputs.rewardCoinTypes.length > 0) {
			// harvest rewards
			tx = await this.fetchBuildHarvestRewardsTx({
				...inputs,
				stakedPositionIds: [inputs.stakedPositionId],
			});
		} else {
			// no rewards to harvest
			tx = new Transaction();
			tx.setSender(walletAddress);
		}

		// withdraw principal
		const withdrawnCoin = this.withdrawPrincipalTx({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		// destroy position
		this.destroyStakedPositionTx({ ...inputs, tx });

		return tx;
	};

	public buildUpdatePositionTx = Helpers.transactions.createBuildTxFunc(
		this.updatePositionTx
	);

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	public buildLockTx = Helpers.transactions.createBuildTxFunc(this.lockTx);

	public buildRenewLockTx = Helpers.transactions.createBuildTxFunc(
		this.renewLockTx
	);

	public buildUnlockTx = Helpers.transactions.createBuildTxFunc(
		this.unlockTx
	);

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	public fetchBuildHarvestRewardsTx = async (
		inputs: ApiHarvestFarmsRewardsBody
	): Promise<Transaction> => {
		const { walletAddress, stakedPositionIds } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const harvestedRewardsEventMetadataId = this.beginHarvestTx({
			...inputs,
			tx,
		});

		let harvestedCoins: Record<CoinType, TransactionObjectArgument[]> = {};

		for (const stakedPositionId of stakedPositionIds) {
			for (const rewardCoinType of inputs.rewardCoinTypes) {
				const harvestedCoin = this.harvestRewardsTx({
					...inputs,
					tx,
					stakedPositionId,
					harvestedRewardsEventMetadataId,
					rewardCoinType,
				});

				if (rewardCoinType in harvestedCoins) {
					harvestedCoins[rewardCoinType].push(harvestedCoin);
				} else {
					harvestedCoins[rewardCoinType] = [harvestedCoin];
				}
			}
		}

		this.endHarvestTx({ tx, harvestedRewardsEventMetadataId });

		for (const [coinType, harvestedCoinIds] of Object.entries(
			harvestedCoins
		)) {
			const coinToTransfer = harvestedCoinIds[0];

			if (harvestedCoinIds.length > 1)
				tx.mergeCoins(coinToTransfer, harvestedCoinIds.slice(1));

			if (inputs.claimSuiAsAfSui && Coin.isCoinObjectType(coinType)) {
				this.Provider.Staking().stakeTx({
					tx,
					suiCoin: coinToTransfer,
					withTransfer: true,
					validatorAddress:
						this.Provider.Staking().addresses.objects
							.aftermathValidator,
				});
			} else {
				tx.transferObjects([coinToTransfer], walletAddress);
			}
		}

		return tx;
	};

	// =========================================================================
	//  Staking Pool Transactions
	// =========================================================================

	// =========================================================================
	//  Staking Pool Creation Transactions
	// =========================================================================

	public fetchBuildCreateStakingPoolTx = async (
		inputs: ApiFarmsCreateStakingPoolBody
	): Promise<Transaction> => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const [stakingPoolId, ownerCapId] = this.newStakingPoolTx({
			...inputs,
			tx,
		});
		this.shareStakingPoolTx({
			tx,
			stakingPoolId,
			stakeCoinType: inputs.stakeCoinType,
		});
		this.transferOwnerCapTx({
			tx,
			ownerCapId,
			recipientAddress: walletAddress,
		});

		return tx;
	};

	// =========================================================================
	//  Staking Pool Mutation Transactions
	// =========================================================================

	public fetchBuildInitializeStakingPoolRewardTx = async (
		inputs: ApiFarmsInitializeStakingPoolRewardBody
	): Promise<Transaction> => {
		const { walletAddress, isSponsoredTx } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const rewardCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.rewardCoinType,
			coinAmount: inputs.rewardAmount,
			isSponsoredTx,
		});

		this.initializeStakingPoolRewardTx({ ...inputs, tx, rewardCoinId });

		return tx;
	};

	public fetchBuildTopUpStakingPoolRewardsTx = async (
		inputs: ApiFarmsTopUpStakingPoolRewardsBody
	): Promise<Transaction> => {
		const { walletAddress, isSponsoredTx } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			const rewardCoinId =
				await this.Provider.Coin().fetchCoinWithAmountTx({
					tx,
					walletAddress,
					coinType: reward.rewardCoinType,
					coinAmount: reward.rewardAmount,
					isSponsoredTx,
				});

			this.topUpStakingPoolRewardTx({
				...inputs,
				...reward,
				tx,
				rewardCoinId,
			});
		}

		return tx;
	};

	public fetchIncreaseStakingPoolRewardsEmissionsTx = (
		inputs: ApiFarmsIncreaseStakingPoolRewardsEmissionsBody
	) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			this.increaseStakingPoolRewardEmissionsTx({
				...inputs,
				...reward,
				tx,
			});
		}

		return tx;
	};

	public buildSetStakingPoolMinStakeAmountTx =
		Helpers.transactions.createBuildTxFunc(
			this.setStakingPoolMinStakeAmountTx
		);

	public buildGrantOneTimeAdminCapTx = Helpers.transactions.createBuildTxFunc(
		this.grantOneTimeAdminCapTx
	);

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	// =========================================================================
	//  Vault Creation
	// =========================================================================

	private createdVaultEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.createdVault
		);

	// =========================================================================
	//  Vault Mutation
	// =========================================================================

	private initializedRewardEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.initializedReward
		);

	private addedRewardEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.addedReward
		);

	private increasedEmissionsEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.increasedEmissions
		);

	// =========================================================================
	//  Staking Position Creation
	// =========================================================================

	private stakedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.staked
		);

	private stakedRelaxedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.stakedRelaxed
		);

	// =========================================================================
	//  Staking Position Locking
	// =========================================================================

	private lockedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.locked
		);

	private unlockedEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.unlocked
		);

	// =========================================================================
	//  Staking Position Staking
	// =========================================================================

	private depositedPrincipalEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.depositedPrincipal
		);

	private withdrewPrincipalEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.withdrewPrincipal
		);

	// =========================================================================
	//  Staking Position Reward Harvesting
	// =========================================================================

	private harvestedRewardsEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.harvestedRewards
		);

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static isFarmOwnerCapId = (inputs: FarmOwnerOrOneTimeAdminCap) =>
		"ownerCapId" in inputs;

	private static isFarmOneTimeAdminCapId = (
		inputs: FarmOwnerOrOneTimeAdminCap
	) => "oneTimeAdminCapId" in inputs;

	private static farmCapId = (inputs: FarmOwnerOrOneTimeAdminCap) =>
		"ownerCapId" in inputs ? inputs.ownerCapId : inputs.oneTimeAdminCapId;
}

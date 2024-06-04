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
	FarmsIndexerVaultsResponse,
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

export class FarmsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			vault: "afterburner_vault",
			stakedPosition: "staked_position",
			vaultRegistry: "vault_registry",
			events: "events",
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

	public fetchStakingPool = async (inputs: {
		objectId: ObjectId;
	}): Promise<FarmsStakingPoolObject> => {
		return (
			await this.fetchStakingPools({ objectIds: [inputs.objectId] })
		)[0];
	};

	public fetchStakingPools = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<FarmsStakingPoolObject[]> => {
		const vaultIds = inputs.objectIds.map((objectId) =>
			Helpers.addLeadingZeroesToType(objectId)
		);
		const uncastFarms =
			await this.Provider.indexerCaller.fetchIndexer<FarmsIndexerVaultsResponse>(
				"afterburner-vaults/vaults",
				undefined,
				{
					vault_ids: vaultIds,
				}
			);
		const farms =
			Casting.farms.stakingPoolObjectsFromIndexerResponse(uncastFarms);
		return vaultIds.map(
			(objectId) =>
				farms.find(
					(farm) =>
						farm.objectId ===
						Helpers.addLeadingZeroesToType(objectId)
					// TODO: handle this error case better
				)!
		);
	};

	public fetchAllStakingPools = async (): Promise<
		FarmsStakingPoolObject[]
	> => {
		const farms =
			await this.Provider.indexerCaller.fetchIndexer<FarmsIndexerVaultsResponse>(
				"afterburner-vaults/vaults"
			);
		return Casting.farms.stakingPoolObjectsFromIndexerResponse(farms);
	};

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

	public buildGrantOneTimeAdminCapTx = Helpers.transactions.createBuildTxFunc(
		this.grantOneTimeAdminCapTx
	);

	public async fetchIsStakingPoolUnlocked(inputs: {
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}): Promise<boolean> {
		return (
			await this.fetchIsUnlockedForStakingPools({
				stakingPoolIds: [inputs.stakingPoolId],
				stakeCoinTypes: [inputs.stakeCoinType],
			})
		)[0];
	}

	public async fetchStakingPoolRemainingRewards(inputs: {
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}): Promise<Balance[]> {
		return (
			await this.fetchRemainingRewardsForStakingPools({
				stakingPoolIds: [inputs.stakingPoolId],
				stakeCoinTypes: [inputs.stakeCoinType],
			})
		)[0];
	}

	public async fetchIsUnlockedForStakingPools(inputs: {
		stakingPoolIds: ObjectId[];
		stakeCoinTypes: CoinType[];
	}): Promise<boolean[]> {
		const tx = new Transaction();

		for (const [index, stakingPoolId] of inputs.stakingPoolIds.entries()) {
			this.isVaultUnlockedTx({
				tx,
				stakingPoolId,
				stakeCoinType: inputs.stakeCoinTypes[index],
			});
		}

		const { allBytes } =
			await this.Provider.Inspections().fetchAllBytesFromTx({
				tx,
			});

		return allBytes.map((bytes) =>
			bcs.bool().parse(new Uint8Array(bytes[0]))
		);
	}

	public async fetchRemainingRewardsForStakingPools(inputs: {
		stakingPoolIds: ObjectId[];
		stakeCoinTypes: CoinType[];
	}): Promise<Balance[][]> {
		const tx = new Transaction();

		for (const [index, stakingPoolId] of inputs.stakingPoolIds.entries()) {
			this.remainingRewardsTx({
				tx,
				stakingPoolId,
				stakeCoinType: inputs.stakeCoinTypes[index],
			});
		}

		const { allBytes } =
			await this.Provider.Inspections().fetchAllBytesFromTx({
				tx,
			});

		return allBytes.map((bytes) =>
			(
				bcs
					.vector(bcs.u64())
					.parse(new Uint8Array(bytes[0])) as BigIntAsString[]
			).map((num) => BigInt(num))
		);
	}

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

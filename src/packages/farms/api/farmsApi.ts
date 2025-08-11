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
	ApiFarmsCreateStakingPoolBodyV1,
	ApiFarmsStakeBodyV1,
	FarmsVersion,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Sui } from "../../sui";
import {
	FarmsCreatedVaultEventOnChainV1,
	FarmsDepositedPrincipalEventOnChainV1,
	FarmsHarvestedRewardsEventOnChainV1,
	FarmsLockedEventOnChainV1,
	FarmsStakedEventOnChainV1,
	FarmsStakedRelaxedEventOnChainV1,
	FarmsUnlockedEventOnChainV1,
	FarmsWithdrewPrincipalEventOnChainV1,
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
			vaultV1: "afterburner_vault",
			vaultV2: "vault",
			stakedPosition: "staked_position",
			vaultRegistry: "vault_registry",
			events: "events",
			authority: "authority",
		},
		eventNames: {
			// staking pools
			// creation
			createdVault: "CreatedVaultEvent",
			// mutation
			initializedReward: "InitializedRewardEvent",
			addedReward: "AddedRewardEvent",
			increasedEmissions: "IncreasedEmissionsEvent",
			updatedEmissions: "UpdatedEmissionsEvent",

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
		stakedPositionV1: AnyObjectType;
		stakingPoolOwnerCapV1: AnyObjectType;
		stakingPoolOneTimeAdminCapV1: AnyObjectType;
		stakedPositionV2: AnyObjectType;
		stakingPoolOwnerCapV2: AnyObjectType;
		stakingPoolOneTimeAdminCapV2: AnyObjectType;
	};
	public readonly eventTypes: {
		// v1
		// staking pools
		// creation
		createdVaultV1: AnyObjectType;
		// mutation
		initializedRewardV1: AnyObjectType;
		addedRewardV1: AnyObjectType;
		increasedEmissionsV1: AnyObjectType;

		// staking positions
		// creation
		stakedV1: AnyObjectType;
		stakedRelaxedV1: AnyObjectType;
		// locking
		lockedV1: AnyObjectType;
		unlockedV1: AnyObjectType;
		// staking
		depositedPrincipalV1: AnyObjectType;
		withdrewPrincipalV1: AnyObjectType;
		// reward harvesting
		harvestedRewardsV1: AnyObjectType;

		// v2
		// staking pools
		// creation
		createdVaultV2: AnyObjectType;
		// mutation
		initializedRewardV2: AnyObjectType;
		addedRewardV2: AnyObjectType;
		updatedEmissionsV2: AnyObjectType;

		// staking positions
		// creation
		stakedV2: AnyObjectType;
		// locking
		lockedV2: AnyObjectType;
		unlockedV2: AnyObjectType;
		// staking
		depositedPrincipalV2: AnyObjectType;
		withdrewPrincipalV2: AnyObjectType;
		// reward harvesting
		harvestedRewardsV2: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Constructor for FarmsApi
	 * @param Provider The AftermathApi provider instance
	 * @throws Error if not all required addresses have been set in provider
	 */
	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.farms;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
		this.objectTypes = {
			stakedPositionV1: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.stakedPosition}::StakedPosition`,
			stakingPoolOwnerCapV1: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.vaultV1}::OwnerCap`,
			stakingPoolOneTimeAdminCapV1: `${addresses.packages.vaultsInitial}::${FarmsApi.constants.moduleNames.vaultV1}::OneTimeAdminCap`,
			stakedPositionV2: `${addresses.packages.eventsV2}::${FarmsApi.constants.moduleNames.stakedPosition}::StakedPosition`,
			stakingPoolOwnerCapV2: `${addresses.packages.eventsV2}::${FarmsApi.constants.moduleNames.authority}::AuthorityCap<${addresses.packages.eventsV2}::${FarmsApi.constants.moduleNames.authority}::VAULT<${addresses.packages.eventsV2}::${FarmsApi.constants.moduleNames.authority}::ADMIN>>`,
			// NOTE: will this work with `<phantom Role, phantom Reward>` ?
			stakingPoolOneTimeAdminCapV2: `${addresses.packages.eventsV2}::${FarmsApi.constants.moduleNames.vaultV2}::OneTime`,
		};
		this.eventTypes = {
			// v1
			// staking pools
			// creation
			createdVaultV1: this.createdVaultEventType(1),
			// mutation
			initializedRewardV1: this.initializedRewardEventType(1),
			addedRewardV1: this.addedRewardEventType(1),
			increasedEmissionsV1: this.increasedEmissionsEventType(),

			// staking positions
			// creation
			stakedV1: this.stakedEventType(1),
			stakedRelaxedV1: this.stakedRelaxedEventType(1),
			// locking
			lockedV1: this.lockedEventType(1),
			unlockedV1: this.unlockedEventType(1),
			// staking
			depositedPrincipalV1: this.depositedPrincipalEventType(1),
			withdrewPrincipalV1: this.withdrewPrincipalEventType(1),
			// reward harvesting
			harvestedRewardsV1: this.harvestedRewardsEventType(1),

			// v2
			// staking pools
			// creation
			createdVaultV2: this.createdVaultEventType(2),
			// mutation
			initializedRewardV2: this.initializedRewardEventType(2),
			addedRewardV2: this.addedRewardEventType(2),
			updatedEmissionsV2: this.updatedEmissionsEventType(),

			// staking positions
			// creation
			stakedV2: this.stakedEventType(2),
			// locking
			lockedV2: this.lockedEventType(2),
			unlockedV2: this.unlockedEventType(2),
			// staking
			depositedPrincipalV2: this.depositedPrincipalEventType(2),
			withdrewPrincipalV2: this.withdrewPrincipalEventType(2),
			// reward harvesting
			harvestedRewardsV2: this.harvestedRewardsEventType(2),
		};
		this.moveErrors = {
			[this.addresses.packages.vaults]: {
				[FarmsApi.constants.moduleNames.vaultV1]: {
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
			[this.addresses.packages.vaultsV2]: {
				[FarmsApi.constants.moduleNames.vaultV2]: {
					/// A user provides a `Coin` with value zero.
					0: "Zero",
					/// A user tries to create a `Vault` where `min_lock_duration_ms` is strictly greater than
					/// `max_lock_duration_ms`.
					1: "Invalid Min Max Lock Durations",
					/// A user tries to create a `Vault` and provides a `u8` that does not map to a valid lock
					/// enforcement policy.
					2: "Invalid Lock Enforcement",
					/// The creator of a `Vault` tries to update the emission schedule or add more of a specific
					/// reward type that has not yet been initialized into the `Vault`.
					3: "Emissions Not Initialized",
					/// A `Reward` `Coin` type was passed to a function and either the `Reward` type does not
					/// correspond to any of the `Vault`'s reward types--for the functions that act on the `Reward`
					/// type--or, for `initialize_reward`, the `Reward` type has already had its emissions initialized.
					4: "Invalid Reward Coin Type",
					/// A user attempts to withdraw an amount of principal that would bring their position below the
					/// `Vault`'s `min_stake_amount`.
					5: "Invalid Stake Amount",
					/// A user tries to claim zero rewards
					6: "Zero Claim",
					/// A user provided a max lock multiplier that was strictly less than the minimum lower bound.
					7: "Invalid Lock Multiplier",
				},
				[FarmsApi.constants.moduleNames.stakedPosition]: {
					/// A user attempts to perform a restricted action on a `StakedPosition` that is still locked. For
					/// example `unlock` can only be called on a `StakedPosition` that is no longer locked.
					0: "Locked",
					/// A user provides a `StakedPosition` and a `Vault` that don't correspond with one another.
					/// This can only occur if two `Vault`s with the same underlying `Stake` generic are created.
					1: "Invalid Vault",
					/// A user tries to stake into a `Vault` with a `lock_duration_ms` below the vault's
					/// `min_lock_duration_ms`.
					2: "Invalid Lock Duration",
					/// A user attempts to withdraw an amount of principal that would bring their position below the
					/// `Vault`'s `min_stake_amount`.
					3: "Invalid Stake Amount",
					/// A user attempts to withdraw more principal than their `StakedPosition` holds.
					4: "Invalid Withdraw Amount",
					/// A user attempts to split more principal than their `StakedPosition` holds.
					5: "Invalid Split Amount",
					/// A user attempts to stake into a `Vault` that has no rewards.
					6: "Vault Is Inactive",
					/// A user requested to harvest a reward type for which they've only accrued less than the minimal
					/// claim amount.
					7: "Zero Rewards",
					/// A user attempts to stake into a `Vault` with a `LockEnforcement` policy that the vault does
					/// not support.
					8: "Invalid Lock Enforcement",
					/// A user attempts to call `destroy` on a `StakedPosition` that has unharvested rewards.
					9: "Position Has Unclaimed Rewards",
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

	/**
	 * Fetches the owner caps for staking pools owned by a specific wallet address
	 * @param inputs Object containing wallet address
	 * @returns Array of StakingPoolOwnerCapObject
	 */
	public fetchOwnedStakingPoolOwnerCaps = async (
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	): Promise<StakingPoolOwnerCapObject[]> => {
		const { walletAddress } = inputs;

		const [capsV1, capsV2] = await Promise.all([
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakingPoolOwnerCapV1,
				objectFromSuiObjectResponse:
					Casting.farms
						.stakingPoolOwnerCapObjectFromSuiObjectResponseV1,
			}),
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakingPoolOwnerCapV2,
				objectFromSuiObjectResponse:
					Casting.farms
						.stakingPoolOwnerCapObjectFromSuiObjectResponseV2,
			}),
		]);
		return [...capsV1, ...capsV2];
	};

	/**
	 * Fetches the one-time admin caps for staking pools owned by a specific wallet address
	 * @param inputs Object containing wallet address
	 * @returns Array of StakingPoolOneTimeAdminCapObject
	 */
	public fetchOwnedStakingPoolOneTimeAdminCaps = async (
		inputs: ApiFarmsOwnedStakingPoolOwnerCapsBody
	): Promise<StakingPoolOneTimeAdminCapObject[]> => {
		const { walletAddress } = inputs;

		const [capsV1, capsV2] = await Promise.all([
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakingPoolOneTimeAdminCapV1,
				objectFromSuiObjectResponse:
					Casting.farms
						.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV1,
			}),
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakingPoolOneTimeAdminCapV2,
				objectFromSuiObjectResponse:
					Casting.farms
						.stakingPoolOneTimeAdminCapObjectFromSuiObjectResponseV2,
			}),
		]);
		return [...capsV1, ...capsV2];
	};

	// =========================================================================
	//  Staked Position Objects
	// =========================================================================

	/**
	 * Fetches partial staked positions owned by a specific wallet address
	 * @param inputs Object containing wallet address
	 * @returns Array of PartialFarmsStakedPositionObject
	 */
	public fetchOwnedPartialStakedPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<PartialFarmsStakedPositionObject[]> => {
		const { walletAddress } = inputs;

		const [positionsV1, positionsV2] = await Promise.all([
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakedPositionV1,
				objectFromSuiObjectResponse:
					Casting.farms
						.partialStakedPositionObjectFromSuiObjectResponseV1,
			}),
			this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
				walletAddress,
				objectType: this.objectTypes.stakedPositionV2,
				objectFromSuiObjectResponse:
					Casting.farms
						.partialStakedPositionObjectFromSuiObjectResponseV2,
			}),
		]);
		return [...positionsV1, ...positionsV2];
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	/**
	 * @deprecated use stakeTxV2 instead
	 * Creates a transaction to stake coins in a staking pool (original version)
	 * @param inputs Staking parameters including transaction, pool ID, coin ID, lock duration, and coin type
	 * @returns Transaction object argument for StakedPosition
	 */
	public stakeTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to stake coins in a staking pool
	 * @param inputs Staking parameters including transaction, pool ID, coin ID, lock duration, lock enforcement, and coin type
	 * @returns Transaction object argument for StakedPosition
	 */
	public stakeTxV2 = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinId: ObjectId | TransactionArgument;
		lockDurationMs: Timestamp;
		lockEnforcement: FarmsLockEnforcement;
		stakeCoinType: CoinType;
	}) /* (StakedPosition) */ => {
		const { tx, stakeCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"stake"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof stakeCoinId === "string"
					? tx.object(stakeCoinId)
					: stakeCoinId, // Coin
				tx.pure.u8(inputs.lockEnforcement === "Strict" ? 0 : 1), // lock_enforcement
				tx.pure.u64(inputs.lockDurationMs), // lock_duration_ms
			],
		});
	};

	/**
	 * @deprecated use depositPrincipalTxV2 instead
	 * Creates a transaction to deposit additional principal to a staked position (original version)
	 * @param inputs Deposit parameters including transaction, position ID, pool ID, coin ID, and coin type
	 * @returns Transaction command to deposit principal
	 */
	public depositPrincipalTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to deposit additional principal to a staked position
	 * @param inputs Deposit parameters including transaction, position ID, pool ID, coin ID, and coin type
	 * @returns Transaction command to deposit principal
	 */
	public depositPrincipalTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
	}) => {
		const { tx, stakeCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"deposit_principal"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof stakeCoinId === "string"
					? tx.object(stakeCoinId)
					: stakeCoinId, // Coin
			],
		});
	};

	/**
	 * @deprecated use withdrawPrincipalTxV2 instead
	 * Creates a transaction to withdraw principal from a staked position (original version)
	 * @param inputs Withdrawal parameters including transaction, position ID, pool ID, amount, and coin type
	 * @returns Transaction object argument for the withdrawn Coin
	 */
	public withdrawPrincipalTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to withdraw principal from a staked position
	 * @param inputs Withdrawal parameters including transaction, position ID, pool ID, amount, and coin type
	 * @returns Transaction object argument for the withdrawn Coin
	 */
	public withdrawPrincipalTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		withdrawAmount: Balance;
		stakeCoinType: CoinType;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"withdraw_principal"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.withdrawAmount),
			],
		});
	};

	/**
	 * @deprecated use destroyStakedPositionTxV2 instead
	 * Creates a transaction to destroy a staked position (original version)
	 * @param inputs Destroy parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to destroy the position
	 */
	public destroyStakedPositionTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to destroy a staked position
	 * @param inputs Destroy parameters including transaction, position ID, and coin type
	 * @returns Transaction command to destroy the position
	 */
	public destroyStakedPositionTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"destroy"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(this.addresses.objects.version), // Version
			],
		});
	};

	/**
	 * @deprecated use updatePositionTxV2 instead
	 * Creates a transaction to update a staked position, recalculating rewards (original version)
	 * @param inputs Update parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to update the position
	 */
	public updatePositionTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to update a staked position, recalculating rewards
	 * @param inputs Update parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to update the position
	 */
	public updatePositionTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"update_position"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Locking Transaction Commands
	// =========================================================================

	/**
	 * @deprecated use lockTxV2 instead
	 * Creates a transaction to lock a staked position for a specific duration (original version)
	 * @param inputs Lock parameters including transaction, position ID, pool ID, lock duration, and coin type
	 * @returns Transaction command to lock the position
	 */
	public lockTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to lock a staked position for a specific duration
	 * @param inputs Lock parameters including transaction, position ID, pool ID, lock duration, and coin type
	 * @returns Transaction command to lock the position
	 */
	public lockTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		lockDurationMs: Timestamp;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"lock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.lockDurationMs),
			],
		});
	};

	/**
	 * @deprecated use renewLockTxV2 instead
	 * Creates a transaction to renew the lock on a staked position (original version)
	 * @param inputs Renew lock parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to renew the lock
	 */
	public renewLockTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to renew the lock on a staked position
	 * @param inputs Renew lock parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to renew the lock
	 */
	public renewLockTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"renew_lock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.object(this.addresses.objects.version), // Version
			],
		});
	};

	/**
	 * @deprecated use unlockTxV2 instead
	 * Creates a transaction to unlock a staked position (original version)
	 * @param inputs Unlock parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to unlock the position
	 */
	public unlockTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to unlock a staked position
	 * @param inputs Unlock parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction command to unlock the position
	 */
	public unlockTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"unlock"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Reward Harvesting Transaction Commands
	// =========================================================================

	/**
	 * @deprecated use beginHarvestTxV2 instead
	 * Creates a transaction to begin the reward harvesting process (original version)
	 * @param inputs Begin harvest parameters including transaction, pool ID, and coin type
	 * @returns Transaction object argument for the harvest metadata
	 */
	public beginHarvestTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to begin the reward harvesting process
	 * @param inputs Begin harvest parameters including transaction, position ID, pool ID, and coin type
	 * @returns Transaction object argument for the harvest cap
	 */
	public beginHarvestTxV2 = (inputs: {
		tx: Transaction;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (HarvestRewardsCap) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"begin_harvest_tx"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
			],
		});
	};

	/**
	 * @deprecated use harvestRewardsTxV2 instead
	 * Creates a transaction to harvest rewards from a staked position (original version)
	 * @param inputs Harvest parameters including transaction, position ID, pool ID, harvest metadata, stake coin type, and reward coin type
	 * @returns Transaction object argument for the harvested rewards
	 */
	public harvestRewardsTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to harvest rewards from a staked position
	 * @param inputs Harvest parameters including transaction, harvest cap, position ID, pool ID, stake coin type, and reward coin type
	 * @returns Transaction object argument for the harvested rewards
	 */
	public harvestRewardsTxV2 = (inputs: {
		tx: Transaction;
		harvestRewardsCap: ObjectId | TransactionArgument;
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) /* (Coin) */ => {
		const { tx, harvestRewardsCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"harvest_rewards"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				typeof harvestRewardsCap === "string"
					? tx.object(harvestRewardsCap)
					: harvestRewardsCap, // HarvestRewardsCap
				tx.object(inputs.stakedPositionId), // StakedPosition
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	/**
	 * @deprecated use endHarvestTxV2 instead
	 * Creates a transaction to end the reward harvesting process (original version)
	 * @param inputs End harvest parameters including transaction and harvest metadata
	 * @returns Transaction command to end the harvest
	 */
	public endHarvestTxV1 = (inputs: {
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

	/**
	 * Creates a transaction to end the reward harvesting process
	 * @param inputs End harvest parameters including transaction and harvest cap
	 * @returns Transaction command to end the harvest
	 */
	public endHarvestTxV2 = (inputs: {
		tx: Transaction;
		harvestRewardsCap: ObjectId | TransactionArgument;
	}) => {
		const { tx, harvestRewardsCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.stakedPosition,
				"end_harvest_tx"
			),
			typeArguments: [],
			arguments: [
				typeof harvestRewardsCap === "string"
					? tx.object(harvestRewardsCap)
					: harvestRewardsCap, // HarvestRewardsCap
				tx.object(this.addresses.objects.version), // Version
			],
		});
	};

	// =========================================================================
	//  Staking Pool Creation Transaction Commands
	// =========================================================================

	/**
	 * @deprecated use newStakingPoolTxV2 instead
	 * Creates a transaction for the deprecated version of staking pool creation
	 * @param inputs Pool creation parameters including transaction, lock enforcement, durations, multiplier, stake amount, and coin type
	 * @returns Transaction objects for the vault and owner cap
	 */
	public newStakingPoolTxV1 = (inputs: {
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
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * Creates a transaction for the current version of staking pool creation
	 * @param inputs Pool creation parameters including transaction, lock enforcements array, durations, multiplier, stake amount, and coin type
	 * @returns Transaction objects for the vault and authority cap
	 */
	public newStakingPoolTxV2 = (inputs: {
		tx: Transaction;
		lockEnforcements: FarmsLockEnforcement[];
		minLockDurationMs: Timestamp;
		maxLockDurationMs: Timestamp;
		maxLockMultiplier: FarmsMultiplier;
		minStakeAmount: Balance;
		stakeCoinType: CoinType;
	}) /* (AfterburnerVault, AuthorityCap) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"new"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(this.addresses.objects.version),
				tx.pure.vector(
					"u8",
					inputs.lockEnforcements.map((lockEnforcement) =>
						lockEnforcement === "Strict" ? 0 : 1
					)
				),
				tx.pure.u64(inputs.minLockDurationMs),
				tx.pure.u64(inputs.maxLockDurationMs),
				tx.pure.u64(inputs.maxLockMultiplier),
				tx.pure.u64(inputs.minStakeAmount),
			],
		});
	};

	/**
	 * @deprecated use shareStakingPoolTxV2 instead
	 * Creates a transaction to share a staking pool, making it public
	 * @param inputs Share pool parameters including transaction, pool ID, and coin type
	 * @returns Transaction command to share the pool
	 */
	public shareStakingPoolTxV1 = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
	}) => {
		const { tx, stakingPoolId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * Creates a transaction to share a staking pool, making it public
	 * @param inputs Share pool parameters including transaction, pool ID, and coin type
	 * @returns Transaction command to share the pool
	 */
	public shareStakingPoolTxV2 = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
	}) => {
		const { tx, stakingPoolId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"share"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				typeof stakingPoolId === "string"
					? tx.object(stakingPoolId)
					: stakingPoolId, // AfterburnerVault
			],
		});
	};

	/**
	 * @deprecated use transferOwnerCapTxV2 instead
	 * Creates a transaction to transfer ownership of a staking pool
	 * @param inputs Transfer parameters including transaction, owner cap ID, and recipient address
	 * @returns Transaction command to transfer the owner cap
	 */
	public transferOwnerCapTxV1 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId | TransactionArgument;
		recipientAddress: SuiAddress;
	}) => {
		const { tx, ownerCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * @deprecated use grantOneTimeAdminCapTxV2 instead
	 * Creates a transaction to grant a one-time admin capability for a staking pool (original version)
	 * @param inputs Grant parameters including transaction, owner cap ID, recipient address, and reward coin type
	 * @returns Transaction command to grant the one-time admin cap
	 */
	public grantOneTimeAdminCapTxV1 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId | TransactionArgument;
		recipientAddress: SuiAddress;
		rewardCoinType: CoinType;
	}) => {
		const { tx, ownerCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * Creates a transaction to grant a one-time admin capability for a staking pool
	 * @param inputs Grant parameters including transaction, owner cap ID, recipient address, and reward coin type
	 * @returns Transaction command to grant the one-time admin cap
	 */
	public grantOneTimeAdminCapTxV2 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId | TransactionArgument;
		recipientAddress: SuiAddress;
		rewardCoinType: CoinType;
	}) => {
		const { tx, ownerCapId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"grant_one_time_admin_cap"
			),
			typeArguments: [inputs.rewardCoinType],
			arguments: [
				typeof ownerCapId === "string"
					? tx.object(ownerCapId)
					: ownerCapId, // OwnerCap
				tx.object(this.addresses.objects.version), // Version
				tx.pure.address(inputs.recipientAddress),
			],
		});
	};

	// =========================================================================
	//  Staking Pool Mutation Transaction Commands
	// =========================================================================

	/**
	 * @deprecated use initializeStakingPoolRewardTxV2 instead
	 * Creates a transaction to initialize rewards for a staking pool (original version)
	 * @param inputs Initialize reward parameters including transaction, pool ID, reward coin ID, emission parameters, stake coin type, and reward coin type
	 * @returns Transaction command to initialize the reward
	 */
	public initializeStakingPoolRewardTxV1 = (
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
		const isOneTimeAdminCap = FarmsApi.isFarmOneTimeAdminCapId(inputs);
		const capId = FarmsApi.farmCapId(inputs);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
				isOneTimeAdminCap
					? "initialize_reward_and_consume_admin_cap"
					: "initialize_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(capId), // OwnerCap / OneTimeAdminCap
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

	/**
	 * Creates a transaction to initialize rewards for a staking pool
	 * @param inputs Initialize reward parameters including transaction, pool ID, reward coin ID, emission parameters, stake coin type, and reward coin type
	 * @returns Transaction command to initialize the reward
	 */
	public initializeStakingPoolRewardTxV2 = (
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
		const isOneTimeAdminCap = FarmsApi.isFarmOneTimeAdminCapId(inputs);
		const capId = FarmsApi.farmCapId(inputs);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				isOneTimeAdminCap
					? "initialize_reward_and_consume_admin_cap"
					: "initialize_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(capId), // OwnerCap / OneTimeAdminCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
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

	/**
	 * @deprecated use topUpStakingPoolRewardTxV2 instead
	 * Creates a transaction to add more rewards to a staking pool (original version)
	 * @param inputs Top up parameters including transaction, pool ID, reward coin ID, stake coin type, and reward coin type
	 * @returns Transaction command to add rewards
	 */
	public topUpStakingPoolRewardTxV1 = (
		inputs: {
			tx: Transaction;
			stakingPoolId: ObjectId;
			rewardCoinId: ObjectId | TransactionArgument;
			stakeCoinType: CoinType;
			rewardCoinType: CoinType;
		} & FarmOwnerOrOneTimeAdminCap
	) => {
		const { tx, rewardCoinId } = inputs;
		const isOneTimeAdminCap = FarmsApi.isFarmOneTimeAdminCapId(inputs);
		const capId = FarmsApi.farmCapId(inputs);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
				isOneTimeAdminCap
					? "add_reward_and_consume_admin_cap"
					: "add_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(capId), // OwnerCap / OneTimeAdminCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
			],
		});
	};

	/**
	 * Creates a transaction to add more rewards to a staking pool
	 * @param inputs Top up parameters including transaction, pool ID, reward coin ID, stake coin type, and reward coin type
	 * @returns Transaction command to add rewards
	 */
	public topUpStakingPoolRewardTxV2 = (
		inputs: {
			tx: Transaction;
			stakingPoolId: ObjectId;
			rewardCoinId: ObjectId | TransactionArgument;
			stakeCoinType: CoinType;
			rewardCoinType: CoinType;
		} & FarmOwnerOrOneTimeAdminCap
	) => {
		const { tx, rewardCoinId } = inputs;
		const isOneTimeAdminCap = FarmsApi.isFarmOneTimeAdminCapId(inputs);
		const capId = FarmsApi.farmCapId(inputs);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				isOneTimeAdminCap
					? "add_reward_and_consume_admin_cap"
					: "add_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(capId), // OwnerCap / OneTimeAdminCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
			],
		});
	};

	/**
	 * @deprecated use increaseStakingPoolRewardEmissionsTxV2 instead
	 * Creates a transaction to increase the emission rate for a staking pool reward (original version)
	 * @param inputs Increase emissions parameters including transaction, owner cap ID, pool ID, emission parameters, stake coin type, and reward coin type
	 * @returns Transaction command to update emissions
	 */
	public increaseStakingPoolRewardEmissionsTxV1 = (inputs: {
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
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * Creates a transaction to increase the emission rate for a staking pool reward
	 * @param inputs Increase emissions parameters including transaction, owner cap ID, pool ID, emission parameters, stake coin type, and reward coin type
	 * @returns Transaction command to update emissions
	 */
	public increaseStakingPoolRewardEmissionsTxV2 = (inputs: {
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
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"update_emission_schedule"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(inputs.emissionScheduleMs),
				tx.pure.u64(inputs.emissionRate),
			],
		});
	};

	/**
	 * @deprecated use setStakingPoolMinStakeAmountTxV2 instead
	 * Creates a transaction to set the minimum stake amount for a staking pool (original version)
	 * @param inputs Min stake amount parameters including transaction, owner cap ID, pool ID, minimum amount, and stake coin type
	 * @returns Transaction command to set the minimum stake amount
	 */
	public setStakingPoolMinStakeAmountTxV1 = (inputs: {
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
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * Creates a transaction to set the minimum stake amount for a staking pool
	 * @param inputs Min stake amount parameters including transaction, owner cap ID, pool ID, minimum amount, and stake coin type
	 * @returns Transaction command to set the minimum stake amount
	 */
	public setStakingPoolMinStakeAmountTxV2 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		minStakeAmount: bigint;
		stakeCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"set_min_stake_amount"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.pure.u64(inputs.minStakeAmount),
			],
		});
	};

	/**
	 * Creates a Move call (V1) to **remove undistributed reward coins** from a staking pool.
	 * Only callable by the pool **owner** (validated via `ownerCapId`). This does not claw back
	 * rewards already accrued/claimed by stakers—only reduces the remaining reward balance
	 * for the specified `rewardCoinType`.
	 *
	 * @param inputs Transaction assembly parameters
	 * @param inputs.tx Transaction instance to append the command to
	 * @param inputs.ownerCapId OwnerCap object ID authorizing the removal
	 * @param inputs.stakingPoolId The staking pool (vault) object ID
	 * @param inputs.rewardAmount Amount to remove (base units, encoded as u64)
	 * @param inputs.stakeCoinType Stake coin type argument for the vault module
	 * @param inputs.rewardCoinType Reward coin type to be removed
	 * @returns The transaction command added to `tx`
	 */
	public removeStakingPoolRewardTxV1 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		rewardAmount: Balance;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
				"remove_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.pure.u64(inputs.rewardAmount),
			],
		});
	};

	/**
	 * Creates a Move call (V2) to **remove undistributed reward coins** from a staking pool.
	 * Only callable by the pool **owner** (validated via `ownerCapId`). Includes the protocol
	 * `version` object as required by V2 modules.
	 *
	 * @param inputs Transaction assembly parameters
	 * @param inputs.tx Transaction instance to append the command to
	 * @param inputs.ownerCapId OwnerCap object ID authorizing the removal
	 * @param inputs.stakingPoolId The staking pool (vault) object ID
	 * @param inputs.rewardAmount Amount to remove (base units, encoded as u64)
	 * @param inputs.stakeCoinType Stake coin type argument for the vault module
	 * @param inputs.rewardCoinType Reward coin type to be removed
	 * @returns The transaction command added to `tx`
	 */
	public removeStakingPoolRewardTxV2 = (inputs: {
		tx: Transaction;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		rewardAmount: Balance;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaultsV2,
				FarmsApi.constants.moduleNames.vaultV2,
				"remove_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(this.addresses.objects.version), // Version
				tx.pure.u64(inputs.rewardAmount),
			],
		});
	};

	// =========================================================================
	//  Staking Pool Inspection Transaction Commands
	// =========================================================================

	/**
	 * Creates a transaction to check if a staking pool is unlocked
	 * @param inputs Check parameters including transaction, pool ID, and coin type
	 * @returns Transaction object argument for the boolean result
	 */
	public isVaultUnlockedTxV1 = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (bool) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
				"is_vault_unlocked"
			),
			typeArguments: [inputs.stakeCoinType],
			arguments: [
				tx.object(inputs.stakingPoolId), // AfterburnerVault
			],
		});
	};

	/**
	 * Creates a transaction to get the remaining rewards for a staking pool
	 * @param inputs Remaining rewards parameters including transaction, pool ID, and coin type
	 * @returns Transaction object argument for the vector of remaining rewards
	 */
	public remainingRewardsTxV1 = (inputs: {
		tx: Transaction;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
	}) /* (vector<u64>) */ => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vaultV1,
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

	/**
	 * @deprecated use fetchBuildStakeTxV2 instead
	 * Builds a complete transaction for staking coins
	 * @param inputs Staking parameters including wallet address, lock enforcement, stake amount, pool ID, lock duration, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildStakeTxV1 = async (inputs: ApiFarmsStakeBodyV1) => {
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

		const stakedPosition = this.stakeTxV1({
			...inputs,
			tx,
			stakeCoinId,
		});
		tx.transferObjects([stakedPosition], walletAddress);

		return tx;
	};

	/**
	 * Builds a complete transaction for staking coins
	 * @param inputs Staking parameters including wallet address, lock enforcement, stake amount, pool ID, lock duration, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildStakeTxV2 = async (inputs: ApiFarmsStakeBody) => {
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

		const stakedPosition = this.stakeTxV2({
			...inputs,
			tx,
			stakeCoinId,
			lockEnforcement: "Strict",
		});
		tx.transferObjects([stakedPosition], walletAddress);

		return tx;
	};

	/**
	 * @deprecated use fetchBuildDepositPrincipalTxV2 instead
	 * Builds a complete transaction for depositing additional principal to a staked position
	 * @param inputs Deposit parameters including wallet address, position ID, pool ID, deposit amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildDepositPrincipalTxV1 = async (
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

		this.depositPrincipalTxV1({
			...inputs,
			tx,
			stakeCoinId,
		});

		return tx;
	};

	/**
	 * Builds a complete transaction for depositing additional principal to a staked position
	 * @param inputs Deposit parameters including wallet address, position ID, pool ID, deposit amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildDepositPrincipalTxV2 = async (
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

		this.depositPrincipalTxV2({
			...inputs,
			tx,
			stakeCoinId,
		});

		return tx;
	};

	/**
	 * @deprecated use buildWithdrawPrincipalTxV2 instead
	 * Builds a complete transaction for withdrawing principal from a staked position
	 * @param inputs Withdraw parameters including wallet address, position ID, pool ID, withdraw amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildWithdrawPrincipalTxV1 = (inputs: {
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		withdrawAmount: Balance;
		stakeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const withdrawnCoin = this.withdrawPrincipalTxV1({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		return tx;
	};

	/**
	 * Builds a complete transaction for withdrawing principal from a staked position
	 * @param inputs Withdraw parameters including wallet address, position ID, pool ID, withdraw amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildWithdrawPrincipalTxV2 = (inputs: {
		stakedPositionId: ObjectId;
		stakingPoolId: ObjectId;
		withdrawAmount: Balance;
		stakeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const withdrawnCoin = this.withdrawPrincipalTxV2({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		return tx;
	};

	/**
	 * @deprecated use buildUnstakeTxV2 instead
	 * Builds a complete transaction for unstaking (withdrawing and destroying a position)
	 * @param inputs Unstake parameters including wallet address, position ID, pool ID, reward coin types, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUnstakeTxV1 = (inputs: ApiFarmsUnstakeBody) => {
		const { walletAddress } = inputs;

		let tx;
		if (inputs.rewardCoinTypes.length > 0) {
			// harvest rewards
			tx = this.buildHarvestRewardsTxV1({
				...inputs,
				stakedPositionIds: [inputs.stakedPositionId],
			});
		} else {
			// no rewards to harvest
			tx = new Transaction();
			tx.setSender(walletAddress);
		}

		// withdraw principal
		const withdrawnCoin = this.withdrawPrincipalTxV1({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		// destroy position
		this.destroyStakedPositionTxV1({
			tx,
			stakingPoolId: inputs.stakingPoolId,
			stakedPositionId: inputs.stakedPositionId,
			stakeCoinType: inputs.stakeCoinType,
		});

		return tx;
	};

	/**
	 * Builds a complete transaction for unstaking (withdrawing and destroying a position)
	 * @param inputs Unstake parameters including wallet address, position ID, pool ID, reward coin types, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUnstakeTxV2 = (inputs: ApiFarmsUnstakeBody) => {
		const { walletAddress } = inputs;

		let tx;
		if (inputs.rewardCoinTypes.length > 0) {
			// harvest rewards
			tx = this.buildHarvestRewardsTxV2({
				...inputs,
				stakedPositionIds: [inputs.stakedPositionId],
			});
		} else {
			// no rewards to harvest
			tx = new Transaction();
			tx.setSender(walletAddress);
		}

		// withdraw principal
		const withdrawnCoin = this.withdrawPrincipalTxV2({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], walletAddress);

		// destroy position
		this.destroyStakedPositionTxV2({
			tx,
			stakedPositionId: inputs.stakedPositionId,
			stakeCoinType: inputs.stakeCoinType,
		});

		return tx;
	};

	/**
	 * @deprecated use buildUpdatePositionTxV2 instead
	 * Builds a transaction for updating a staked position
	 * @param parameters for updatePositionTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUpdatePositionTxV1 = Helpers.transactions.createBuildTxFunc(
		this.updatePositionTxV1
	);

	/**
	 * Builds a transaction for updating a staked position
	 * @param parameters for updatePositionTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUpdatePositionTx2 = Helpers.transactions.createBuildTxFunc(
		this.updatePositionTxV2
	);

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	/**
	 * @deprecated use buildLockTxV2 instead
	 * Builds a transaction for locking a staked position
	 * @param parameters for lockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildLockTxV1 = Helpers.transactions.createBuildTxFunc(
		this.lockTxV1
	);

	/**
	 * Builds a transaction for locking a staked position
	 * @param parameters for lockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildLockTxV2 = Helpers.transactions.createBuildTxFunc(
		this.lockTxV2
	);

	/**
	 * @deprecated use buildRenewLockTxV2 instead
	 * Builds a transaction for renewing the lock on a staked position
	 * @param parameters for renewLockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildRenewLockTxV1 = Helpers.transactions.createBuildTxFunc(
		this.renewLockTxV1
	);

	/**
	 * Builds a transaction for renewing the lock on a staked position
	 * @param parameters for renewLockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildRenewLockTxV2 = Helpers.transactions.createBuildTxFunc(
		this.renewLockTxV2
	);

	/**
	 * @deprecated use buildUnlockTxV2 instead
	 * Builds a transaction for unlocking a staked position
	 * @param parameters for unlockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUnlockTxV1 = Helpers.transactions.createBuildTxFunc(
		this.unlockTxV1
	);

	/**
	 * Builds a transaction for unlocking a staked position
	 * @param parameters for unlockTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildUnlockTxV2 = Helpers.transactions.createBuildTxFunc(
		this.unlockTxV2
	);

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	/**
	 * @deprecated use buildHarvestRewardsTxV2 instead
	 * Builds a complete transaction for harvesting rewards from staked positions
	 * @param inputs Harvest parameters including wallet address, position IDs, pool ID, reward coin types, and optional claim as AfSui flag
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildHarvestRewardsTxV1 = (
		inputs: ApiHarvestFarmsRewardsBody & {
			tx?: Transaction;
		}
	): Transaction => {
		const { walletAddress, stakedPositionIds } = inputs;

		const tx = inputs.tx ?? new Transaction();
		tx.setSender(walletAddress);

		const harvestRewardsCap = this.beginHarvestTxV1({
			...inputs,
			tx,
		});

		let harvestedCoins: Record<CoinType, TransactionObjectArgument[]> = {};

		for (const stakedPositionId of stakedPositionIds) {
			for (const rewardCoinType of inputs.rewardCoinTypes) {
				const harvestedCoin = this.harvestRewardsTxV1({
					...inputs,
					tx,
					stakedPositionId,
					rewardCoinType,
					harvestedRewardsEventMetadataId: harvestRewardsCap,
				});

				if (rewardCoinType in harvestedCoins) {
					harvestedCoins[rewardCoinType].push(harvestedCoin);
				} else {
					harvestedCoins[rewardCoinType] = [harvestedCoin];
				}
			}
		}

		this.endHarvestTxV1({
			tx,
			harvestedRewardsEventMetadataId: harvestRewardsCap,
		});

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

	/**
	 * Builds a complete transaction for harvesting rewards from staked positions
	 * @param inputs Harvest parameters including wallet address, position IDs, pool ID, reward coin types, and optional claim as AfSui flag
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildHarvestRewardsTxV2 = (
		inputs: ApiHarvestFarmsRewardsBody & {
			tx?: Transaction;
		}
	): Transaction => {
		const { walletAddress, stakedPositionIds } = inputs;

		const tx = inputs.tx ?? new Transaction();
		tx.setSender(walletAddress);

		// For the first position, begin harvest
		const firstPositionId = stakedPositionIds[0];
		const harvestRewardsCap = this.beginHarvestTxV2({
			...inputs,
			tx,
			stakedPositionId: firstPositionId,
		});

		let harvestedCoins: Record<CoinType, TransactionObjectArgument[]> = {};

		for (const stakedPositionId of stakedPositionIds) {
			for (const rewardCoinType of inputs.rewardCoinTypes) {
				const harvestedCoin = this.harvestRewardsTxV2({
					...inputs,
					tx,
					stakedPositionId,
					harvestRewardsCap,
					rewardCoinType,
				});

				if (rewardCoinType in harvestedCoins) {
					harvestedCoins[rewardCoinType].push(harvestedCoin);
				} else {
					harvestedCoins[rewardCoinType] = [harvestedCoin];
				}
			}
		}

		this.endHarvestTxV2({ tx, harvestRewardsCap });

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

	/**
	 * @deprecated use buildCreateStakingPoolTxV2 instead
	 * Builds a complete transaction for creating a new staking pool
	 * @param inputs Pool creation parameters including wallet address, lock enforcements, durations, multiplier, stake amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildCreateStakingPoolTxV1 = (
		inputs: ApiFarmsCreateStakingPoolBodyV1
	): Transaction => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const [stakingPoolId, ownerCapId] = this.newStakingPoolTxV1({
			...inputs,
			tx,
			lockEnforcement: "Strict",
		});
		this.shareStakingPoolTxV1({
			tx,
			stakingPoolId,
			stakeCoinType: inputs.stakeCoinType,
		});
		this.transferOwnerCapTxV1({
			tx,
			ownerCapId,
			recipientAddress: walletAddress,
		});

		return tx;
	};

	/**
	 * Builds a complete transaction for creating a new staking pool
	 * @param inputs Pool creation parameters including wallet address, lock enforcements, durations, multiplier, stake amount, and coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildCreateStakingPoolTxV2 = (
		inputs: ApiFarmsCreateStakingPoolBody
	): Transaction => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		const [stakingPoolId, ownerCapId] = this.newStakingPoolTxV2({
			...inputs,
			tx,
			lockEnforcements: ["Strict"],
		});
		this.shareStakingPoolTxV2({
			tx,
			stakingPoolId,
			stakeCoinType: inputs.stakeCoinType,
		});
		tx.transferObjects([ownerCapId], walletAddress);

		return tx;
	};

	// =========================================================================
	//  Staking Pool Mutation Transactions
	// =========================================================================

	/**
	 * @deprecated use fetchBuildInitializeStakingPoolRewardTxV2 instead
	 * Builds a complete transaction for initializing rewards for a staking pool
	 * @param inputs Initialize rewards parameters including wallet address, owner cap ID, pool ID, reward amount, emission parameters, stake coin type, and reward coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildInitializeStakingPoolRewardTxV1 = async (
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

		this.initializeStakingPoolRewardTxV1({ ...inputs, tx, rewardCoinId });

		return tx;
	};

	/**
	 * Builds a complete transaction for initializing rewards for a staking pool
	 * @param inputs Initialize rewards parameters including wallet address, owner cap ID, pool ID, reward amount, emission parameters, stake coin type, and reward coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildInitializeStakingPoolRewardTxV2 = async (
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

		this.initializeStakingPoolRewardTxV2({ ...inputs, tx, rewardCoinId });

		return tx;
	};

	/**
	 * @deprecated use fetchBuildTopUpStakingPoolRewardsTxV2 instead
	 * Builds a complete transaction for adding more rewards to a staking pool
	 * @param inputs Top up rewards parameters including wallet address, owner cap ID, pool ID, rewards array with amounts and coin types, and stake coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildTopUpStakingPoolRewardsTxV1 = async (
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

			this.topUpStakingPoolRewardTxV1({
				...inputs,
				...reward,
				tx,
				rewardCoinId,
			});
		}

		return tx;
	};

	/**
	 * Builds a complete transaction for adding more rewards to a staking pool
	 * @param inputs Top up rewards parameters including wallet address, owner cap ID, pool ID, rewards array with amounts and coin types, and stake coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public fetchBuildTopUpStakingPoolRewardsTxV2 = async (
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

			this.topUpStakingPoolRewardTxV2({
				...inputs,
				...reward,
				tx,
				rewardCoinId,
			});
		}

		return tx;
	};

	/**
	 * @deprecated use buildIncreaseStakingPoolRewardsEmissionsTxV2 instead
	 * Builds a complete transaction for increasing the emission rate of rewards for a staking pool
	 * @param inputs Increase emissions parameters including wallet address, owner cap ID, pool ID, rewards array with emission parameters and coin types, and stake coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildIncreaseStakingPoolRewardsEmissionsTxV1 = (
		inputs: ApiFarmsIncreaseStakingPoolRewardsEmissionsBody
	) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			this.increaseStakingPoolRewardEmissionsTxV1({
				...inputs,
				...reward,
				tx,
			});
		}

		return tx;
	};

	/**
	 * Builds a complete transaction for increasing the emission rate of rewards for a staking pool
	 * @param inputs Increase emissions parameters including wallet address, owner cap ID, pool ID, rewards array with emission parameters and coin types, and stake coin type
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildIncreaseStakingPoolRewardsEmissionsTxV2 = (
		inputs: ApiFarmsIncreaseStakingPoolRewardsEmissionsBody
	) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			this.increaseStakingPoolRewardEmissionsTxV2({
				...inputs,
				...reward,
				tx,
			});
		}

		return tx;
	};

	/**
	 * @deprecated use buildSetStakingPoolMinStakeAmountTxV2 instead
	 * Builds a transaction for setting the minimum stake amount for a staking pool
	 * @param parameters for setStakingPoolMinStakeAmountTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildSetStakingPoolMinStakeAmountTxV1 =
		Helpers.transactions.createBuildTxFunc(
			this.setStakingPoolMinStakeAmountTxV1
		);

	/**
	 * Builds a transaction for setting the minimum stake amount for a staking pool
	 * @param parameters for setStakingPoolMinStakeAmountTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildSetStakingPoolMinStakeAmountTxV2 =
		Helpers.transactions.createBuildTxFunc(
			this.setStakingPoolMinStakeAmountTxV2
		);

	/**
	 * Builds a transaction for **removing undistributed reward coins** from a staking pool (V1).
	 * Requires the pool **OwnerCap**. The removal is specific to a `rewardCoinType`.
	 *
	 * @param parameters Inputs accepted by `removeStakingPoolRewardTxV1`
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildRemoveStakingPoolRewardTxV1 = (inputs: {
		rewards: {
			rewardCoinType: CoinType;
			rewardAmount: Balance;
		}[];
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			this.removeStakingPoolRewardTxV1({
				...inputs,
				...reward,
				tx,
			});
		}

		return tx;
	};

	/**
	 * Builds a transaction for **removing undistributed reward coins** from a staking pool (V2).
	 * Requires the pool **OwnerCap** and includes the on-chain **version object**.
	 *
	 * @param parameters Inputs accepted by `removeStakingPoolRewardTxV2`
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildRemoveStakingPoolRewardTxV2 = (inputs: {
		rewards: {
			rewardCoinType: CoinType;
			rewardAmount: Balance;
		}[];
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		stakeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { walletAddress } = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		for (const reward of inputs.rewards) {
			this.removeStakingPoolRewardTxV2({
				...inputs,
				...reward,
				tx,
			});
		}

		return tx;
	};

	/**
	 * @deprecated use buildGrantOneTimeAdminCapTxV2 instead
	 * Builds a transaction for granting a one-time admin capability for a staking pool
	 * @param parameters for grantOneTimeAdminCapTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildGrantOneTimeAdminCapTxV1 =
		Helpers.transactions.createBuildTxFunc(this.grantOneTimeAdminCapTxV1);

	/**
	 * Builds a transaction for granting a one-time admin capability for a staking pool
	 * @param parameters for grantOneTimeAdminCapTx
	 * @returns Complete transaction ready for signing and execution
	 */
	public buildGrantOneTimeAdminCapTxV2 =
		Helpers.transactions.createBuildTxFunc(this.grantOneTimeAdminCapTxV2);

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	// =========================================================================
	//  Vault Creation
	// =========================================================================

	private eventWrapperType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			"Event"
		);

	/**
	 * Creates the event type for vault creation events
	 * @returns Fully qualified event type string
	 */
	private createdVaultEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.createdVault,
			version === 1 ? undefined : this.eventWrapperType()
		);

	// =========================================================================
	//  Vault Mutation
	// =========================================================================

	/**
	 * Creates the event type for reward initialization events
	 * @returns Fully qualified event type string
	 */
	private initializedRewardEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.initializedReward,
			version === 1 ? undefined : this.eventWrapperType()
		);

	/**
	 * Creates the event type for reward addition events
	 * @returns Fully qualified event type string
	 */
	private addedRewardEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.addedReward,
			version === 1 ? undefined : this.eventWrapperType()
		);

	/**
	 * Creates the event type for emission increase events
	 * @returns Fully qualified event type string
	 */
	private increasedEmissionsEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.increasedEmissions
		);

	/**
	 * Creates the event type for emission update events
	 * @returns Fully qualified event type string
	 */
	private updatedEmissionsEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.increasedEmissions,
			this.eventWrapperType()
		);

	// =========================================================================
	//  Staking Position Creation
	// =========================================================================

	/**
	 * Creates the event type for strict staking events
	 * @returns Fully qualified event type string
	 */
	private stakedEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.staked,
			version === 1 ? undefined : this.eventWrapperType()
		);

	/**
	 * Creates the event type for relaxed staking events
	 * @returns Fully qualified event type string
	 */
	private stakedRelaxedEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.stakedRelaxed,
			version === 1 ? undefined : this.eventWrapperType()
		);

	// =========================================================================
	//  Staking Position Locking
	// =========================================================================

	/**
	 * Creates the event type for position locking events
	 * @returns Fully qualified event type string
	 */
	private lockedEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.locked,
			version === 1 ? undefined : this.eventWrapperType()
		);

	/**
	 * Creates the event type for position unlocking events
	 * @returns Fully qualified event type string
	 */
	private unlockedEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.unlocked,
			version === 1 ? undefined : this.eventWrapperType()
		);

	// =========================================================================
	//  Staking Position Staking
	// =========================================================================

	/**
	 * Creates the event type for principal deposit events
	 * @returns Fully qualified event type string
	 */
	private depositedPrincipalEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.depositedPrincipal,
			version === 1 ? undefined : this.eventWrapperType()
		);

	/**
	 * Creates the event type for principal withdrawal events
	 * @returns Fully qualified event type string
	 */
	private withdrewPrincipalEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.withdrewPrincipal,
			version === 1 ? undefined : this.eventWrapperType()
		);

	// =========================================================================
	//  Staking Position Reward Harvesting
	// =========================================================================

	/**
	 * Creates the event type for reward harvesting events
	 * @returns Fully qualified event type string
	 */
	private harvestedRewardsEventType = (version: FarmsVersion) =>
		EventsApiHelpers.createEventType(
			version === 1
				? this.addresses.packages.vaultsInitial
				: this.addresses.packages.eventsV2,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.harvestedRewards,
			version === 1 ? undefined : this.eventWrapperType()
		);

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Checks if the input contains a one-time admin cap ID
	 * @param inputs FarmOwnerOrOneTimeAdminCap object
	 * @returns True if the input contains a one-time admin cap ID
	 */
	private static isFarmOneTimeAdminCapId = (
		inputs: FarmOwnerOrOneTimeAdminCap
	) => "oneTimeAdminCapId" in inputs;

	/**
	 * Gets the appropriate cap ID from the input
	 * @param inputs FarmOwnerOrOneTimeAdminCap object
	 * @returns Either the owner cap ID or one-time admin cap ID
	 */
	private static farmCapId = (inputs: FarmOwnerOrOneTimeAdminCap) =>
		"ownerCapId" in inputs ? inputs.ownerCapId : inputs.oneTimeAdminCapId;
}

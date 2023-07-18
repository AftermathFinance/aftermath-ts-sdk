import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	FarmsAddresses,
	EventsInputs,
	AddedRewardEvent,
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
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AddedRewardEventOnChain } from "./farmsApiCastingTypes";
import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Sui } from "../../sui";

export class FarmsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			vault: "vault",
			stakedPosition: "staked_position",
			vaultRegistry: "vault_registry",
			events: "events",
		},

		eventNames: {
			addedReward: "AddedRewardEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: FarmsAddresses;

	public readonly eventTypes: {
		addedReward: AnyObjectType;
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

		this.eventTypes = {
			addedReward: this.addedRewardEventType(),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchAddedRewardEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			AddedRewardEventOnChain,
			AddedRewardEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.addedReward,
			},
			eventFromEventOnChain: Casting.farms.addedRewardEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	// =========================================================================
	//  Staking Transaction Commands
	// =========================================================================

	public stakeTx = (inputs: {
		tx: TransactionBlock;
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
				tx.pure(inputs.lockDurationMs, "u64"),
			],
		});
	};

	public depositPrincipalTx = (inputs: {
		tx: TransactionBlock;
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
		tx: TransactionBlock;
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
				tx.pure(inputs.withdrawAmount, "u64"),
			],
		});
	};

	public destroyStakedPositionTx = (inputs: {
		tx: TransactionBlock;
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

	// =========================================================================
	//  Locking Transaction Commands
	// =========================================================================

	public lockTx = (inputs: {
		tx: TransactionBlock;
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
				tx.pure(inputs.lockDurationMs, "U64"),
			],
		});
	};

	public renewLockTx = (inputs: {
		tx: TransactionBlock;
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
		tx: TransactionBlock;
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
		tx: TransactionBlock;
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
		tx: TransactionBlock;
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
		tx: TransactionBlock;
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
		tx: TransactionBlock;
		lockEnforcement: FarmsLockEnforcement;
		minLockDurationMs: Timestamp;
		maxLockDurationMs: Timestamp;
		minLockMultiplier: FarmsMultiplier;
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
				tx.object(this.addresses.objects.vaultsRegistry), // VaultRegistry
				tx.pure(inputs.lockEnforcement === "Strict" ? 0 : 1, "u64"),
				tx.pure(inputs.minLockDurationMs, "u64"),
				tx.pure(inputs.maxLockDurationMs, "u64"),
				tx.pure(inputs.minLockMultiplier, "u64"),
				tx.pure(inputs.minStakeAmount, "u64"),
			],
		});
	};

	public shareStakingPoolTx = (inputs: {
		tx: TransactionBlock;
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
		tx: TransactionBlock;
		ownerCapId: ObjectId | TransactionArgument;
		recipient: SuiAddress;
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
				tx.pure(inputs.recipient, "address"),
			],
		});
	};

	// =========================================================================
	//  Staking Pool Mutation Transaction Commands
	// =========================================================================

	public initializeStakingPoolRewardTx = (inputs: {
		tx: TransactionBlock;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		rewardCoinId: ObjectId | TransactionArgument;
		emissionScheduleMs: Timestamp;
		emissionRate: bigint;
		emissionDelayTimestampMs: Timestamp;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) => {
		const { tx, rewardCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"initialize_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
				tx.pure(inputs.emissionScheduleMs, "u64"),
				tx.pure(inputs.emissionRate, "u64"),
				tx.pure(inputs.emissionDelayTimestampMs, "u64"),
			],
		});
	};

	public topUpStakingPoolRewardTx = (inputs: {
		tx: TransactionBlock;
		ownerCapId: ObjectId;
		stakingPoolId: ObjectId;
		rewardCoinId: ObjectId | TransactionArgument;
		stakeCoinType: CoinType;
		rewardCoinType: CoinType;
	}) => {
		const { tx, rewardCoinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.vaults,
				FarmsApi.constants.moduleNames.vault,
				"add_reward"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				typeof rewardCoinId === "string"
					? tx.object(rewardCoinId)
					: rewardCoinId, // Coin
			],
		});
	};

	public increaseStakingPoolEmissionsTx = (inputs: {
		tx: TransactionBlock;
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
				"increase_emissions_for"
			),
			typeArguments: [inputs.stakeCoinType, inputs.rewardCoinType],
			arguments: [
				tx.object(inputs.ownerCapId), // OwnerCap
				tx.object(inputs.stakingPoolId), // AfterburnerVault
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure(inputs.emissionScheduleMs, "u64"),
				tx.pure(inputs.emissionRate, "u64"),
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
		const { walletAddress } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const stakeCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.stakeCoinType,
			coinAmount: inputs.stakeAmount,
		});

		const stakedPosition = this.stakeTx({ ...inputs, tx, stakeCoinId });
		tx.transferObjects([stakedPosition], tx.pure(walletAddress));

		return tx;
	};

	public fetchBuildDepositPrincipalTx = async (
		inputs: ApiFarmsDepositPrincipalBody
	) => {
		const { walletAddress } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const stakeCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: inputs.stakeCoinType,
			coinAmount: inputs.depositAmount,
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

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const withdrawnCoin = this.withdrawPrincipalTx({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], tx.pure(walletAddress));

		return tx;
	};

	public fetchBuildUnstakeTx = async (inputs: ApiFarmsUnstakeBody) => {
		const { walletAddress } = inputs;

		// harvest rewards
		const tx = await this.fetchBuildHarvestRewardsTx({
			...inputs,
			stakedPositionIds: [inputs.stakedPositionId],
		});

		// withdraw principal
		const withdrawnCoin = this.withdrawPrincipalTx({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], tx.pure(walletAddress));

		// destroy position
		this.destroyStakedPositionTx({ ...inputs, tx });

		return tx;
	};

	// =========================================================================
	//  Locking Transactions
	// =========================================================================

	public fetchLockTx = Helpers.transactions.creatBuildTxFunc(this.lockTx);

	public fetchRenewLockTx = Helpers.transactions.creatBuildTxFunc(
		this.renewLockTx
	);

	public fetchUnlockTx = Helpers.transactions.creatBuildTxFunc(this.unlockTx);

	// =========================================================================
	//  Reward Harvesting Transactions
	// =========================================================================

	public fetchBuildHarvestRewardsTx = async (
		inputs: ApiHarvestFarmsRewardsBody
	): Promise<TransactionBlock> => {
		const { walletAddress, stakedPositionIds } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const harvestedRewardsEventMetadataId = this.beginHarvestTx({
			...inputs,
			tx,
		});

		let harvestedCoins = [];
		for (const [index, stakedPositionId] of stakedPositionIds.entries()) {
			for (const rewardCoinType of inputs.rewardCoinTypes[index]) {
				const harvestedCoin = this.harvestRewardsTx({
					...inputs,
					tx,
					stakedPositionId,
					harvestedRewardsEventMetadataId,
					rewardCoinType,
				});
				harvestedCoins.push(harvestedCoin);
			}
		}

		// TODO: move this merging & transferring behaviour to coins api helpers ?
		const coinToTransfer = harvestedCoins[0];

		if (harvestedCoins.length > 1)
			tx.mergeCoins(coinToTransfer, harvestedCoins.slice(1));

		tx.transferObjects([coinToTransfer], tx.pure(walletAddress));

		this.endHarvestTx({ tx, harvestedRewardsEventMetadataId });

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
	): Promise<TransactionBlock> => {
		const { walletAddress } = inputs;

		const tx = new TransactionBlock();
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
			recipient: walletAddress,
		});

		return tx;
	};

	// =========================================================================
	//  Staking Pool Mutation Transactions
	// =========================================================================

	public fetchInitializeStakingPoolRewardTx =
		Helpers.transactions.creatBuildTxFunc(
			this.initializeStakingPoolRewardTx
		);

	public fetchTopUpStakingPoolRewardTx =
		Helpers.transactions.creatBuildTxFunc(this.topUpStakingPoolRewardTx);

	public fetchIncreaseStakingPoolEmissionsTx =
		Helpers.transactions.creatBuildTxFunc(
			this.increaseStakingPoolEmissionsTx
		);

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private addedRewardEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaults,
			FarmsApi.constants.moduleNames.events,
			FarmsApi.constants.eventNames.addedReward
		);
}

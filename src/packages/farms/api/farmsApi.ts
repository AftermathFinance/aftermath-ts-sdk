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
	ApiFarmsWithdrawPrincipalBody,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AddedRewardEventOnChain } from "./farmsApiCastingTypes";
import {
	ObjectId,
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
		stakeCoinType: AnyObjectType;
		rewardCoinType: AnyObjectType;
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
		tx.transferObjects([stakedPosition], tx.pure(inputs.walletAddress));

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

	public fetchBuildWithdrawPrincipalTx = async (
		inputs: ApiFarmsWithdrawPrincipalBody
	) => {
		const { walletAddress } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const withdrawnCoin = this.withdrawPrincipalTx({
			...inputs,
			tx,
		});
		tx.transferObjects([withdrawnCoin], tx.pure(inputs.walletAddress));

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
		const { stakedPositionIds } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const harvestedRewardsEventMetadataId = this.beginHarvestTx({
			...inputs,
			tx,
		});

		let harvestedCoins = [];
		for (const [index, stakedPositionId] of stakedPositionIds.entries()) {
			const harvestedCoin = this.harvestRewardsTx({
				...inputs,
				tx,
				stakedPositionId,
				harvestedRewardsEventMetadataId,
				rewardCoinType: inputs.rewardCoinTypes[index],
			});
			harvestedCoins.push(harvestedCoin);
		}

		// TODO: move this merging & transferring behaviour to coins api helpers ?
		const coinToTransfer = harvestedCoins[0];

		if (harvestedCoins.length > 1)
			tx.mergeCoins(coinToTransfer, harvestedCoins.slice(1));

		tx.transferObjects([coinToTransfer], tx.pure(inputs.walletAddress));

		this.endHarvestTx({ tx, harvestedRewardsEventMetadataId });

		return tx;
	};

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

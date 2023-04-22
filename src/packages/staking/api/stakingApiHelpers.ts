import {
	ObjectId,
	TransactionBlock,
	SuiAddress,
	TransactionArgument,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { AnyObjectType, Balance, StakingAddresses } from "../../../types";
import { Coin } from "../../coin/coin";

export class StakingApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		modules: {
			interface: "interface",
		},
		eventNames: {
			stake: "StakeWasRequestedEvent",
			unstake: "WithdrawWasRequestedEvent",
			failedStake: "StakeWasFailedSUIReturnedEvent",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: StakingAddresses;
	public readonly eventTypes: {
		stake: AnyObjectType;
		unstake: AnyObjectType;
		failedStake: AnyObjectType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.staking;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;

		this.eventTypes = {
			stake: this.stakeEventType(),
			unstake: this.unstakeEventType(),
			failedStake: this.failedStakeEventType(),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	public addStakeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		suiCoin: ObjectId | TransactionArgument;
		validatorAddress: SuiAddress;
	}) => {
		const { tx, suiCoin } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.liquidStakingDerivative,
				StakingApiHelpers.constants.modules.interface,
				"request_add_stake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.staking),
				typeof suiCoin === "string" ? tx.object(suiCoin) : suiCoin,
				tx.pure(inputs.validatorAddress, "address"),
			],
		});
	};

	public addUnstakeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		afSuiCoin: ObjectId | TransactionArgument;
	}) => {
		const { tx, afSuiCoin } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.liquidStakingDerivative,
				StakingApiHelpers.constants.modules.interface,
				"request_unstake"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.staking),
				typeof afSuiCoin === "string"
					? tx.object(afSuiCoin)
					: afSuiCoin,
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildStakeTransaction = async (inputs: {
		walletAddress: SuiAddress;
		suiStakeAmount: Balance;
		validatorAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { coinArgument: suiCoin, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				Coin.constants.suiCoinType,
				inputs.suiStakeAmount
			);

		this.addStakeCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			suiCoin,
		});

		return tx;
	};

	public fetchBuildUnstakeTransaction = async (inputs: {
		walletAddress: SuiAddress;
		afSuiUnstakeAmount: Balance;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { coinArgument: afSuiCoin, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				Coin.constants.suiCoinType,
				inputs.afSuiUnstakeAmount
			);

		this.addUnstakeCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			afSuiCoin,
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private stakeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface,
			StakingApiHelpers.constants.eventNames.stake
		);

	private unstakeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface,
			StakingApiHelpers.constants.eventNames.unstake
		);

	private failedStakeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface,
			StakingApiHelpers.constants.eventNames.failedStake
		);
}

import { ObjectId, TransactionBlock, SuiAddress } from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	GasBudget,
	StakingAddresses,
} from "../../../types";
import { Coin } from "../../coin/coin";
import { Sui } from "../../sui/sui";

export class StakingApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		modules: {
			interface: {
				moduleName: "interface",
				functions: {
					requestAddDelegation: {
						name: "request_add_delegation",
						defaultGasBudget: 2000,
					},
					requestWithdrawDelegation: {
						name: "request_withdraw_delegation",
						defaultGasBudget: 2000,
					},
					cancelDelegationRequest: {
						name: "cancel_delegation_request",
						defaultGasBudget: 2000,
					},
				},
			},
		},
		eventNames: {
			requestAddDelegation: "RequestAddDelegationEvent",
			requestWithdrawDelegation: "RequestWithdrawDelegationEvent",
			cancelDelegationRequest: "CancelDelegationRequestEvent",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: StakingAddresses;
	public readonly eventTypes: {
		requestAddDelegation: AnyObjectType;
		requestWithdrawDelegation: AnyObjectType;
		cancelDelegationRequest: AnyObjectType;
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
			requestAddDelegation: this.stakeRequestAddDelegationEventType(),
			requestWithdrawDelegation:
				this.stakeRequestWithdrawDelegationEventType(),
			cancelDelegationRequest:
				this.stakeCancelDelegationRequestEventType(),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	public addRequestAddDelegationCommandToTransaction = (
		tx: TransactionBlock,
		coinId: ObjectId,
		validator: SuiAddress,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.requestAddDelegation.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.liquidStakingDerivative,
				StakingApiHelpers.constants.modules.interface.moduleName,
				StakingApiHelpers.constants.modules.interface.functions
					.requestAddDelegation.name
			),
			typeArguments: [],
			arguments: [
				tx.object(Sui.constants.addresses.suiSystemStateId),
				tx.object(
					this.Provider.Faucet().Helpers.addresses.objects.faucet
				),
				tx.object(coinId),
				tx.object(validator),
			],
			// gasBudget: gasBudget,
		});
		return tx;
	};

	public addRequestWithdrawDelegationCommandToTransaction = (
		tx: TransactionBlock,
		stakedSui: ObjectId,
		delegation: ObjectId,
		afSui: ObjectId,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.requestWithdrawDelegation.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.liquidStakingDerivative,
				StakingApiHelpers.constants.modules.interface.moduleName,
				StakingApiHelpers.constants.modules.interface.functions
					.requestWithdrawDelegation.name
			),
			typeArguments: [],
			arguments: [
				tx.object(Sui.constants.addresses.suiSystemStateId),
				tx.object(
					this.Provider.Faucet().Helpers.addresses.objects.faucet
				),
				tx.object(delegation),
				tx.object(stakedSui),
				tx.object(afSui),
			],
			// gasBudget: gasBudget,
		});
		return tx;
	};

	public addCancelDelegationRequestCommandToTransaction = (
		tx: TransactionBlock,
		stakedSui: ObjectId,
		afSui: ObjectId,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.cancelDelegationRequest.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.liquidStakingDerivative,
				StakingApiHelpers.constants.modules.interface.moduleName,
				StakingApiHelpers.constants.modules.interface.functions
					.cancelDelegationRequest.name
			),
			typeArguments: [],
			arguments: [
				tx.object(Sui.constants.addresses.suiSystemStateId),
				tx.object(
					this.Provider.Faucet().Helpers.addresses.objects.faucet
				),
				tx.object(stakedSui),
				tx.object(afSui),
			],
			// gasBudget: gasBudget,
		});
		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildRequestAddDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		validator: SuiAddress
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		const { coinWithAmountObjectId, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				Coin.constants.suiCoinType,
				amount
			);

		return this.addRequestAddDelegationCommandToTransaction(
			txWithCoinWithAmount,
			coinWithAmountObjectId,
			validator
		);
	};

	public fetchBuildCancelOrRequestWithdrawDelegationTransaction = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId,
		delegation?: ObjectId
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		const { coinWithAmountObjectId, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				this.Provider.Faucet().Helpers.coinTypes.afSui,
				amount
			);

		if (delegation === undefined)
			return this.addCancelDelegationRequestCommandToTransaction(
				txWithCoinWithAmount,
				stakedSui,
				coinWithAmountObjectId
			);

		return this.addRequestWithdrawDelegationCommandToTransaction(
			txWithCoinWithAmount,
			stakedSui,
			delegation,
			coinWithAmountObjectId
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private stakeRequestAddDelegationEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface.moduleName,
			StakingApiHelpers.constants.eventNames.requestAddDelegation
		);

	private stakeRequestWithdrawDelegationEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface.moduleName,
			StakingApiHelpers.constants.eventNames.requestWithdrawDelegation
		);

	private stakeCancelDelegationRequestEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.liquidStakingDerivative,
			StakingApiHelpers.constants.modules.interface.moduleName,
			StakingApiHelpers.constants.eventNames.cancelDelegationRequest
		);
}

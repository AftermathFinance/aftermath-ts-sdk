import { ObjectId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
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

	constructor(protected readonly Provider: AftermathApi) {
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
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	protected stakeRequestAddDelegationTransaction = (
		coinId: ObjectId,
		validator: SuiAddress,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.requestAddDelegation.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId:
					this.addresses.packages.liquidStakingDerivative,
				module: StakingApiHelpers.constants.modules.interface
					.moduleName,
				function:
					StakingApiHelpers.constants.modules.interface.functions
						.requestAddDelegation.name,
				typeArguments: [],
				arguments: [
					Sui.constants.addresses.suiSystemStateId,
					this.Provider.Faucet().addresses.objects.faucet,
					coinId,
					validator,
				],
				gasBudget: gasBudget,
			},
		};
	};

	protected stakeRequestWithdrawDelegationTransaction = (
		stakedSui: ObjectId,
		delegation: ObjectId,
		afSui: ObjectId,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.requestWithdrawDelegation.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId:
					this.addresses.packages.liquidStakingDerivative,
				module: StakingApiHelpers.constants.modules.interface
					.moduleName,
				function:
					StakingApiHelpers.constants.modules.interface.functions
						.requestWithdrawDelegation.name,
				typeArguments: [],
				arguments: [
					Sui.constants.addresses.suiSystemStateId,
					this.Provider.Faucet().addresses.objects.faucet,
					delegation,
					stakedSui,
					afSui,
				],
				gasBudget: gasBudget,
			},
		};
	};

	protected stakeCancelDelegationRequestTransaction = (
		stakedSui: ObjectId,
		afSui: ObjectId,
		gasBudget: GasBudget = StakingApiHelpers.constants.modules.interface
			.functions.cancelDelegationRequest.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId:
					this.addresses.packages.liquidStakingDerivative,
				module: StakingApiHelpers.constants.modules.interface
					.moduleName,
				function:
					StakingApiHelpers.constants.modules.interface.functions
						.cancelDelegationRequest.name,
				typeArguments: [],
				arguments: [
					Sui.constants.addresses.suiSystemStateId,
					this.Provider.Faucet().addresses.objects.faucet,
					stakedSui,
					afSui,
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	protected fetchCancelOrRequestWithdrawDelegationTransactions = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId,
		delegation?: ObjectId
	) =>
		// i. Build the `cancel_delegation_request` or `request_withdraw_delegation` transactions.
		this.fetchBuildCancelOrRequestWithdrawDelegationTransactions(
			walletAddress,
			amount,
			stakedSui,
			delegation
		);

	protected fetchBuildRequestAddDelegationTransactions = async (
		walletAddress: SuiAddress,
		amount: Balance,
		validator: SuiAddress
	): Promise<SignableTransaction[]> => {
		let transactions: SignableTransaction[] = [];

		// i. create a coin of type `coinType` with value `coinAmount`.
		const { coinObjectId: coinId, joinAndSplitTransactions } =
			await this.Provider.Coin.fetchCoinJoinAndSplitWithExactAmountTransactions(
				walletAddress,
				Coin.constants.suiCoinType,
				amount
			);
		transactions.push(...joinAndSplitTransactions);

		// ii. delegate `coinId` to `validator`.
		transactions.push(
			this.stakeRequestAddDelegationTransaction(coinId, validator)
		);

		return transactions;
	};

	//**************************************************************************************************
	// Undelegate Coin
	//**************************************************************************************************

	protected fetchBuildCancelOrRequestWithdrawDelegationTransactions = async (
		walletAddress: SuiAddress,
		amount: Balance,
		stakedSui: ObjectId,
		delegation?: ObjectId
	): Promise<SignableTransaction[]> => {
		let transactions: SignableTransaction[] = [];

		// i. create a coin of type `coinType` with value `amount`.
		const { coinObjectId: coinId, joinAndSplitTransactions } =
			await this.Provider.Coin.fetchCoinJoinAndSplitWithExactAmountTransactions(
				walletAddress,
				this.Provider.Faucet().coinTypes.afSui,
				amount
			);
		transactions.push(...joinAndSplitTransactions);

		if (delegation === undefined) {
			// iia. if Delegation is not present then cancel add delegation request.
			transactions.push(
				this.stakeCancelDelegationRequestTransaction(stakedSui, coinId)
			);
		} else {
			// iib. if Delegation is present then request to withdraw delegation.
			transactions.push(
				this.stakeRequestWithdrawDelegationTransaction(
					stakedSui,
					delegation,
					coinId
				)
			);
		}

		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Private
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

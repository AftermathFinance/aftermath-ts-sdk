import {
	EventId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
} from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiEventsBody,
	ApiRequestAddDelegationBody,
	Balance,
	DelegatedStakePosition,
	EventsWithCursor,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeValidator,
	StakeRequestWithdrawDelegationEvent,
	ApiRequestWithdrawDelegationBody,
	ApiCancelDelegationRequestBody,
	StakingStats,
} from "../types";

export class Staking extends AftermathProvider {
	constructor(public readonly network: SuiNetwork) {
		super(network, "staking");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public async getDelegatedStakePositions(
		walletAddress: SuiAddress
	): Promise<DelegatedStakePosition[]> {
		return this.fetchApi(`${walletAddress}/stakes`);
	}

	public async getStakeValidators(): Promise<StakeValidator[]> {
		return this.fetchApi("validators");
	}

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	public async getStats(): Promise<StakingStats> {
		return this.fetchApi("stats");
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getAddStakeEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<StakeRequestAddDelegationEvent>> {
		return this.fetchApi<
			EventsWithCursor<StakeRequestAddDelegationEvent>,
			ApiEventsBody
		>("events/addStake", {
			cursor,
			limit,
		});
	}

	public async getWithdrawStakeEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<StakeRequestWithdrawDelegationEvent>> {
		return this.fetchApi<
			EventsWithCursor<StakeRequestWithdrawDelegationEvent>,
			ApiEventsBody
		>("events/withdrawStake", {
			cursor,
			limit,
		});
	}

	public async getCancelStakeEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<StakeCancelDelegationRequestEvent>> {
		return this.fetchApi<
			EventsWithCursor<StakeCancelDelegationRequestEvent>,
			ApiEventsBody
		>("events/cancelStake", {
			cursor,
			limit,
		});
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestAddDelegationTransactions(
		walletAddress: SuiAddress,
		validatorAddress: SuiAddress,
		coinAmount: Balance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRequestAddDelegationBody
		>("transactions/requestAddDelegation", {
			walletAddress,
			validatorAddress,
			coinAmount,
		});
	}

	public async getRequestWithdrawDelegationTransactions(
		walletAddress: SuiAddress,
		principalAmount: Balance,
		stakedSuiObjectId: ObjectId,
		delegationObjectId: ObjectId
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiRequestWithdrawDelegationBody
		>("transactions/requestWithdrawDelegation", {
			walletAddress,
			principalAmount,
			stakedSuiObjectId,
			delegationObjectId,
		});
	}

	public async getCancelDelegationRequestTransactions(
		walletAddress: SuiAddress,
		principalAmount: Balance,
		stakedSuiObjectId: ObjectId
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiCancelDelegationRequestBody
		>("transactions/cancelDelegationRequest", {
			walletAddress,
			principalAmount,
			stakedSuiObjectId,
		});
	}
}

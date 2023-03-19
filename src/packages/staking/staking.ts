import {
	EventId,
	Transaction,
	SuiAddress,
	Delegation,
	DelegatedStake,
} from "@mysten/sui.js";
import {
	ApiEventsBody,
	ApiRequestAddDelegationBody,
	Balance,
	EventsWithCursor,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
	StakingStats,
	SuiNetwork,
} from "../../types";
import { StakePosition } from "./stakePosition";
import { Caller } from "../../general/utils/caller";

// TODO: move these types to staking api class

export class Staking extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		objectTypes: {
			stakedSuiType: "0x2::staking_pool::StakedSui",
			delegationType: "0x2::staking_pool::Delegation",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "staking");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public async getStakePosition(
		walletAddress: SuiAddress
	): Promise<StakePosition> {
		const position = await this.fetchApi<DelegatedStake>(
			`stakePositions/${walletAddress}`
		);
		return new StakePosition(walletAddress, position, this.network);
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

	public async getRequestAddDelegationTransaction(
		walletAddress: SuiAddress,
		validatorAddress: SuiAddress,
		coinAmount: Balance
	): Promise<Transaction> {
		return this.fetchApi<Transaction, ApiRequestAddDelegationBody>(
			"transactions/requestAddDelegation",
			{
				walletAddress,
				validatorAddress,
				coinAmount,
			}
		);
	}
}

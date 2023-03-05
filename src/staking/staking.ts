import { EventId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import ApiProvider from "../apiProvider/apiProvider";
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
	StakingStats,
	SuiNetwork,
} from "../types";
import { StakePosition } from "./stakePosition";

export class Staking extends ApiProvider {
	constructor(public readonly network: SuiNetwork) {
		super(network, "staking");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public async getStakePositions(
		walletAddress: SuiAddress
	): Promise<StakePosition[]> {
		const delegatedStakePositions = this.fetchApi<DelegatedStakePosition[]>(
			`${walletAddress}/stakes`
		);
		return (await delegatedStakePositions).map(
			(position) =>
				new StakePosition(this.network, walletAddress, position)
		);
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
}

import {
	EventId,
	Transaction,
	SuiAddress,
	DelegatedStake,
	SuiValidatorSummary,
	StakeObject,
} from "@mysten/sui.js";
import {
	ApiCancelDelegationRequestBody,
	ApiEventsBody,
	ApiRequestAddDelegationBody,
	ApiRequestWithdrawDelegationBody,
	Balance,
	EventsWithCursor,
	SerializedTransaction,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
	StakingStats,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";

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

	public async getStakePositions(
		walletAddress: SuiAddress
	): Promise<DelegatedStake[]> {
		return this.fetchApi<DelegatedStake[]>(
			`stakePositions/${walletAddress}`
		);
	}

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("activeValidators");
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
		return Transaction.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiRequestAddDelegationBody
			>("transactions/requestAddDelegation", {
				walletAddress,
				validatorAddress,
				coinAmount,
			})
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestWithdrawTransaction(
		walletAddress: SuiAddress,
		stake: StakeObject
	): Promise<Transaction> {
		if (stake.status === "Pending")
			throw new Error(
				"stake unable to withdraw, current status is pending"
			);

		return Transaction.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiRequestWithdrawDelegationBody
			>("transactions/requestWithdrawDelegation", {
				walletAddress: walletAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
				// PRODUCTION: find out what should really be here for delegationObjectId
				delegationObjectId: "undefined",
			})
		);
	}

	public async getCancelRequestTransaction(
		walletAddress: SuiAddress,
		stake: StakeObject
	): Promise<Transaction> {
		return Transaction.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiCancelDelegationRequestBody
			>("transactions/cancelDelegationRequest", {
				walletAddress: walletAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
			})
		);
	}
}

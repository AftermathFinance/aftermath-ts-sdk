import {
	EventId,
	TransactionBlock,
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
			`stake-positions/${walletAddress}`
		);
	}

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
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

	public async getAddStakeEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<StakeRequestAddDelegationEvent>(
			"events/add-stake",
			{
				cursor,
				limit,
			}
		);
	}

	public async getWithdrawStakeEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<StakeRequestWithdrawDelegationEvent>(
			"events/withdraw-stake",
			{
				cursor,
				limit,
			}
		);
	}

	public async getCancelStakeEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<StakeCancelDelegationRequestEvent>(
			"events/cancel-stake",
			{
				cursor,
				limit,
			}
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestAddDelegationTransaction(
		walletAddress: SuiAddress,
		validatorAddress: SuiAddress,
		coinAmount: Balance
	) {
		return this.fetchApiTransaction<ApiRequestAddDelegationBody>(
			"transactions/request-add-delegation",
			{
				walletAddress,
				validatorAddress,
				coinAmount,
			}
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestWithdrawTransaction(
		walletAddress: SuiAddress,
		stake: StakeObject
	) {
		if (stake.status === "Pending")
			throw new Error(
				"stake unable to withdraw, current status is pending"
			);

		return this.fetchApiTransaction<ApiRequestWithdrawDelegationBody>(
			"transactions/request-withdraw-delegation",
			{
				walletAddress: walletAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
				// PRODUCTION: find out what should really be here for delegationObjectId
				delegationObjectId: "undefined",
			}
		);
	}

	public async getCancelRequestTransaction(
		walletAddress: SuiAddress,
		stake: StakeObject
	) {
		return this.fetchApiTransaction<ApiCancelDelegationRequestBody>(
			"transactions/cancel-delegation-request",
			{
				walletAddress: walletAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
			}
		);
	}
}

import {
	EventId,
	SignableTransaction,
	SuiAddress,
	SuiSystemState,
} from "@mysten/sui.js";
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

	public async getStakePositions(
		walletAddress: SuiAddress
	): Promise<StakePosition[]> {
		const delegatedStakePositions = this.fetchApi<DelegatedStakePosition[]>(
			`stakePositions/${walletAddress}`
		);
		return (await delegatedStakePositions).map(
			(position) =>
				new StakePosition(walletAddress, position, this.network)
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

	/////////////////////////////////////////////////////////////////////
	//// Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public static calcStakingRewards = (
		suiSystemState: SuiSystemState,
		delegation: DelegatedStakePosition
	): Balance => {
		if (delegation.status === "pending") return BigInt(0);

		const validatorAddress = delegation.validatorAddress;
		const activeValidators = suiSystemState.validators.active_validators;

		const validator = activeValidators.find(
			(validator) =>
				validator.delegation_staking_pool.validator_address ===
				validatorAddress
		);
		if (!validator) return BigInt(0);

		const poolTokens = delegation.status.active.poolCoinsAmount;

		const delegationTokenSupply = BigInt(
			validator.delegation_staking_pool.delegation_token_supply.value
		);

		const suiBalance = BigInt(
			validator.delegation_staking_pool.sui_balance
		);

		const principalAmount = delegation.status.active.principalSuiAmount;

		const currentSuiWorth =
			(poolTokens * suiBalance) / delegationTokenSupply;

		return currentSuiWorth - principalAmount;
	};
}

import { EventId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiEventsBody,
	ApiRequestAddDelegationBody,
	Balance,
	DelegatedStakePosition,
	EventsWithCursor,
	StakeRequestAddDelegationEvent,
	StakeValidator,
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

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getStakeEvents(
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

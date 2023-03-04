import { EventId, SignableTransaction, SuiAddress } from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	Balance,
	DelegatedStakePosition,
	EventsWithCursor,
	StakeRequestAddDelegationEvent,
	StakeValidator,
} from "aftermath-sdk";
import { ApiEventsBody, ApiRequestAddDelegationBody } from "../types/apiTypes";

export class Staking extends AftermathProvider {
	constructor(public readonly network: SuiNetwork) {
		// TODO: change to staking
		super(network, "stake");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public async getDelegatedStakePositions(
		walletAddress: SuiAddress
	): Promise<DelegatedStakePosition[]> {
		return this.fetchApi(`stakes/${walletAddress}`);
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
		>("events/stakes", {
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
		>(`requestAddDelegation/${validatorAddress}`, {
			walletAddress,
			coinAmount,
		});
	}
}

import { Transaction, SuiAddress, DelegatedStake } from "@mysten/sui.js";
import {
	ApiCancelDelegationRequestBody,
	ApiRequestWithdrawDelegationBody,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class StakePosition extends Caller {
	constructor(
		public readonly stakerAddress: SuiAddress,
		public readonly stakePosition: DelegatedStake,
		public readonly network?: SuiNetwork
	) {
		super(network, "staking");
		this.stakePosition = stakePosition;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestWithdrawTransactions(): Promise<Transaction> {
		if (this.stakePosition.status === "pending")
			throw new Error(
				"stake position unable to withdraw, current status is pending"
			);

		return this.fetchApi<Transaction, ApiRequestWithdrawDelegationBody>(
			"transactions/requestWithdrawDelegation",
			{
				walletAddress: this.stakerAddress,
				principalAmount: this.stakePosition.principalAmount,
				stakedSuiObjectId: this.stakePosition.stakedSuiId,
				delegationObjectId: this.stakePosition.status.active.id,
			}
		);
	}

	public async getCancelRequestTransactions(): Promise<Transaction> {
		return this.fetchApi<Transaction, ApiCancelDelegationRequestBody>(
			"transactions/cancelDelegationRequest",
			{
				walletAddress: this.stakerAddress,
				principalAmount: this.stakePosition.principalAmount,
				stakedSuiObjectId: this.stakePosition.stakedSuiId,
			}
		);
	}
}

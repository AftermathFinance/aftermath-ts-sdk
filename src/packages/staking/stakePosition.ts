import {
	Transaction,
	SuiAddress,
	DelegatedStake,
	StakeObject,
} from "@mysten/sui.js";
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

	public async getRequestWithdrawTransaction(
		stake: StakeObject
	): Promise<Transaction> {
		if (stake.status === "Pending")
			throw new Error(
				"stake unable to withdraw, current status is pending"
			);

		return this.fetchApi<Transaction, ApiRequestWithdrawDelegationBody>(
			"transactions/requestWithdrawDelegation",
			{
				walletAddress: this.stakerAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
				// delegationObjectId: stake,
			}
		);
	}

	public async getCancelRequestTransaction(
		stake: StakeObject
	): Promise<Transaction> {
		return this.fetchApi<Transaction, ApiCancelDelegationRequestBody>(
			"transactions/cancelDelegationRequest",
			{
				walletAddress: this.stakerAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
			}
		);
	}
}

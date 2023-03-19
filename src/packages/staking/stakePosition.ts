import {
	Transaction,
	SuiAddress,
	DelegatedStake,
	StakeObject,
} from "@mysten/sui.js";
import {
	ApiCancelDelegationRequestBody,
	ApiRequestWithdrawDelegationBody,
	SerializedTransaction,
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

		return Transaction.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiRequestWithdrawDelegationBody
			>("transactions/requestWithdrawDelegation", {
				walletAddress: this.stakerAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
				// PRODUCTION: find out what should really be here for delegationObjectId
				delegationObjectId: "undefined",
			})
		);
	}

	public async getCancelRequestTransaction(
		stake: StakeObject
	): Promise<Transaction> {
		return Transaction.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiCancelDelegationRequestBody
			>("transactions/cancelDelegationRequest", {
				walletAddress: this.stakerAddress,
				principalAmount: BigInt(stake.principal),
				stakedSuiObjectId: stake.stakedSuiId,
			})
		);
	}
}

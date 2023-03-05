import { SignableTransaction, SuiAddress } from "@mysten/sui.js";
import ApiProvider from "../apiProvider/apiProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiCancelDelegationRequestBody,
	ApiRequestWithdrawDelegationBody,
	DelegatedStakePosition,
} from "../types";

export class StakePosition extends ApiProvider {
	constructor(
		public readonly network: SuiNetwork,
		public readonly stakerAddress: SuiAddress,
		public readonly stakePosition: DelegatedStakePosition
	) {
		super(network, "staking");
		this.stakePosition = stakePosition;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestWithdrawTransactions(): Promise<
		SignableTransaction[]
	> {
		if (this.stakePosition.status === "pending")
			throw new Error(
				"stake position unable to withdraw, current status is pending"
			);

		return this.fetchApi<
			SignableTransaction[],
			ApiRequestWithdrawDelegationBody
		>("transactions/requestWithdrawDelegation", {
			walletAddress: this.stakerAddress,
			principalAmount: this.stakePosition.principalAmount,
			stakedSuiObjectId: this.stakePosition.stakedSuiId,
			delegationObjectId: this.stakePosition.status.active.id,
		});
	}

	public async getCancelRequestTransactions(): Promise<
		SignableTransaction[]
	> {
		return this.fetchApi<
			SignableTransaction[],
			ApiCancelDelegationRequestBody
		>("transactions/cancelDelegationRequest", {
			walletAddress: this.stakerAddress,
			principalAmount: this.stakePosition.principalAmount,
			stakedSuiObjectId: this.stakePosition.stakedSuiId,
		});
	}
}

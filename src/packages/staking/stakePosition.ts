import {
	SignableTransaction,
	SuiAddress,
	SuiSystemState,
} from "@mysten/sui.js";
import {
	ApiCancelDelegationRequestBody,
	ApiRequestWithdrawDelegationBody,
	Balance,
	DelegatedStakePosition,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class StakePosition extends Caller {
	constructor(
		public readonly stakerAddress: SuiAddress,
		public readonly stakePosition: DelegatedStakePosition,
		public readonly network?: SuiNetwork
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

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public calcStakingRewards = (suiSystemState: SuiSystemState): Balance => {
		if (this.stakePosition.status === "pending") return BigInt(0);

		const validatorAddress = this.stakePosition.validatorAddress;
		const activeValidators = suiSystemState.validators.active_validators;

		const validator = activeValidators.find(
			(validator) =>
				validator.delegation_staking_pool.validator_address ===
				validatorAddress
		);
		if (!validator) return BigInt(0);

		const poolTokens = this.stakePosition.status.active.poolCoinsAmount;

		const delegationTokenSupply = BigInt(
			validator.delegation_staking_pool.delegation_token_supply.value
		);

		const suiBalance = BigInt(
			validator.delegation_staking_pool.sui_balance
		);

		const principalAmount =
			this.stakePosition.status.active.principalSuiAmount;

		const currentSuiWorth =
			(poolTokens * suiBalance) / delegationTokenSupply;

		return currentSuiWorth - principalAmount;
	};
}

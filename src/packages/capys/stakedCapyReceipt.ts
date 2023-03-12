import { SignableTransaction } from "@mysten/sui.js";
import {
	ApiUnstakeCapyBody,
	ApiWithdrawCapyFeesAmountBody,
	Balance,
	StakedCapyFeesEarned,
	StakedCapyReceiptObject,
	SuiNetwork,
} from "../../types";
import { Capy } from "./capy";
import { Caller } from "../../general/utils/caller";

export class StakedCapyReceipt extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly stakedCapy: Capy,
		public readonly stakedCapyReceipt: StakedCapyReceiptObject,
		public readonly network?: SuiNetwork
	) {
		super(network, "capys");
		this.stakedCapyReceipt = stakedCapyReceipt;
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getFeesEarned(): Promise<StakedCapyFeesEarned> {
		return this.fetchApi(`${this.stakedCapyReceipt.objectId}/feesEarned`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getUnstakeCapyTransaction(): Promise<SignableTransaction> {
		return this.fetchApi<SignableTransaction, ApiUnstakeCapyBody>(
			"transactions/stake",
			{
				stakingReceiptId: this.stakedCapyReceipt.objectId,
			}
		);
	}

	public async getWithdrawFeesTransaction(
		amount: Balance | undefined
	): Promise<SignableTransaction> {
		return this.fetchApi<
			SignableTransaction,
			ApiWithdrawCapyFeesAmountBody
		>("transactions/withdrawFees", {
			amount,
			stakingReceiptObjectId: this.stakedCapyReceipt.objectId,
		});
	}
}

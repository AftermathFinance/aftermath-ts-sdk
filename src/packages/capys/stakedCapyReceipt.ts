import {
	ApiUnstakeCapyBody,
	ApiWithdrawCapyFeesAmountBody,
	Balance,
	SerializedTransaction,
	StakedCapyFeesEarned,
	StakedCapyReceiptObject,
	SuiNetwork,
	Url,
} from "../../types";
import { Capy } from "./capy";
import { Caller } from "../../general/utils/caller";
import { TransactionBlock } from "@mysten/sui.js";

export class StakedCapyReceipt extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly stakedCapy: Capy,
		public readonly stakedCapyReceipt: StakedCapyReceiptObject,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, "capys");
		this.stakedCapyReceipt = stakedCapyReceipt;
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getFeesEarned(): Promise<StakedCapyFeesEarned> {
		return this.fetchApi(`fees-earned/${this.stakedCapyReceipt.objectId}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getUnstakeCapyTransaction() {
		return this.fetchApiTransaction<ApiUnstakeCapyBody>(
			"transactions/stake",
			{
				stakingReceiptId: this.stakedCapyReceipt.objectId,
			}
		);
	}

	public async getWithdrawFeesTransaction(amount: Balance | undefined) {
		return this.fetchApiTransaction<ApiWithdrawCapyFeesAmountBody>(
			"transactions/withdraw-fees",
			{
				amount,
				stakingReceiptObjectId: this.stakedCapyReceipt.objectId,
			}
		);
	}
}

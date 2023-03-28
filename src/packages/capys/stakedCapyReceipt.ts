import {
	ApiUnstakeCapyBody,
	ApiWithdrawCapyFeesAmountBody,
	Balance,
	SerializedTransaction,
	StakedCapyFeesEarned,
	StakedCapyReceiptObject,
	SuiNetwork,
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
		public readonly network?: SuiNetwork
	) {
		super(network, "capys");
		this.stakedCapyReceipt = stakedCapyReceipt;
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getFeesEarned(): Promise<StakedCapyFeesEarned> {
		return this.fetchApi(`feesEarned/${this.stakedCapyReceipt.objectId}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getUnstakeCapyTransaction(): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, ApiUnstakeCapyBody>(
				"transactions/stake",
				{
					stakingReceiptId: this.stakedCapyReceipt.objectId,
				}
			)
		);
	}

	public async getWithdrawFeesTransaction(
		amount: Balance | undefined
	): Promise<TransactionBlock> {
		return TransactionBlock.from(
			await this.fetchApi<
				SerializedTransaction,
				ApiWithdrawCapyFeesAmountBody
			>("transactions/withdrawFees", {
				amount,
				stakingReceiptObjectId: this.stakedCapyReceipt.objectId,
			})
		);
	}
}

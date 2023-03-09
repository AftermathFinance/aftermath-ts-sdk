import { SignableTransaction } from "@mysten/sui.js";
import {
	ApiUnstakeCapyBody,
	ApiWithdrawCapyFeesAmountBody,
	Balance,
	StakedCapyFeesEarned,
	StakedCapyReceiptObject,
	SuiNetwork,
} from "../../types";
import { Aftermath } from "../../general/providers/aftermath";
import { Capys } from "./capys";
import { Capy } from "./capy";

export class StakedCapyReceipt extends Aftermath {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly stakedCapyReceipt: StakedCapyReceiptObject,
		public readonly network?: SuiNetwork
	) {
		super(network, "capys");
		this.stakedCapyReceipt = stakedCapyReceipt;
	}

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	public async getCapy(): Promise<Capy> {
		return await new Capys(this.network).getCapy(
			this.stakedCapyReceipt.capyId
		);
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

	public async getUnstakeCapyTransactions(): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiUnstakeCapyBody>(
			"transactions/stake",
			{
				stakingReceiptId: this.stakedCapyReceipt.objectId,
			}
		);
	}

	public async getWithdrawFeesTransactions(
		amount: Balance | undefined
	): Promise<SignableTransaction[]> {
		return this.fetchApi<
			SignableTransaction[],
			ApiWithdrawCapyFeesAmountBody
		>("transactions/withdrawFees", {
			amount,
			stakingReceiptObjectId: this.stakedCapyReceipt.objectId,
		});
	}
}

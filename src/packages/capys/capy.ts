import { ObjectId, SignableTransaction } from "@mysten/sui.js";
import { ApiStakeCapyBody, SuiNetwork, CapyObject } from "../../types";
import { Aftermath } from "../../general/providers/aftermath";

export class Capy extends Aftermath {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly capy: CapyObject,
		public readonly network?: SuiNetwork
	) {
		super(network, "capys");
		this.capy = capy;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getStakeTransactions(
		capyId: ObjectId
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiStakeCapyBody>(
			"transactions/stake",
			{
				capyId,
			}
		);
	}
}

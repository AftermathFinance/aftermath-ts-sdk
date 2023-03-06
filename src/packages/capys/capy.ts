import { ObjectId, SignableTransaction } from "@mysten/sui.js";
import { ApiStakeCapyBody, SuiNetwork, CapyObject } from "../../types";
import { ApiProvider } from "../../general/providers/apiProvider";

export class Capy extends ApiProvider {
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

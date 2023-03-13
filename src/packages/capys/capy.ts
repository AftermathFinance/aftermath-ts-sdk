import { SignableTransaction } from "@mysten/sui.js";
import { ApiStakeCapyBody, SuiNetwork, CapyObject } from "../../types";
import { Caller } from "../../general/utils/caller";

export class Capy extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly capy: CapyObject,
		public readonly network?: SuiNetwork,
		public readonly isStaked: boolean = false
	) {
		super(network, "capys");
		this.capy = capy;
		this.isStaked = isStaked;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getStakeTransaction(): Promise<SignableTransaction> {
		if (this.isStaked)
			throw new Error("unable to stake already staked capy");

		return this.fetchApi<SignableTransaction, ApiStakeCapyBody>(
			"transactions/stake",
			{
				capyId: this.capy.objectId,
			}
		);
	}
}

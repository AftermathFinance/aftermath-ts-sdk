import {
	ApiStakeCapyBody,
	SuiNetwork,
	CapyObject,
	SerializedTransaction,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { TransactionBlock } from "@mysten/sui.js";

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

	public async getStakeTransaction() {
		if (this.isStaked)
			throw new Error("unable to stake already staked capy");

		return this.fetchApiTransaction<ApiStakeCapyBody>(
			"transactions/stake",
			{
				capyId: this.capy.objectId,
			}
		);
	}
}

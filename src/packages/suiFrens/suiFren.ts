import {
	ApiStakeSuiFrenBody,
	SuiNetwork,
	SuiFrenObject,
	SerializedTransaction,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { TransactionBlock } from "@mysten/sui.js";

export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly suiFren: SuiFrenObject,
		public readonly network?: SuiNetwork | Url,
		public readonly isStaked: boolean = false
	) {
		super(network, "suiFrens");
		this.suiFren = suiFren;
		this.isStaked = isStaked;
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction() {
		if (this.isStaked)
			throw new Error("unable to stake already staked suiFren");

		return this.fetchApiTransaction<ApiStakeSuiFrenBody>(
			"transactions/stake",
			{
				suiFrenId: this.suiFren.objectId,
			}
		);
	}
}

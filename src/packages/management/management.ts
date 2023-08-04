import { ApiPublishLpCoinBody, SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";

export class Management extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "management");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getPublishLpCoinTransaction(inputs: ApiPublishLpCoinBody) {
		return this.fetchApiTransaction<ApiPublishLpCoinBody>(
			"transactions/publish-lp-coin",
			inputs
		);
	}
}

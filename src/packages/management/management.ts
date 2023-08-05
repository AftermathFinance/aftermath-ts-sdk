import { SuiNetwork, Url } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiManagementOwnedLpsBody,
	ApiManagementTransferLpsBody,
	ManagementLpInfo,
} from "./managementTypes";

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

	public async getOwnedLps(inputs: ApiManagementOwnedLpsBody) {
		return this.fetchApi<ManagementLpInfo[], ApiManagementOwnedLpsBody>(
			"transactions/owned-lps",
			inputs
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getTransferLpsTransaction(
		inputs: ApiManagementTransferLpsBody
	) {
		return this.fetchApiTransaction<ApiManagementTransferLpsBody>(
			"transactions/transfer-lps",
			inputs
		);
	}
}

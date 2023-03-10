import { Caller } from "../../general/utils/caller";
import { SuiNetwork } from "../../types";

export class Sui extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		addresses: {
			suiPackageId: "0x0000000000000000000000000000000000000002",
			suiSystemStateId: "0x0000000000000000000000000000000000000005",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "sui");
	}

	// TODO: add fetching here for eopch, system state, etc.
}

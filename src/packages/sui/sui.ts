import { Aftermath } from "../../general/providers/aftermath";
import { SuiNetwork } from "../../types";

export class Sui extends Aftermath {
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

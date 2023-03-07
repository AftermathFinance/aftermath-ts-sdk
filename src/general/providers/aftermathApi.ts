import { JsonRpcProvider } from "@mysten/sui.js";
import { ConfigAddresses } from "../types/configTypes";

export class AftermathApi {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		// TODO: change this into modules ?
		packages: {
			sui: {
				packageId: "0x0000000000000000000000000000000000000002",
				systemStateId: "0x0000000000000000000000000000000000000005",
			},
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	protected constructor(
		public readonly provider: JsonRpcProvider,
		public readonly addresses: Partial<ConfigAddresses>
	) {
		this.provider = provider;
	}
}

import { JsonRpcProvider } from "@mysten/sui.js";
import { ConfigAddresses } from "../../types/configTypes";

export class RpcProvider {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		packages: {
			sui: {
				packageId: "0x0000000000000000000000000000000000000002",
				systemStateId: "0x0000000000000000000000000000000000000005",
			},
			utilities: {
				pay: {
					module: "pay",
					functions: {
						zero: {
							name: "zero",
							defaultGasBudget: 1000,
						},
						joinVecAndSplit: {
							name: "join_vec_and_split",
							defaultGasBudget: 2000,
						},
					},
				},
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

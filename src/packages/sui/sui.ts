import { SuiSystemStateSummary } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import { SuiNetwork, Url } from "../../types";

export class Sui extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		addresses: {
			suiPackageId:
				"0x0000000000000000000000000000000000000000000000000000000000000002",
			suiSystemStateId:
				"0x0000000000000000000000000000000000000000000000000000000000000005",
			suiClockId:
				"0x0000000000000000000000000000000000000000000000000000000000000006",
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "sui");
	}

	// =========================================================================
	//  Chain Info
	// =========================================================================

	// TODO: remove this (duplicate of system state info)
	public async getCurrentEpoch(): Promise<EpochTimeStamp> {
		return this.fetchApi("epoch");
	}

	public async getSystemState(): Promise<SuiSystemStateSummary> {
		return this.fetchApi("system-state");
	}
}

import { SuiSystemStateSummary } from "@mysten/sui.js/client";
import { Caller } from "../../general/utils/caller";
import { SuiNetwork, Url } from "../../types";
import { AftermathApi } from "../../general/providers";

export class Sui extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		addresses: {
			zero: "0x0000000000000000000000000000000000000000000000000000000000000000",
			suiPackageId:
				"0x0000000000000000000000000000000000000000000000000000000000000002",
			suiSystemStateId:
				"0x0000000000000000000000000000000000000000000000000000000000000005",
			suiClockId:
				"0x0000000000000000000000000000000000000000000000000000000000000006",
		},
		objectTypes: {
			kioskOwnerCap:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap",
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "sui");
	}

	// =========================================================================
	//  Chain Info
	// =========================================================================

	public async getSystemState(): Promise<SuiSystemStateSummary> {
		return this.useProvider().fetchSystemState();
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Sui();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

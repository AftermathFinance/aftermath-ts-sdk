import { AftermathApi } from "../../../general/providers/aftermathApi";
import { AfNftAddresses, ObjectId, AnyObjectType } from "../../../types";
import { Helpers } from "../../../general/utils";
import { TransactionBlock } from "@mysten/sui.js/transactions";

export class AfNftApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			whitelistManager: "wl_manager",
			egg: "egg",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: AfNftAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.afNft;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	// =========================================================================
	//  Transaction Commands
	// =========================================================================
}

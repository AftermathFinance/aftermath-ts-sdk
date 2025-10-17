import { SuiSystemStateSummary } from "@mysten/sui/client";
import { Caller } from "../../general/utils/caller";
import { CallerConfig, CoinType, SuiNetwork, Url } from "../../types";
import { AftermathApi } from "../../general/providers";

/**
 * The `Sui` class provides utilities to fetch core Sui chain information,
 * such as the system state. It also exposes a set of constant addresses
 * related to the Sui network package IDs.
 */
export class Sui extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Static constants containing important addresses on the Sui network:
	 *  - `zero`: The zero address (commonly used as a null placeholder).
	 *  - `suiPackageId`: The package ID for the Sui system package.
	 *  - `suiSystemStateId`: The object ID for the Sui system state.
	 *  - `suiClockId`: The object ID for the Sui on-chain clock.
	 */
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
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the `Sui` class for fetching chain-level info.
	 *
	 * @param config - Optional configuration, including the Sui network and an access token.
	 * @param Provider - An optional `AftermathApi` instance for advanced transaction building or data fetching.
	 */
	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "sui");
	}

	// =========================================================================
	//  Chain Info
	// =========================================================================

	/**
	 * Fetches the Sui system state summary object, which contains details
	 * about the current epoch, validator set, and other protocol-level data.
	 *
	 * @returns A promise that resolves to a `SuiSystemStateSummary` instance.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const sui = afSdk.Sui();
	 *
	 * const systemState = await sui.getSystemState();
	 * console.log(systemState.epoch, systemState.validators);
	 * ```
	 */
	public async getSystemState(): Promise<SuiSystemStateSummary> {
		return this.fetchApi("system-state");
	}
}

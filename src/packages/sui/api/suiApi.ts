import { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Helpers } from "../../../general/utils";

export class SuiApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * @deprecated Use `getSystemState()` method instead.
	 * This method will be removed in a future release.
	 * @example
	 * ```typescript
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // initialize provider
	 *
	 * const sui = afSdk.Sui();
	 *
	 * const systemState = await sui.getSystemState();
	 * console.log(systemState.epoch, systemState.validators);
	 */
	public fetchSystemState = async (): Promise<SuiSystemStateSummary> => {
		const systemState =
			await this.Provider.provider.getLatestSuiSystemState();

		const activeValidators = systemState.activeValidators.map(
			(validator) => ({
				...validator,
				suiAddress: Helpers.addLeadingZeroesToType(
					validator.suiAddress
				),
			})
		);

		return {
			...systemState,
			activeValidators,
		};
	};
}

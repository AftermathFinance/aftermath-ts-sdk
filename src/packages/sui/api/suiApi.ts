import { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui.js";
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

	public fetchCommitteeInfo = async (): Promise<CommitteeInfo> => {
		return this.Provider.provider.getCommitteeInfo();
	};

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

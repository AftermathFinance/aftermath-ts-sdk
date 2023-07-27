import { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";

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
		return await this.Provider.provider.getLatestSuiSystemState();
	};
}

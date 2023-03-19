import { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { SuiApiHelpers } from "./suiApiHelpers";

export class SuiApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new SuiApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCommitteeInfo = async (): Promise<CommitteeInfo> => {
		return this.Provider.provider.getCommitteeInfo();
	};

	public fetchSystemState = async (): Promise<SuiSystemStateSummary> => {
		return await this.Provider.provider.getLatestSuiSystemState();
	};
}

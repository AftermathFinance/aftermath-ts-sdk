import { CommitteeInfo } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { AuthorityPublicKeyBytes } from "../../../types";
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
		const committeeInfoOnChain = (
			await this.Provider.Rpc().fetchRpcCall("getCommitteeInfo", [])
		).result;

		const committeeInfo = {
			epoch: committeeInfoOnChain.epoch,
			committeeInfo: committeeInfoOnChain.committee_info.map(
				(info: any[]) => {
					return {
						pubKey: info[0],
						bytes: info[1],
					} as AuthorityPublicKeyBytes;
				}
			),
		} as CommitteeInfo;

		return committeeInfo;
	};

	public fetchCurrentEpoch = async (): Promise<EpochTimeStamp> => {
		return (await this.fetchCommitteeInfo()).epoch;
	};

	public fetchSystemState = async () => {
		const suiSystemState = await this.Provider.provider.getSuiSystemState();
		return suiSystemState;
	};
}

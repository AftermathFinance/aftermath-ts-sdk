import { CommitteeInfo } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { AuthorityPublicKeyBytes } from "../../../types";
import { SuiApiHelpers } from "./suiApiHelpers";

export class SuiApi extends SuiApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(Provider: AftermathApi) {
		super(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCommitteeInfo = async (): Promise<CommitteeInfo> => {
		const committeeInfoOnChain = (
			await this.Provider.Rpc.fetchRpcCall("getCommitteeInfo", [])
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
}

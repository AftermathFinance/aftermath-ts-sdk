import { Caller } from "../../general/utils/caller";
import { CallerConfig } from "../../types";
import {
	ApiRewardsClaimBody,
	ApiRewardsGetClaimableBody,
	ApiRewardsGetClaimableResponse,
	ApiRewardsGetHistoryBody,
	ApiRewardsGetHistoryResponse,
	ApiRewardsGetPointsBody,
	ApiRewardsGetPointsResponse,
} from "./rewardsTypes";

export class Rewards extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "rewards");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	public async getPoints(
		inputs: ApiRewardsGetPointsBody
	): Promise<ApiRewardsGetPointsResponse> {
		return this.fetchApi<
			ApiRewardsGetPointsResponse,
			ApiRewardsGetPointsBody
		>("points", inputs);
	}

	public async getHistory(
		inputs: ApiRewardsGetHistoryBody
	): Promise<ApiRewardsGetHistoryResponse> {
		return this.fetchApi<
			ApiRewardsGetHistoryResponse,
			ApiRewardsGetHistoryBody
		>("history", inputs);
	}

	public async getClaimable(
		inputs: ApiRewardsGetClaimableBody
	): Promise<ApiRewardsGetClaimableResponse> {
		return this.fetchApi<
			ApiRewardsGetClaimableResponse,
			ApiRewardsGetClaimableBody
		>("claimable", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getClaimTransaction(inputs: ApiRewardsClaimBody) {
		return this.fetchApiTransaction<ApiRewardsClaimBody>(
			"transactions/claim",
			inputs
		);
	}
}

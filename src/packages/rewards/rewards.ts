import { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, CoinType, SuiAddress } from "../../types";
import type {
	ApiRewardsClaimRequestTxBody,
	ApiRewardsClaimRequestTxResponse,
	ApiRewardsExpectedRewardsBody,
	ApiRewardsExpectedRewardsResponse,
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

	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "rewards");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	public async getPoints(
		inputs: ApiRewardsGetPointsBody
	): Promise<ApiRewardsGetPointsResponse> {
		return this.fetchApi<ApiRewardsGetPointsResponse, ApiRewardsGetPointsBody>(
			"points",
			inputs
		);
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

	/**
	 * Preview a single account's expected rewards for an epoch, broken down by
	 * domain (trading, referral, AFLP, integrator) plus totals. Backed by the
	 * newer `rewards/expectedRewards` endpoint. Provide exactly one of `address`
	 * or `accountId`; omit `epoch` for the current epoch.
	 */
	public async getExpectedRewards(
		inputs: ApiRewardsExpectedRewardsBody
	): Promise<ApiRewardsExpectedRewardsResponse> {
		return this.fetchApi<
			ApiRewardsExpectedRewardsResponse,
			ApiRewardsExpectedRewardsBody
		>("expectedRewards", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getClaimTransaction(inputs: {
		walletAddress: SuiAddress;
		coinTypes?: CoinType[];
		recipientAddress?: SuiAddress;
		tx?: Transaction;
	}) {
		const { tx, ...otherInputs } = inputs;

		return this.fetchApiTxObject<
			ApiRewardsClaimRequestTxBody,
			ApiRewardsClaimRequestTxResponse
		>(
			"transactions/claim",
			{
				...otherInputs,
				txKind: await this.api?.Transactions().fetchBase64TxKindFromTx({
					tx: tx ?? new Transaction(),
				}),
			},
			undefined,
			{ txKind: true }
		);
	}
}

import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, CoinType, SuiAddress } from "../../types";
import type {
	ApiRewardsClaimRequestTxBody,
	ApiRewardsClaimRequestTxResponse,
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
		public readonly Provider?: AftermathApi
	) {
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
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{
						tx: tx ?? new Transaction(),
					}
				),
			},
			undefined,
			{ txKind: true }
		);
	}
}

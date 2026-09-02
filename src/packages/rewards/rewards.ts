import { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type { CallerConfig, CoinType, SuiAddress } from "../../types";
import type {
	ApiRewardsClaimRequestTxBody,
	ApiRewardsClaimRequestTxResponse,
	ApiRewardsDistributionBody,
	ApiRewardsDistributionResponse,
	ApiRewardsExpectedRewardsBody,
	ApiRewardsExpectedRewardsResponse,
	ApiRewardsGetClaimableBody,
	ApiRewardsGetClaimableResponse,
	ApiRewardsGetHistoryBody,
	ApiRewardsGetHistoryResponse,
	ApiRewardsGetPointsBody,
	ApiRewardsGetPointsResponse,
} from "./rewardsTypes";

/**
 * Provides HTTP access to reward points, reward history, claimable balances,
 * expected rewards, and claim transaction builders.
 *
 * Read methods request data from the configured Aftermath API. The claim
 * method also converts the API's serialized transaction response into a Sui
 * `Transaction`; it does not sign or execute that transaction.
 */
export class Rewards extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a rewards HTTP client.
	 *
	 * @param config - Optional network, API host, access token, and API path.
	 * @param api - Optional low-level provider used to serialize a caller-supplied
	 * transaction before requesting a claim transaction.
	 */
	constructor(
		config?: CallerConfig,
		/** Optional provider used to serialize a caller-supplied claim transaction. */
		public readonly api?: AftermathApi
	) {
		super(config, "rewards");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	/**
	 * Fetches the wallet's total reward points.
	 *
	 * The request uses the signed authentication fields in `inputs`. The method
	 * performs HTTP I/O and returns the decoded response.
	 *
	 * @param inputs - Wallet address, signed message bytes, and signature.
	 * @returns The total points across all reward epochs and domains.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	/**
	 * Computes the distribution of the maker and taker reward pools across
	 * perpetuals accounts.
	 *
	 * Returns per-account maker and taker reward allocations, fee-tier rebates
	 * and volume metrics. When `accountIds` is omitted or empty the API includes
	 * every eligible account, so pass an explicit list to scope the result.
	 *
	 * **Note:** All data returned is for the current epoch only.
	 *
	 * @param inputs - {@link ApiRewardsDistributionBody}.
	 * @returns Per-account reward and rebate breakdown for the current epoch.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```ts
	 * const { totalQScoreFinal, rewards } = await rewards.getDistribution({
	 *   totalMakerRewards: 10000,
	 *   totalTakerRewards: 5000,
	 *   calculationVariables: { ... },
	 * });
	 * ```
	 */
	public async getDistribution(
		inputs: ApiRewardsDistributionBody
	): Promise<ApiRewardsDistributionResponse> {
		return this.fetchApi<
			ApiRewardsDistributionResponse,
			ApiRewardsDistributionBody
		>("distribution", inputs);
	}

	public async getPoints(
		inputs: ApiRewardsGetPointsBody
	): Promise<ApiRewardsGetPointsResponse> {
		return this.fetchApi<ApiRewardsGetPointsResponse, ApiRewardsGetPointsBody>(
			"points",
			inputs
		);
	}

	/**
	 * Fetches one page of the wallet's reward history.
	 *
	 * Pass `cursor` from the previous response to request the next page. The
	 * API documents a default page size of `20` and a maximum of `100` entries.
	 * Amounts in each history entry are returned as `bigint` values in the
	 * coin's smallest units.
	 *
	 * @param inputs - Wallet authentication data and optional domain and page
	 * parameters.
	 * @returns History entries and pagination metadata.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getHistory(
		inputs: ApiRewardsGetHistoryBody
	): Promise<ApiRewardsGetHistoryResponse> {
		return this.fetchApi<
			ApiRewardsGetHistoryResponse,
			ApiRewardsGetHistoryBody
		>("history", inputs);
	}

	/**
	 * Fetches the wallet's currently claimable rewards.
	 *
	 * @param inputs - Wallet address to query.
	 * @returns Claimable amounts grouped by coin type. Amounts are `bigint`
	 * values in each coin's smallest units.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
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
	 * newer `rewards/expected-rewards` endpoint. Provide exactly one of `address`
	 * or `accountId`; omit `epoch` for the current epoch.
	 *
	 * This method performs an HTTP request. Account IDs are decimal strings so
	 * that values larger than JavaScript's safe integer range remain exact.
	 *
	 * @param inputs - Account selector, epoch, and optional calculation overrides.
	 * @returns The selected epoch, total reward values, and domain breakdown.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getExpectedRewards(
		inputs: ApiRewardsExpectedRewardsBody
	): Promise<ApiRewardsExpectedRewardsResponse> {
		return this.fetchApi<
			ApiRewardsExpectedRewardsResponse,
			ApiRewardsExpectedRewardsBody
		>("expected-rewards", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Requests a reward-claim transaction and restores it as a Sui `Transaction`.
	 *
	 * If `tx` is supplied, this method serializes only its `TransactionKind` via
	 * `AftermathApi.Transactions().fetchBase64TxKindFromTx` and sends that
	 * `txKind` to the API. If `tx` is omitted, the request can still succeed with
	 * a backend-generated transaction. When the response includes a
	 * `sponsorSignature`, the returned bytes are parsed as a full transaction;
	 * otherwise they are parsed as a transaction kind. The returned transaction
	 * is not signed or executed by this method.
	 *
	 * @param inputs - Wallet address, optional coin filters, recipient, and an
	 * optional transaction to extend.
	 * @returns The parsed claim transaction and any backend sponsor signature.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 * @throws `Error` when a supplied transaction cannot be serialized or the
	 * response cannot be restored as a Sui transaction.
	 */
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

import { Transaction } from "@mysten/sui/transactions";
import { Caller } from "../../general/utils/caller";
import type {
	ApiRouterAddTransactionForCompleteTradeRouteBody,
	ApiRouterAddTransactionForCompleteTradeRouteResponse,
	ApiRouterCompleteTradeRouteBody,
	ApiRouterPartialCompleteTradeRouteBody,
	ApiRouterTradeEventsBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	Balance,
	CallerConfig,
	CoinType,
	RouterCompleteTradeRoute,
	RouterTradeEvent,
	Slippage,
} from "../../types";

/**
 * Provides HTTP reads, route construction, and transaction builders for
 * Aftermath's smart order router.
 *
 * Route amounts and fees are `bigint` values in the corresponding coin's
 * smallest unit. Decimal percentages such as slippage and external fees use
 * `number` values where `0.01` means 1%. The router can split a trade across
 * several sub-routes and can chain several protocol paths within each route.
 *
 * @example
 * ```typescript
 * // Create provider
 * const router = (await Aftermath.create({ network: "MAINNET" })).Router();
 * // Retrieve 24h volume
 * const volume24h = await router.getVolume24hrs();
 * // Get supported coins
 * const supportedCoins = await router.getSupportedCoins();
 * ```
 */
export class Router extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Static safety limits used by router requests.
	 */
	public static readonly constants = {
		/**
	 * The maximum external fee fraction accepted in a route request. `0.5` is 50%.
		 */
		maxExternalFeePercentage: 0.5,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a router client without making a network request.
	 *
	 * A later read or transaction request fails with an `AftermathTransportError`
	 * of kind `network` when neither `config.baseUrl` nor `config.network` is set.
	 *
	 * @param config - Optional API host, network, endpoint, and access-token configuration.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 *
	 * const router = afSdk.Router();
	 * ```
	 */
	constructor(config?: CallerConfig) {
		super(config, "router");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the router's total 24-hour trading volume.
	 *
	 * @returns A promise for the numeric API value. This class does not convert its unit.
	 * @throws `AftermathTransportError` for HTTP, network, abort, timeout, or decode failures.
	 *
	 * @example
	 * ```typescript
	 * const volume = await router.getVolume24hrs();
	 * console.log(volume); // e.g. 1234567.89
	 * ```
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	/**
	 * Fetches every coin type currently supported by the router.
	 *
	 * @returns A promise for fully qualified Sui coin type strings.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const supportedCoins = await router.getSupportedCoins();
	 * console.log(supportedCoins); // ["0x2::sui::SUI", "0x<...>::coin::TOKEN", ...]
	 * ```
	 */
	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

	/**
	 * Fetches supported coin types whose API path matches a filter string.
	 *
	 * @param inputs - The filter segment appended to the supported-coins endpoint.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for matching fully qualified coin type strings.
	 * @throws `AftermathTransportError` when the request is cancelled, fails, or cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * const searchResult = await router.searchSupportedCoins({ filter: "SUI" });
	 * console.log(searchResult); // e.g. ["0x2::sui::SUI"]
	 * ```
	 */
	public async searchSupportedCoins(
		inputs: { filter: string },
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<CoinType[]>(
			`supported-coins/${inputs.filter}`,
			undefined,
			abortSignal
		);
	}

	/**
	 * Requests an exact-input route for a specified coin amount.

	 * The API may split the input across several `routes`. Each route can contain
	 * several sequential `paths`, and each path identifies its DEX protocol and
	 * pool. `referrer` and `externalFee` are forwarded to the API. Protocol and
	 * pool allowlists and blocklists constrain route selection.
	 *
	 * @param inputs - Input and output types, input amount in smallest units, and optional routing constraints.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for the complete route, including split portions, path fees, and amounts.
	 * @throws `AftermathTransportError` when the route request fails or the response cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({
	 *   coinInType: "0x2::sui::SUI",
	 *   coinOutType: "0x<...>::coin::TOKEN",
	 *   coinInAmount: BigInt(10_000_000_000),
	 *   // optional fields:
	 *   referrer: "0x<referrer_address>",
	 *   externalFee: {
	 *     recipient: "0x<fee_collector>",
	 *     feePercentage: 0.01
	 *   },
	 *   protocolBlacklist: ["Cetus", "BlueMove"],
	 *   poolBlacklist: ["0x<pool_id>"]
	 * });
	 * console.log(route);
	 * ```
	 */
	public async getCompleteTradeRouteGivenAmountIn(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin being given away
			 */
			coinInAmount: Balance;
		},
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	/**
	 * Requests an exact-output route for a target coin amount.

	 * `slippage` is required because the router must protect the input needed to
	 * reach the target. The API may split the trade across routes and chain paths
	 * across protocols. Amounts are smallest-unit `bigint` values.
	 *
	 * @param inputs - Input and output types, target output in smallest units, slippage, and optional constraints.
	 * @param abortSignal - Optional caller-owned cancellation signal.
	 * @returns A promise for the complete exact-output route.
	 * @throws `AftermathTransportError` when the route request fails or the response cannot be decoded.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountOut({
	 *   coinInType: "0x2::sui::SUI",
	 *   coinOutType: "0x<...>::coin::TOKEN",
	 *   coinOutAmount: BigInt(20_000_000),
	 *   slippage: 0.01, // 1%
	 *   protocolWhitelist: ["Aftermath", "Cetus"],
	 *   poolWhitelist: ["0x<pool_id>"]
	 * });
	 * console.log(route);
	 * ```
	 */
	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin expected to receive
			 */
			coinOutAmount: Balance;
			slippage: Slippage;
		},
		abortSignal?: AbortSignal
	) {
		return this.fetchApi<
			RouterCompleteTradeRoute,
			ApiRouterCompleteTradeRouteBody
		>("trade-route", inputs, abortSignal);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Fetches an unsigned transaction for a previously calculated complete route.

	 * The request serializes nested `bigint` amounts and fixed split portions as
	 * strings ending in `n`. The API response is parsed into a `Transaction`, and
	 * `walletAddress` is assigned as its sender. The method does not sign or submit it.
	 *
	 * @param inputs - Sender, complete route, route slippage, and optional sponsorship or recipient settings.
	 * @returns A promise for the unsigned parsed `Transaction` returned by the API.
	 * @throws `AftermathTransportError` for transport, response decoding, or transaction parsing failures.
	 *
	 * @example
	 * ```typescript
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 * const transactionBytes = await router.getTransactionForCompleteTradeRoute({
	 *   walletAddress: "0x<your_address>",
	 *   completeRoute: route,
	 *   slippage: 0.01
	 * });
	 * // The returned bytes can now be signed and executed using your chosen wallet.
	 * ```
	 */
	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransaction<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade",
			inputs
		);
	}

	/**
	 * Appends a complete route to an existing transaction.

	 * The method serializes the supplied transaction for the API, sends the route
	 * request, and parses the returned serialized transaction into a new
	 * `Transaction`. The input transaction is not mutated. Use the returned
	 * `coinOutId` when the response exposes the swap output. It can be `undefined`.
	 *
	 * @param inputs - Existing transaction, sender, complete route, slippage, and optional input coin argument.
	 * @returns A new transaction and the optional output coin argument.
	 * @throws `AftermathTransportError` when the API request, serialization response, or transaction parsing fails.
	 *
	 * @example
	 * ```typescript
	 * // 1) Create a route
	 * const route = await router.getCompleteTradeRouteGivenAmountIn({ ... });
	 *
	 * // 2) Initialize your transaction
	 * const tx = new Transaction();
	 *
	 * // 3) Add router instructions
	 * const { tx: updatedTx, coinOutId } =
	 *   await router.addTransactionForCompleteTradeRoute({
	 *     tx,
	 *     completeRoute: route,
	 *     slippage: 0.01,
	 *     walletAddress: "0x<your_address>"
	 * });
	 *
	 * // 4) Continue building your transaction with the resulting coinOutId, if desired
	 * updatedTx.transferObjects([coinOutId!], "0x<your_address>");
	 * ```
	 */
	public async addTransactionForCompleteTradeRoute(
		inputs: Omit<
			ApiRouterAddTransactionForCompleteTradeRouteBody,
			"serializedTx"
		> & {
			tx: Transaction;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		const { tx: newTx, coinOutId } = await this.fetchApi<
			ApiRouterAddTransactionForCompleteTradeRouteResponse,
			ApiRouterAddTransactionForCompleteTradeRouteBody
		>("transactions/add-trade", {
			...otherInputs,
			serializedTx: tx.serialize(),
		});
		return {
			tx: Transaction.from(newTx),
			coinOutId,
		};
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches routed trade events for one wallet from the indexer.
	 *
	 * @param inputs - Wallet address and optional numeric cursor and page limit.
	 * @returns A promise for paginated `RouterTradeEvent` values. A full page advances `nextCursor`.
	 * @throws `AftermathTransportError` when the indexer request or response fails.
	 *
	 * @example
	 * ```typescript
	 * const events = await router.getInteractionEvents({
	 *   walletAddress: "0x<your_address>",
	 *   cursor: 0,
	 *   limit: 10
	 * });
	 * console.log(events);
	 * ```
	 */
	public async getInteractionEvents(inputs: ApiRouterTradeEventsBody) {
		return this.fetchApiIndexerEvents<
			RouterTradeEvent,
			ApiRouterTradeEventsBody
		>("events-by-user", inputs);
	}
}

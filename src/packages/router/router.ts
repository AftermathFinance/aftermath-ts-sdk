import {
	ApiRouterCompleteTradeRouteBody,
	ApiRouterTransactionForCompleteTradeRouteBody,
	CoinType,
	RouterCompleteTradeRoute,
	SuiNetwork,
	ApiRouterTradeEventsBody,
	RouterTradeEvent,
	Balance,
	ApiRouterPartialCompleteTradeRouteBody,
	ApiRouterAddTransactionForCompleteTradeRouteBody,
	ApiRouterAddTransactionForCompleteTradeRouteResponse,
	ApiRouterAddTransactionForCompleteTradeRouteV0Body,
	ApiRouterAddTransactionForCompleteTradeRouteV0Response,
	ModuleName,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Transaction } from "@mysten/sui/transactions";
import { TransactionBlock } from "@mysten/sui.js/transactions";

/**
 * @class Router Provider
 *
 * @example
 * ```
 * // Create provider
 * const router = (new Aftermath("MAINNET")).Router();
 * // Call sdk
 * const supportedCoins = await router.getSupportedCoins();
 * ```
 */
export class Router extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		/**
		 * Max fee percentage that third parties can charge on router trades
		 */
		maxExternalFeePercentage: 0.5, // 50%
	};

	private static readonly moveErrors: Record<
		ModuleName,
		Record<number, string>
	> = {
		protocol_fee: {
			/// A non-one-time-witness type has been provided to the `ProtocolFeeConfig`'s `create` function.
			1: "Protocol Fee Config Already Created",
			/// Occurs when `change_fee` is called more than once during the same Epoch.
			2: "Bad Epoch",
			/// A user provided a new protocol fees that do not sum to one.
			3: "Not Normalized",
		},
		router: {
			0: "Not Authorized",
			1: "Invalid Coin In",
			2: "Invalid Coin Out",
			4: "Invalid Previous Swap",
			5: "Invalid Slippage",
			/// A route is constructed that bypasses one of `begin_router_tx_and_pay_fees` or
			///  `end_router_tx_and_pay_fees`.
			6: "No Fees Paid",
		},
		version: {
			/// A user tries to interact with an old contract.
			0: "Invalid Version",
		},
		admin: {
			/// Admin has not authorized the calling shared object to acess a permissioned function.
			0: "Not Authorized",
			/// Admin has already authorized the calling shared object to acess a permissioned function.
			1: "Already Authorized",
		},

		// protocol_fee: {
		// 	1: "A non-one-time-witness type has been provided to the `ProtocolFeeConfig`'s `create` function.",
		// 	2: "Occurs when `change_fee` is called more than once during the same Epoch.",
		// 	3: "A user provided a new protocol fees that do not sum to one.",
		// },
		// router: {
		// 	0: "ENotAuthorized",
		// 	1: "EInvalidCoinIn",
		// 	2: "EInvalidCoinOut",
		// 	4: "EInvalidPreviousSwap",
		// 	5: "EInvalidSlippage",
		// 	6: "A route is constructed that bypasses one of `begin_router_tx_and_pay_fees` or `end_router_tx_and_pay_fees`.",
		// },
		// version: {
		// 	0: "A user tries to interact with an old contract.",
		// },
		// admin: {
		// 	0: "Admin has not authorized the calling shared object to acess a permissioned function.",
		// 	1: "Admin has already authorized the calling shared object to acess a permissioned function.",
		// },
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates `Router` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Router` instance
	 */
	constructor(public readonly network?: SuiNetwork) {
		super(network, "router");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Retrieves the total volume in the last 24 hours.
	 * @returns A Promise that resolves to a number representing the total volume.
	 */
	public getVolume24hrs = async (): Promise<number> => {
		return this.fetchApi("volume-24hrs");
	};

	public async getSupportedCoins() {
		return this.fetchApi<CoinType[]>("supported-coins");
	}

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
	 * Creates route across multiple pools and protocols for best trade execution price
	 *
	 * @param inputs - Details for router to construct trade route
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
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
	 * Creates route across multiple pools and protocols for best trade execution price
	 *
	 * @param inputs - Details for router to construct trade route
	 * @param abortSignal - Optional signal to abort passed to fetch call
	 * @returns Routes, paths, and amounts of each smaller trade within complete trade
	 */
	public async getCompleteTradeRouteGivenAmountOut(
		inputs: ApiRouterPartialCompleteTradeRouteBody & {
			/**
			 * Amount of coin expected to receive
			 */
			coinOutAmount: Balance;
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

	public async getTransactionForCompleteTradeRoute(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransaction<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade",
			inputs
		);
	}

	public async getTransactionForCompleteTradeRouteV0(
		inputs: ApiRouterTransactionForCompleteTradeRouteBody
	) {
		return this.fetchApiTransactionV0<ApiRouterTransactionForCompleteTradeRouteBody>(
			"transactions/trade-v0",
			inputs
		);
	}

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

	public async addTransactionForCompleteTradeRouteV0(
		inputs: Omit<
			ApiRouterAddTransactionForCompleteTradeRouteV0Body,
			"serializedTx"
		> & {
			tx: TransactionBlock;
		}
	) {
		const { tx, ...otherInputs } = inputs;
		const { tx: newTx, coinOutId } = await this.fetchApi<
			ApiRouterAddTransactionForCompleteTradeRouteV0Response,
			ApiRouterAddTransactionForCompleteTradeRouteV0Body
		>("transactions/add-trade-v0", {
			...otherInputs,
			serializedTx: tx.serialize(),
		});
		return {
			tx: TransactionBlock.from(newTx),
			coinOutId,
		};
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getTradeEvents(inputs: ApiRouterTradeEventsBody) {
		return this.fetchApiEvents<RouterTradeEvent>("events/trade", inputs);
	}
}

import {
	AnyObjectType,
	Balance,
	Percentage,
	Event,
	Slippage,
	ApiEventsBody,
	ObjectId,
	SuiAddress,
	TxBytes,
	BigIntAsString,
	SerializedTransaction,
	ExternalFee,
	IFixedAsString,
	IFixed,
	ApiIndexerEventsBody,
} from "../../general/types/generalTypes";
import { CoinType, ServiceCoinData } from "../coin/coinTypes";
import { TransactionObjectArgument } from "@mysten/sui/transactions";

/**
 * A unique identifier, typically used to track items or route segments.
 */
export type UniqueId = string;

/**
 * **Deprecated**. Please use `ExternalFee` instead.
 *
 * Fee info for third party packages wanting to fee route transactions.
 */
export type RouterExternalFee = ExternalFee;

/**
 * All possible DEX protocols that the `Router` can use to swap coins.
 */
export type RouterProtocolName =
	| "Aftermath"
	| "BlueMove"
	| "Cetus"
	| "DeepBook"
	| "DeepBookV3"
	| "DoubleUpPump"
	| "FlowX"
	| "FlowXClmm"
	| "HopFun"
	| "Kriya"
	| "KriyaClmm"
	| "Magma"
	| "Metastable"
	| "MovePump"
	| "Obric"
	| "SuiSwap"
	| "Turbos"
	| "SpringSui"
	| "Steamm"
	| "SuiAi"
	// | "AftermathLsd"
	| "Bluefin"
	| "TurbosFun";

/**
 * Represents a complete trade route object. Includes all relevant information
 * for executing a trade from `coinIn` to `coinOut` through one or more protocols.
 */
export type RouterCompleteTradeRoute = RouterTradeInfo & {
	/**
	 * An array of sub-routes, each representing a path or series of swaps.
	 */
	routes: RouterTradeRoute[];
	/**
	 * The total trade fee percentage across all routes.
	 * @remarks 0.01 = 1%
	 */
	netTradeFeePercentage: Percentage;
	/**
	 * Optional referrer address, if using a referral mechanism.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional external fee information, if a third party is collecting fees.
	 */
	externalFee?: ExternalFee;
	/**
	 * Slippage tolerance for the trade, expressed as a decimal (0.01 = 1%).
	 */
	slippage?: Slippage;
};

/**
 * **Deprecated**. Please use `RouterCompleteTradeRoute` instead.
 *
 * Represents a complete trade route object, including fee info.
 */
export type RouterCompleteTradeRouteWithFee = RouterCompleteTradeRoute;

/**
 * Represents a sub-route of a complete trade, describing the portion
 * and the paths used. Each sub-route may involve one or more specific pools.
 */
export type RouterTradeRoute = RouterTradeInfo & {
	/**
	 * An array of paths that this route will take to execute the trade.
	 */
	paths: RouterTradePath[];
	/**
	 * The portion of the total trade allocated to this route, expressed as an IFixed value.
	 */
	portion: IFixed;
};

/**
 * Represents an individual path within a route. Typically corresponds to
 * a specific DEX pool and the swap details in that pool.
 */
export type RouterTradePath = RouterTradeInfo & {
	/**
	 * The name of the DEX protocol used for this path (e.g., "Cetus").
	 */
	protocolName: RouterProtocolName;
	/**
	 * The pool ID (object on-chain) where the swap is performed.
	 */
	poolId: ObjectId;
	/**
	 * Additional pool metadata, which can vary by DEX protocol.
	 */
	poolMetadata: any;
};

/**
 * Base interface shared by routes and paths, describing the coin in/out details and spot price.
 */
export interface RouterTradeInfo {
	/**
	 * Input coin details, including type, amount, and any trade fee.
	 */
	coinIn: RouterTradeCoin;
	/**
	 * Output coin details, including type, amount, and any trade fee.
	 */
	coinOut: RouterTradeCoin;
	/**
	 * The spot price used in this route/path for calculating output from input.
	 */
	spotPrice: number;
}

/**
 * Represents a coin and the associated amount and trade fee for a route or path.
 */
export interface RouterTradeCoin {
	/**
	 * The coin type used in a route or path.
	 */
	type: CoinType;
	/**
	 * The amount of the coin, typically expressed as the smallest unit (bigint).
	 */
	amount: Balance;
	/**
	 * The trade fee paid in this coin, expressed as a bigint.
	 */
	tradeFee: Balance;
}

/**
 * Event that occurs when a user executes a trade route via the router.
 */
export interface RouterTradeEvent extends Event {
	/**
	 * The Sui address of the trader.
	 */
	trader: SuiAddress;
	/**
	 * The coin type input by the trader.
	 */
	coinInType: AnyObjectType;
	/**
	 * The amount of coin input by the trader.
	 */
	coinInAmount: Balance;
	/**
	 * The coin type output to the trader.
	 */
	coinOutType: AnyObjectType;
	/**
	 * The amount of coin output to the trader.
	 */
	coinOutAmount: Balance;
}

/**
 * Basic body for partial router route construction, specifying coin types
 * and optional third-party fee or referral info.
 */
export type ApiRouterPartialCompleteTradeRouteBody = {
	/**
	 * The coin type that the user wants to swap out.
	 */
	coinInType: CoinType;
	/**
	 * The coin type that the user wants to receive.
	 */
	coinOutType: CoinType;
	/**
	 * An optional referrer address for the route creator.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional third-party fee details.
	 */
	externalFee?: ExternalFee;
} & (
	| {
			/**
			 * Optionally exclude certain protocols from routing.
			 */
			protocolBlacklist?: RouterProtocolName[];
	  }
	| {
			/**
			 * Optionally include only certain protocols in routing.
			 */
			protocolWhitelist?: RouterProtocolName[];
	  }
);

/**
 * Full body for router route construction. Either `coinInAmount` or `coinOutAmount`
 * must be specified, not both. If `coinOutAmount` is given, `slippage` is required.
 */
export type ApiRouterCompleteTradeRouteBody =
	ApiRouterPartialCompleteTradeRouteBody &
		(
			| {
					/**
					 * The amount of coin that the user wants to swap out.
					 */
					coinInAmount: Balance;
			  }
			| {
					/**
					 * The target output amount that the user wants to receive.
					 */
					coinOutAmount: Balance;
					/**
					 * The user’s slippage tolerance (e.g., 0.01 = 1%).
					 */
					slippage: Slippage;
			  }
		);

/**
 * Represents the information needed to create a transaction for a complete trade route.
 */
export interface ApiRouterTransactionForCompleteTradeRouteBody {
	/**
	 * The Sui address initiating the trade.
	 */
	walletAddress: SuiAddress;
	/**
	 * The complete route object, typically returned by the route construction API.
	 */
	completeRoute: RouterCompleteTradeRoute;
	/**
	 * The allowable slippage tolerance for the entire route.
	 */
	slippage: Slippage;
	/**
	 * If `true`, indicates that the transaction fees may be sponsored by a third party.
	 */
	isSponsoredTx?: boolean;
	/**
	 * If specified, the traded output coins will be sent to this address.
	 */
	customRecipient?: SuiAddress;
}

/**
 * Extended body that includes a serialized transaction for building a new
 * transaction with a trade route appended.
 */
export type ApiRouterAddTransactionForCompleteTradeRouteBody =
	ApiRouterTransactionForCompleteTradeRouteBody & {
		/**
		 * The already-serialized transaction to which the router instructions will be added.
		 */
		serializedTx: SerializedTransaction;
		/**
		 * Optional coin input ID if you are managing coin objects yourself.
		 */
		coinInId?: TransactionObjectArgument;
	};

/**
 * The response returned after adding a trade route to an existing transaction.
 */
export interface ApiRouterAddTransactionForCompleteTradeRouteResponse {
	/**
	 * The updated serialized transaction.
	 */
	tx: SerializedTransaction;
	/**
	 * A reference to the output coin after the swap. May be undefined if not applicable.
	 */
	coinOutId: TransactionObjectArgument | undefined;
}

/**
 * Body type used for retrieving router trade events for a particular user
 * from the indexer, with pagination.
 */
export type ApiRouterTradeEventsBody = ApiIndexerEventsBody & {
	/**
	 * The wallet address whose trade events you want to retrieve.
	 */
	walletAddress: SuiAddress;
};

/**
 * Represents data needed for dynamically estimating gas costs for a router trade,
 * including the coin type for gas, the coin amount out, sender address, and
 * an optional referrer or sponsor address.
 */
export interface ApiRouterDynamicGasBody {
	/**
	 * The transaction bytes for the intended trade.
	 */
	txKindBytes: TxBytes;
	/**
	 * The coin type to be used for gas (e.g., "0x2::sui::SUI").
	 */
	gasCoinType: CoinType;
	/**
	 * The coin data specifying the gas coin or a partial reference to it.
	 */
	gasCoinData: ServiceCoinData;
	/**
	 * The amount of coin that the user expects to receive out of the trade, in string form for BigInt.
	 */
	coinOutAmount: BigIntAsString;
	/**
	 * The address of the sender who is initiating the transaction.
	 */
	senderAddress: SuiAddress;
	/**
	 * The address of a sponsor for the transaction, if applicable.
	 */
	sponsorAddress: SuiAddress;
	/**
	 * Optional referrer address, if a referral mechanism is in place.
	 */
	referrer?: SuiAddress;
}

import type { TransactionObjectArgument } from "@mysten/sui/transactions";
import type {
	AnyObjectType,
	ApiIndexerEventsBody,
	Balance,
	BigIntAsString,
	Event,
	ExternalFee,
	IFixed,
	ObjectId,
	Percentage,
	SerializedTransaction,
	Slippage,
	SuiAddress,
	TxBytes,
} from "../../general/types/generalTypes";
import type { CoinType, ServiceCoinData } from "../coin/coinTypes";

/**
 * A string identifier used by route and market records.
 */
export type UniqueId = string;

/**
 * **Deprecated**. Please use `ExternalFee` instead.
 *
 * Fee info for third party packages wanting to fee route transactions.
 */
export type RouterExternalFee = ExternalFee;

/**
 * DEX protocol names accepted by the router's allowlist and blocklist fields.
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
	| "FullSail"
	| "HopFun"
	| "Kriya"
	| "KriyaClmm"
	| "Magma"
	| "Metastable"
	| "Momentum"
	| "MovePump"
	| "Obric"
	| "SuiSwap"
	| "Turbos"
	| "SpringSui"
	| "Steamm"
	| "SuiAi"
	// | "AftermathLsd"
	| "Bluefin"
	| "TurbosFun"
	| "BlastFun"
	| "Bolt";

/**
 * Represents a complete trade route object. Includes all relevant information
 * for executing a trade from `coinIn` to `coinOut` through one or more protocols.
 */
export type RouterCompleteTradeRoute = RouterTradeInfo & {
	/**
	 * The sub-routes that make up the trade. Multiple entries represent a split
	 * trade, and each route can contain several sequential paths.
	 */
	routes: RouterTradeRoute[];
	/**
	 * The aggregate DEX trade fee as a decimal fraction. `0.01` represents 1%.
	 */
	netTradeFeePercentage: Percentage;
	/**
	 * The optional referrer recorded for the route. The transaction builder uses
	 * this address when the route was requested with referral support.
	 */
	referrer?: SuiAddress;
	/**
	 * An optional third-party fee. `feePercentage` is a decimal fraction of the
	 * trade, and the recipient receives that fee when the route executes.
	 */
	externalFee?: ExternalFee;
	/**
	 * The slippage tolerance attached to the route, as a decimal fraction. `0.01`
	 * represents 1%. It is optional for amount-in route responses.
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
	 * The sequential swap paths used by this sub-route. A path's output feeds the
	 * next path's input.
	 */
	paths: RouterTradePath[];
	/**
	 * The fraction of the complete trade allocated to this sub-route, encoded as
	 * an `IFixed` value. `1_000_000_000_000_000_000n` represents the whole trade.
	 */
	portion: IFixed;
};

/**
 * Represents an individual path within a route. Typically corresponds to
 * a specific DEX pool and the swap details in that pool.
 */
export type RouterTradePath = RouterTradeInfo & {
	/**
	 * The DEX protocol used for this path, such as `"Cetus"`.
	 */
	protocolName: RouterProtocolName;
	/**
	 * The on-chain pool or market object ID used by the path.
	 */
	poolId: ObjectId;
	/**
	 * Protocol-specific pool metadata returned by the router. Treat this value
	 * as opaque unless the selected protocol documents its shape.
	 */
	poolMetadata: any;
};

/**
 * Base data shared by routes and paths, describing coin amounts and spot price.
 */
export interface RouterTradeInfo {
	/**
	 * Input coin type, amount, and fee for this route, sub-route, or path.
	 */
	coinIn: RouterTradeCoin;
	/**
	 * Output coin type, amount, and fee for this route, sub-route, or path.
	 */
	coinOut: RouterTradeCoin;
	/**
	 * The price quoted for `coinIn` in terms of `coinOut`, before execution movement.
	 */
	spotPrice: number;
}

/**
 * Represents a coin and the associated amount and trade fee for a route or path.
 */
export interface RouterTradeCoin {
	/**
	 * The fully qualified Sui coin type.
	 */
	type: CoinType;
	/**
	 * The amount in the coin's smallest unit. The JSON API encodes this `bigint`
	 * as a string ending in `n`, and the SDK restores it to `bigint`.
	 */
	amount: Balance;
	/**
	 * The trade fee charged in this coin's smallest unit.
	 */
	tradeFee: Balance;
}

/**
 * Event that occurs when a user executes a trade route via the router.
 */
export interface RouterTradeEvent extends Event {
	/**
	 * The Sui address that executed the routed trade.
	 */
	trader: SuiAddress;
	/**
	 * The input coin type.
	 */
	coinInType: AnyObjectType;
	/**
	 * The input amount in the coin's smallest unit.
	 */
	coinInAmount: Balance;
	/**
	 * The output coin type.
	 */
	coinOutType: AnyObjectType;
	/**
	 * The output amount in the coin's smallest unit.
	 */
	coinOutAmount: Balance;
}

/**
 * Basic body for partial router route construction, specifying coin types
 * and optional third-party fee or referral info.
 */
export type ApiRouterPartialCompleteTradeRouteBody = {
	/**
	 * The fully qualified Sui type of the coin supplied to the route.
	 */
	coinInType: CoinType;
	/**
	 * The fully qualified Sui type of the coin received from the route.
	 */
	coinOutType: CoinType;
	/**
	 * An optional referrer address to include in the route and later referral
	 * transaction setup.
	 */
	referrer?: SuiAddress;
	/**
	 * Optional third-party fee details. The router rejects values above
	 * `Router.constants.maxExternalFeePercentage`.
	 */
	externalFee?: ExternalFee;
} & (
	| {
			/**
			 * Protocols that the router must not use.
			 */
			protocolBlacklist?: RouterProtocolName[];
	  }
	| {
			/**
			 * Protocols that the router may use. Other protocols are excluded.
			 */
			protocolWhitelist?: RouterProtocolName[];
	  }
) &
	(
		| {
				/**
			 * Pool IDs that the router must not use.
			 */
				poolBlacklist?: ObjectId[];
		  }
		| {
				/**
			 * Pool IDs that the router may use. Other pools are excluded.
			 */
				poolWhitelist?: ObjectId[];
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
					 * The input amount in the input coin's smallest unit. This selects
					 * exact-input route construction.
					 */
					coinInAmount: Balance;
			  }
			| {
					/**
					 * The target output amount in the output coin's smallest unit. This
					 * selects exact-output route construction.
					 */
					coinOutAmount: Balance;
					/**
					 * The maximum decimal fraction of output or input movement accepted
					 * by the exact-output route. `0.01` represents 1%.
					 */
					slippage: Slippage;
			  }
		);

/**
 * Represents the information needed to create a transaction for a complete trade route.
 */
export interface ApiRouterTransactionForCompleteTradeRouteBody {
	/**
	 * The Sui address that owns the input coin and signs the trade transaction.
	 */
	walletAddress: SuiAddress;
	/**
	 * The route returned by `getCompleteTradeRouteGivenAmountIn` or
	 * `getCompleteTradeRouteGivenAmountOut`.
	 */
	completeRoute: RouterCompleteTradeRoute;
	/**
	 * The allowable slippage for the complete route, as a decimal fraction.
	 * `0.01` represents 1%.
	 */
	slippage: Slippage;
	/**
	 * When `true`, asks the API to build a transaction compatible with sponsored
	 * gas handling.
	 */
	isSponsoredTx?: boolean;
	/**
	 * An optional recipient for the output coin instead of the wallet sender.
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
		 * The base64 `TransactionKind` to which the router commands are added.
		 * The SDK builds this from a `Transaction` before sending it over JSON.
		 */
		txKind: SerializedTransaction;
		/**
		 * An optional transaction object argument for the input coin. Omit it when
		 * the API should select the coin input.
		 */
		coinInId?: TransactionObjectArgument;
	};

/**
 * The response returned after adding a trade route to an existing transaction.
 */
export interface ApiRouterAddTransactionForCompleteTradeRouteResponse {
	/**
	 * The updated base64 `TransactionKind`. The SDK parses this into a new
	 * `Transaction` before returning from `Router.addTransactionForCompleteTradeRoute`.
	 */
	txKind: SerializedTransaction;
	/**
	 * A transaction object argument for the output coin, or `undefined` when the
	 * response does not expose one.
	 */
	coinOutId: TransactionObjectArgument | undefined;
}

/**
 * Body type used for retrieving router trade events for a particular user
 * from the indexer, with pagination.
 */
export type ApiRouterTradeEventsBody = ApiIndexerEventsBody & {
	/**
	 * The wallet address whose router trade events should be returned.
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
	 * The transaction-kind bytes for the intended trade.
	 */
	txKindBytes: TxBytes;
	/**
	 * The coin type used to pay gas, such as `"0x2::sui::SUI"`.
	 */
	gasCoinType: CoinType;
	/**
	 * The service coin record used to select the gas coin.
	 */
	gasCoinData: ServiceCoinData;
	/**
	 * The expected output amount in the output coin's smallest unit, encoded as
	 * a decimal bigint string.
	 */
	coinOutAmount: BigIntAsString;
	/**
	 * The address that signs the transaction.
	 */
	senderAddress: SuiAddress;
	/**
	 * The address sponsoring gas for the transaction.
	 */
	sponsorAddress: SuiAddress;
	/**
	 * An optional referrer address used by the referral-aware gas estimate.
	 */
	referrer?: SuiAddress;
}

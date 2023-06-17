import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterCompleteTradeRoute,
	RouterExternalFee,
	RouterProtocolName,
	RouterSerializablePool,
	RouterTradeEvent,
} from "../routerTypes";
import {
	AnyObjectType,
	Balance,
	CoinType,
	EventsInputs,
	PoolsAddresses,
	ReferralVaultAddresses,
	RequiredRouterAddresses,
	Slippage,
} from "../../../types";
import { createRouterPool } from "../utils/synchronous/interfaces/routerPoolInterface";
import { Router } from "../router";
import { RouterApiInterface } from "../utils/synchronous/interfaces/routerApiInterface";
import { PoolsApi } from "../../pools/api/poolsApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { Casting, Helpers } from "../../../general/utils";
import { CetusApi } from "../../external/cetus/cetusApi";
import { TurbosApi } from "../../external/turbos/turbosApi";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { RouterApiCasting } from "./routerApiCasting";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes";
import { InterestApi } from "../../external/interest/interestApi";
import { KriyaApi } from "../../external/kriya/kriyaApi";
import { BaySwapApi } from "../../external/baySwap/baySwapApi";
import { SuiswapApi } from "../../external/suiswap/suiswapApi";
import { BlueMoveApi } from "../../external/blueMove/blueMoveApi";

export class RouterSynchronousApiHelpers {
	// =========================================================================
	//  Constants
	// =========================================================================

	private readonly protocolNamesToApi: Record<
		RouterProtocolName,
		() => RouterApiInterface<any>
	> = {
		Aftermath: () => new PoolsApi(this.Provider),
		DeepBook: () => new DeepBookApi(this.Provider),
		Cetus: () => new CetusApi(this.Provider),
		Turbos: () => new TurbosApi(this.Provider),
		Interest: () => new InterestApi(this.Provider),
		Kriya: () => new KriyaApi(this.Provider),
		BaySwap: () => new BaySwapApi(this.Provider),
		Suiswap: () => new SuiswapApi(this.Provider),
		BlueMove: () => new BlueMoveApi(this.Provider),
	};

	public static readonly constants = {
		moduleNames: {
			swapCap: "swap_cap",
		},
		eventNames: {
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		router: RequiredRouterAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	public readonly eventTypes: {
		routerTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const router = this.Provider.addresses.router;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!router || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			router,
			pools,
			referralVault,
		};

		this.eventTypes = {
			routerTrade: this.routerTradeEventType(),
		};
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (inputs: {
		protocols: RouterProtocolName[];
	}): Promise<RouterSerializablePool[]> => {
		const apis = this.protocolApisFromNames(inputs);

		const poolsByProtocol = await Promise.all(
			apis.map((api) => api.fetchAllPools())
		);

		const pools = poolsByProtocol.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);

		return pools;
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchSupportedCoins = async (inputs: {
		protocols: RouterProtocolName[];
	}): Promise<CoinType[]> => {
		const apis = this.protocolApisFromNames({
			protocols: inputs.protocols,
		});

		const arrayOfArraysOfCoins = await Promise.all(
			apis.map((api) => api.fetchSupportedCoins())
		);

		const allCoins = arrayOfArraysOfCoins.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);
		const coins = Helpers.uniqueArray(allCoins);

		return coins;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public obtainRouterCapTx = (inputs: {
		tx: TransactionBlock;
		coinInId: ObjectId | TransactionArgument;
		minAmountOut: Balance;
		coinInType: CoinType;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}) /* (RouterSwapCap) */ => {
		const {
			tx,
			coinInId,
			minAmountOut,
			coinInType,
			coinOutType,
			referrer,
			externalFee,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"obtain_router_cap"
			),
			typeArguments: [coinInType, coinOutType],
			arguments: [
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_in
				tx.pure(minAmountOut, "u64"), // min_amount_out
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				), // referrer
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee?.recipient
					),
					"Option<address>"
				), // router_fee_recipient
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee
							? Casting.numberToFixedBigInt(
									externalFee.feePercentage
							  )
							: undefined
					),
					"Option<u64>"
				), // router_fee
			],
		});
	};

	public initiatePathTx = (inputs: {
		tx: TransactionBlock;
		routerSwapCap: TransactionArgument;
		coinInAmount: Balance;
		coinInType: CoinType;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"initiate_path"
			),
			typeArguments: [inputs.coinInType],
			arguments: [
				inputs.routerSwapCap, // RouterSwapCap
				tx.pure(inputs.coinInAmount, "u64"),
			],
		});
	};

	public returnRouterCapTx = (inputs: {
		tx: TransactionBlock;
		routerSwapCap: TransactionArgument;
		coinOutId: ObjectId | TransactionArgument;
		routerSwapCapCoinType: CoinType;
		coinOutType: CoinType;
	}) => {
		const {
			tx,
			routerSwapCap,
			coinOutId,
			routerSwapCapCoinType,
			coinOutType,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"return_router_cap"
			),
			typeArguments: [routerSwapCapCoinType, coinOutType],
			arguments: [
				routerSwapCap, // RouterSwapCap
				typeof coinOutId === "string"
					? tx.object(coinOutId)
					: coinOutId, // coin_out

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
			],
		});
	};

	public returnRouterCapAlreadyPayedFeeTx = (inputs: {
		tx: TransactionBlock;
		routerSwapCap: TransactionArgument;
		routerSwapCapCoinType: CoinType;
		coinOutType: CoinType;
	}) => {
		const { tx, routerSwapCap, routerSwapCapCoinType, coinOutType } =
			inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.router.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
				"return_router_cap_already_payed_fee"
			),
			typeArguments: [routerSwapCapCoinType, coinOutType],
			arguments: [
				routerSwapCap, // RouterSwapCap
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public async fetchBuildTransactionForCompleteTradeRoute(inputs: {
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<TransactionBlock> {
		const { walletAddress, completeRoute, slippage } = inputs;

		const referrer = completeRoute.referrer;
		const externalFee = completeRoute.externalFee;
		if (
			externalFee &&
			externalFee.feePercentage >=
				Router.constants.maxExternalFeePercentage
		)
			throw new Error(
				`external fee percentage exceeds max of ${Router.constants.maxExternalFeePercentage}`
			);

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const startCoinInId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: completeRoute.coinIn.type,
			coinAmount: completeRoute.coinIn.amount,
		});

		const minAmountOut =
			completeRoute.coinOut.amount -
			BigInt(Math.floor(slippage * Number(completeRoute.coinOut.amount)));

		const routerSwapCapCoinType = completeRoute.coinIn.type;
		const routerSwapCap = this.obtainRouterCapTx({
			tx,
			coinInId: startCoinInId,
			coinInType: completeRoute.coinIn.type,
			coinOutType: completeRoute.coinOut.type,
			referrer,
			externalFee,
			minAmountOut,
		});

		let coinsOut: TransactionArgument[] = [];

		for (const [, route] of completeRoute.routes.entries()) {
			let coinInId: TransactionArgument | undefined = this.initiatePathTx(
				{
					tx,
					routerSwapCap,
					coinInAmount: route.coinIn.amount,
					coinInType: route.coinIn.type,
				}
			);

			for (const [, path] of route.paths.entries()) {
				const poolForPath = createRouterPool({
					pool: path.pool,
					network: "",
				});

				if (!coinInId)
					throw new Error(
						"no coin in argument given for router trade command"
					);

				const newCoinInId = poolForPath.tradeTx({
					provider: this.Provider,
					tx,
					coinInId,
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
					expectedCoinOutAmount: path.coinOut.amount,
					routerSwapCapCoinType,
					routerSwapCap,
				});

				coinInId =
					poolForPath.noHopsAllowed &&
					poolForPath.protocolName !== "Cetus"
						? undefined
						: newCoinInId;
			}

			if (coinInId) coinsOut.push(coinInId);
		}

		let coinOutId: undefined | TransactionArgument = undefined;

		if (coinsOut.length > 0) {
			coinOutId = coinsOut[0];

			// merge all coinsOut into a single coin
			if (coinsOut.length > 1)
				tx.mergeCoins(coinOutId, coinsOut.slice(1));
		}

		if (coinOutId) {
			this.returnRouterCapTx({
				tx,
				routerSwapCap,
				routerSwapCapCoinType,
				coinOutType: completeRoute.coinOut.type,
				coinOutId,
			});
			tx.transferObjects([coinOutId], tx.pure(walletAddress, "address"));
		} else {
			this.returnRouterCapAlreadyPayedFeeTx({
				tx,
				routerSwapCap,
				routerSwapCapCoinType,
				coinOutType: completeRoute.coinOut.type,
			});
		}

		return tx;
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchTradeEvents = async (
		inputs: {
			walletAddress: SuiAddress;
		} & EventsInputs
	) => {
		return await this.Provider.Events().fetchCastEventsWithCursor<
			RouterTradeEventOnChain,
			RouterTradeEvent
		>({
			...inputs,
			query: {
				// And: [
				// 	{
				MoveEventType: this.eventTypes.routerTrade,
				// 	},
				// 	{
				// 		Sender: inputs.walletAddress,
				// 	},
				// ],
			},
			eventFromEventOnChain: RouterApiCasting.routerTradeEventFromOnChain,
		});
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private protocolApisFromNames = (inputs: {
		protocols: RouterProtocolName[];
	}): RouterApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};

	// =========================================================================
	//  Event Types
	// =========================================================================

	private routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.router.packages.utils,
			RouterSynchronousApiHelpers.constants.moduleNames.swapCap,
			RouterSynchronousApiHelpers.constants.eventNames.routerTrade
		);
}

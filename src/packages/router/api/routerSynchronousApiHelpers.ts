import {
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
	};

	public static readonly constants = {
		moduleNames: {
			events: "router_events",
		},
		eventNames: {
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: RequiredRouterAddresses;

	public readonly eventTypes: {
		routerTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = Provider.addresses.router;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		// @ts-ignore
		this.addresses = addresses;

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

	public bakePotatoTx = (inputs: {
		tx: TransactionBlock;
		coinInType: CoinType;
		coinOutType: CoinType;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}) /* SwapPotato */ => {
		const { tx, coinInType, coinOutType, referrer, externalFee } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.events,
				"bake_potato"
			),
			typeArguments: [],
			arguments: [
				tx.pure(
					Casting.u8VectorFromString(coinInType.replace("0x", "")),
					"vector<u8>"
				), // type_in
				tx.pure(
					Casting.u8VectorFromString(coinOutType.replace("0x", "")),
					"vector<u8>"
				), // type_out
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				), // referrer
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
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee?.recipient
					),
					"Option<address>"
				), // router_fee_recipient
			],
		});
	};

	public consumePotatoTx = (inputs: {
		tx: TransactionBlock;
		tradePotato: TransactionArgument;
		trader: SuiAddress;
		minAmountOut: Balance;
	}) => {
		const { tx, tradePotato, trader, minAmountOut } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.utils,
				RouterSynchronousApiHelpers.constants.moduleNames.events,
				"try_consume_potato"
			),
			typeArguments: [],
			arguments: [
				tradePotato, // SwapPotato
				tx.pure(trader, "address"), // swapper
				tx.pure(minAmountOut, "u64"), // min_amount_out
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

		const tradePotato = this.bakePotatoTx({
			tx,
			coinInType: completeRoute.coinIn.type,
			coinOutType: completeRoute.coinOut.type,
			referrer,
			externalFee,
		});

		const coinInArg = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: completeRoute.coinIn.type,
			coinAmount: completeRoute.coinIn.amount,
		});

		let coinsOut: TransactionArgument[] = [];

		let splitCoins: TransactionArgument[] = [];
		if (completeRoute.routes.length > 1) {
			splitCoins = tx.add({
				kind: "SplitCoins",
				coin: coinInArg,
				amounts: completeRoute.routes
					.slice(1)
					.map((route) => tx.pure(route.coinIn.amount)),
			});
		}

		for (const [routeIndex, route] of completeRoute.routes.entries()) {
			const splitCoinArg =
				routeIndex === 0 ? coinInArg : splitCoins[routeIndex - 1];

			let coinIn: TransactionArgument | undefined = splitCoinArg;

			for (const [pathIndex, path] of route.paths.entries()) {
				const poolForPath = createRouterPool({
					pool: path.pool,
					network: "",
				});

				if (!coinIn)
					throw new Error(
						"no coin in argument given for router trade command"
					);

				const isFirstSwapForPath = pathIndex === 0;
				const isLastSwapForPath = pathIndex === route.paths.length - 1;

				const newCoinIn = poolForPath.tradeTx({
					provider: this.Provider,
					tx,
					coinIn,
					coinInAmount: route.coinIn.amount,
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
					expectedCoinOutAmount: path.coinOut.amount,
					slippage,
					referrer,
					externalFee,
					tradePotato,
					isFirstSwapForPath,
					isLastSwapForPath,
				});

				coinIn =
					poolForPath.noHopsAllowed &&
					poolForPath.protocolName !== "Cetus"
						? undefined
						: newCoinIn;
			}

			if (coinIn) coinsOut.push(coinIn);
		}

		if (coinsOut.length > 0) {
			const coinOut = coinsOut[0];

			// merge all coinsOut into a single coin
			if (coinsOut.length > 1) tx.mergeCoins(coinOut, coinsOut.slice(1));

			if (externalFee) {
				const feeAmount =
					externalFee.feePercentage *
					Number(completeRoute.coinOut.amount);

				const [feeCoin] = tx.add({
					kind: "SplitCoins",
					coin: coinOut,
					amounts: [tx.pure(feeAmount)],
				});
				tx.transferObjects([feeCoin], tx.pure(externalFee.recipient));
			}

			tx.transferObjects([coinOut], tx.pure(walletAddress));
		}

		const minAmountOut =
			completeRoute.coinOut.amount -
			BigInt(Math.floor(slippage * Number(completeRoute.coinOut.amount)));

		this.consumePotatoTx({
			tx,
			tradePotato,
			trader: walletAddress,
			minAmountOut,
		});

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
			this.addresses.packages.utils,
			RouterSynchronousApiHelpers.constants.moduleNames.events,
			RouterSynchronousApiHelpers.constants.eventNames.routerTrade
		);
}

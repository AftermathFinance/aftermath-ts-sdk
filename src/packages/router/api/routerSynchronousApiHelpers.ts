import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterCompleteTradeRoute,
	RouterExternalFee,
	RouterProtocolName,
	RouterSerializableCompleteGraph,
	RouterSerializablePool,
	RouterSynchronousProtocolName,
	RouterSynchronousSerializablePool,
} from "../routerTypes";
import { Balance, CoinType, Slippage, SuiNetwork, Url } from "../../../types";
import { createRouterPool } from "../utils/synchronous/interfaces/routerPoolInterface";
import { Router } from "../router";
import { RouterApiInterface } from "../utils/synchronous/interfaces/routerApiInterface";
import { PoolsApi } from "../../pools/api/poolsApi";
import { NojoAmmApi } from "../../external/nojo/nojoAmmApi";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { Helpers } from "../../../general/utils";
import { CetusApi } from "../../external/cetus/cetusApi";
import { RouterGraph } from "../utils/synchronous/routerGraph";

export class RouterSynchronousApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private readonly protocolNamesToApi: Record<
		RouterProtocolName,
		() => RouterApiInterface<any>
	> = {
		Aftermath: () => new PoolsApi(this.Provider),
		Nojo: () => new NojoAmmApi(this.Provider),
		DeepBook: () => new DeepBookApi(this.Provider),
		Cetus: () => new CetusApi(this.Provider),
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPools = async (inputs: {
		protocols: RouterProtocolName[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<RouterSerializablePool[]> => {
		const apis = this.protocolApisFromNames(inputs);

		const poolsByProtocol = await Promise.all(
			apis.map((api) => api.fetchAllPools(inputs))
		);

		const pools = poolsByProtocol.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);

		return pools;
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

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

	/////////////////////////////////////////////////////////////////////
	//// Transaction Building
	/////////////////////////////////////////////////////////////////////

	public async fetchBuildTransactionForCompleteTradeRoute(inputs: {
		network: SuiNetwork | Url;
		provider: AftermathApi;
		walletAddress: SuiAddress;
		completeRoute: RouterCompleteTradeRoute;
		slippage: Slippage;
	}): Promise<TransactionBlock> {
		const { network, provider, walletAddress, completeRoute, slippage } =
			inputs;

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
			this.Provider.ReferralVault().Helpers.addUpdateReferrerCommandToTransaction(
				{
					tx,
					referrer,
				}
			);

		const coinInArg =
			await this.Provider.Coin().Helpers.fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: completeRoute.coinIn.type,
				coinAmount: completeRoute.coinIn.amount,
			});

		let coinsOut = [];

		for (const route of completeRoute.routes) {
			const [splitCoinArg] = tx.add({
				kind: "SplitCoins",
				coin: coinInArg,
				amounts: [tx.pure(route.coinIn.amount)],
			});

			let coinIn = splitCoinArg;

			for (const path of route.paths) {
				const newCoinIn = createRouterPool({
					pool: path.pool,
					network,
				}).addTradeCommandToTransaction({
					provider,
					tx,
					coinIn,
					coinInAmount: route.coinIn.amount,
					coinInType: path.coinIn.type,
					coinOutType: path.coinOut.type,
					expectedAmountOut: path.coinOut.amount,
					slippage,
					referrer,
				});

				coinIn = newCoinIn;
			}

			coinsOut.push(coinIn);
		}

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

		tx.transferObjects([coinOut, coinInArg], tx.pure(walletAddress));

		return tx;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static amountsInForRouterTrade = (inputs: {
		coinInAmount: Balance;
		partitions: number;
	}): Balance[] => {
		const { coinInAmount, partitions } = inputs;

		const coinInPartitionAmount =
			coinInAmount / BigInt(Math.floor(partitions));
		const coinInRemainderAmount =
			coinInAmount % BigInt(Math.floor(partitions));

		const amountsIn = Array(partitions)
			.fill(0)
			.map((_, index) =>
				index === 0
					? coinInRemainderAmount + coinInPartitionAmount
					: BigInt(1 + index) * coinInPartitionAmount
			);

		return amountsIn;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private protocolApisFromNames = (inputs: {
		protocols: RouterProtocolName[];
	}): RouterApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};
}

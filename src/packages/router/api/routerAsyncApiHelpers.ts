import { SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterAsyncProtocolName,
	RouterAsyncTradeResult,
	RouterAsyncTradeResults,
	RouterCompleteTradeRoute,
	RouterTradePath,
	RouterTradeRoute,
} from "../routerTypes";
import { Balance, CoinType } from "../../../types";
import { RouterAsyncApiInterface } from "../utils/async/routerAsyncApiInterface";
import { CetusApi } from "../../external/cetus/cetusApi";
import { RpcApiHelpers } from "../../../general/api/rpcApiHelpers";
import { Helpers } from "../../../general/utils";

export class RouterAsyncApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private readonly protocolNamesToApi: Record<
		RouterAsyncProtocolName,
		RouterAsyncApiInterface<any>
	> = {
		Cetus: new CetusApi(this.Provider),
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

	public amountsInForRouterTrade = (inputs: {
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

	public fetchTradeResults = async (inputs: {
		protocols: RouterAsyncProtocolName[];
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
	}): Promise<RouterAsyncTradeResults> => {
		const { coinInAmounts, coinInType, coinOutType } = inputs;

		const apis = this.protocolApisFromNames(inputs);

		const results: RouterAsyncTradeResult[] = await Promise.all(
			apis.map(async (api, index) => {
				const pool = await api.fetchPoolForCoinTypes({
					...inputs,
					coinType1: coinInType,
					coinType2: coinOutType,
				});

				const amountsOut = await Promise.all(
					coinInAmounts.map((amountIn) =>
						api.fetchTradeAmountOut({
							...inputs,
							pool,
							walletAddress:
								RpcApiHelpers.constants.devInspectSigner,
							coinInAmount: amountIn,
						})
					)
				);

				return {
					pool,
					amountsOut,
					protocol: inputs.protocols[index],
				};
			})
		);

		return {
			...inputs,
			results,
			coinInAmounts,
		};
	};

	public static splitTradeBetweenRoutes = (inputs: {
		tradeResults: RouterAsyncTradeResults;
		completeRoutes: RouterCompleteTradeRoute[];
	}): {
		RouterCompleteTradeRoute;
	} => {
		const { tradeResults } = inputs;

		let amountsOutIndexes: number[] = Array(
			tradeResults.coinInAmounts.length
		).fill(-1);

		for (const _ of Array(tradeResults.coinInAmounts.length).fill(0)) {
			const incrementalAmountsOut = tradeResults.results.map(
				(result, index) => {
					const prevAmountOutIndex = amountsOutIndexes[index];
					const prevAmountOut =
						prevAmountOutIndex < 0
							? BigInt(0)
							: result.amountsOut[prevAmountOutIndex];

					const currentAmountOut =
						result.amountsOut[prevAmountOutIndex + 1];

					const incrementalAmountOut =
						currentAmountOut - prevAmountOut;

					return incrementalAmountOut;
				}
			);

			const maxIndex = Helpers.indexOfMax(incrementalAmountsOut);

			amountsOutIndexes[maxIndex] += 1;
		}
	};

	private routerCompleteTradeRoutesFromTradeResults = (
		tradeResults: RouterAsyncTradeResults
	) => {
		const routes: RouterTradeRoute[] = tradeResults.results.map(
			(result, index) => {
				const amountOutIndex = amountsOutIndexes[index];
				const path = {
					pool: result.pool,
					protocolName: result.protocol,
					coinIn: {
						type: tradeResults.coinInType,
						amount: tradeResults.coinInAmounts[amountOutIndex],
						tradeFee: BigInt(0),
					},
					coinOut: {
						type: tradeResults.coinInType,
						amount: result.amountsOut[amountOutIndex],
						tradeFee: BigInt(0),
					},
					spotPrice:
						Number(tradeResults.coinInAmounts[0]) /
						Number(result.amountsOut[0]),
				};

				return {
					...path,
					paths: [path],
				};
			}
		);

		const totalAmountIn =
			tradeResults.coinInAmounts[tradeResults.coinInAmounts.length - 1];
		const totalAmountOut = Helpers.sumBigInt(
			routes.map((route) => route.paths[0].coinOut.amount)
		);

		const spotPrice = routes.reduce(
			(acc, cur) =>
				acc +
				(Number(cur.coinIn.amount) / Number(totalAmountIn)) *
					cur.spotPrice,
			0
		);

		return {
			routes,
			spotPrice,
			coinIn: {
				type: tradeResults.coinInType,
				amount: totalAmountIn,
				tradeFee: BigInt(0),
			},
			coinOut: {
				type: tradeResults.coinInType,
				amount: totalAmountOut,
				tradeFee: BigInt(0),
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	// public fetchSupportedCoins = async (inputs: {
	// 	protocols: RouterAsyncProtocolName[];
	// }): Promise<CoinType[]> => {
	// 	const apis = this.protocolApisFromNames({
	// 		protocols: inputs.protocols,
	// 	});

	// 	const arrayOfArraysOfCoins = await Promise.all(
	// 		apis.map((api) => api.fetchSupportedCoins())
	// 	);

	// 	const allCoins = arrayOfArraysOfCoins.reduce(
	// 		(arr, acc) => [...acc, ...arr],
	// 		[]
	// 	);
	// 	const coins = Helpers.uniqueArray(allCoins);

	// 	return coins;
	// };

	/////////////////////////////////////////////////////////////////////
	//// Transaction Building
	/////////////////////////////////////////////////////////////////////

	// public async fetchBuildTransactionForCompleteTradeRoute(inputs: {
	// 	network: SuiNetwork | Url;
	// 	provider: AftermathApi;
	// 	walletAddress: SuiAddress;
	// 	completeRoute: RouterCompleteTradeRoute;
	// 	slippage: Slippage;
	// }): Promise<TransactionBlock> {

	// }

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public protocolApisFromNames = (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): RouterAsyncApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]);
	};
}

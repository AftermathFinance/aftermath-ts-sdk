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
import { Helpers } from "../../../general/utils";
import { RpcApiHelpers } from "../../../general/api/rpcApiHelpers";

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

	public fetchTradeResults = async (inputs: {
		protocols: RouterAsyncProtocolName[];
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		tradePartitionCount: number;
	}): Promise<RouterAsyncTradeResults> => {
		const { coinInAmount, tradePartitionCount, coinInType, coinOutType } =
			inputs;

		const apis = this.protocolApisFromNames(inputs);

		const coinInPartitionAmount =
			coinInAmount / BigInt(Math.floor(tradePartitionCount));
		const coinInRemainderAmount =
			coinInAmount % BigInt(Math.floor(tradePartitionCount));

		const amountsIn = Array(tradePartitionCount)
			.fill(0)
			.map((_, index) =>
				index === 0
					? coinInRemainderAmount + coinInPartitionAmount
					: BigInt(1 + index) * coinInPartitionAmount
			);

		const results: RouterAsyncTradeResult[] = await Promise.all(
			apis.map(async (api, index) => {
				const pool = await api.fetchPoolForCoinTypes({
					...inputs,
					coinType1: coinInType,
					coinType2: coinOutType,
				});

				const amountsOut = await Promise.all(
					amountsIn.map((amountIn, index) =>
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
			amountsIn,
		};
	};

	public static splitTradeBetweenRoutes = (inputs: {
		tradeResults: RouterAsyncTradeResults;
	}): RouterCompleteTradeRoute => {
		const { tradeResults } = inputs;

		let amountsOutIndexes: number[] = Array(
			tradeResults.results.length
		).fill(-1);

		for (const [] of tradeResults.amountsIn.entries()) {
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

		const routes: RouterTradeRoute[] = tradeResults.results.map(
			(result, index) => {
				const amountOutIndex = amountsOutIndexes[index];
				const path = {
					pool: result.pool,
					protocolName: result.protocol,
					coinIn: {
						type: tradeResults.coinInType,
						amount: tradeResults.amountsIn[amountOutIndex],
						tradeFee: BigInt(0),
					},
					coinOut: {
						type: tradeResults.coinInType,
						amount: result.amountsOut[amountOutIndex],
						tradeFee: BigInt(0),
					},
					spotPrice:
						Number(tradeResults.amountsIn[0]) /
						Number(result.amountsOut[0]),
				};

				return {
					...path,
					paths: [path],
				};
			}
		);

		const totalAmountIn =
			tradeResults.amountsIn[tradeResults.amountsIn.length - 1];
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

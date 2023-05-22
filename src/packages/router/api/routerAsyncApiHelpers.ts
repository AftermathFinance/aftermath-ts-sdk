import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterAsyncProtocolName,
	RouterAsyncSerializablePool,
	RouterAsyncTradeResult,
	RouterAsyncTradeResults,
} from "../routerTypes";
import { Balance, CoinType } from "../../../types";
import { RouterAsyncApiInterface } from "../utils/async/routerAsyncApiInterface";
import { CetusApi } from "../../external/cetus/cetusApi";
import { RpcApiHelpers } from "../../../general/api/rpcApiHelpers";
import { TurbosApi } from "../../external/turbos/turbosApi";
import { isTurbosPoolObject } from "../../external/turbos/turbosTypes";
import { isCetusRouterPoolObject } from "../../external/cetus/cetusTypes";

export class RouterAsyncApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public readonly protocolNamesToApi: Record<
		RouterAsyncProtocolName,
		() => RouterAsyncApiInterface<any>
	> = {
		Cetus: () => new CetusApi(this.Provider),
		Turbos: () => new TurbosApi(this.Provider),
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

	public fetchPossiblePools = async (inputs: {
		protocols: RouterAsyncProtocolName[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<{
		exactMatchPools: RouterAsyncSerializablePool[];
		partialMatchPools: RouterAsyncSerializablePool[];
	}> => {
		const apis = inputs.protocols.map((protocol) =>
			this.protocolNamesToApi[protocol]()
		);

		const allPools: {
			partialMatchPools: RouterAsyncSerializablePool[];
			exactMatchPools: RouterAsyncSerializablePool[];
		} = (
			await Promise.all(apis.map((api) => api.fetchPoolsForTrade(inputs)))
		).reduce(
			(acc, pools) => {
				return {
					exactMatchPools: [
						...acc.exactMatchPools,
						...pools.exactMatchPools,
					],
					partialMatchPools: [
						...acc.partialMatchPools,
						...pools.partialMatchPools,
					],
				};
			},
			{
				partialMatchPools: [],
				exactMatchPools: [],
			}
		);

		return allPools;
	};

	public fetchTradeResults = async (inputs: {
		pools: RouterAsyncSerializablePool[];
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
	}): Promise<RouterAsyncTradeResults> => {
		const { coinInAmounts } = inputs;

		const protocols = inputs.pools.map((pool) =>
			this.protocolNameFromPool({ pool })
		);
		const apis = protocols.map((protocol) =>
			this.protocolNamesToApi[protocol]()
		);

		const resultsOrUndefined: (RouterAsyncTradeResult | undefined)[] =
			await Promise.all(
				apis.map(async (api, index) => {
					try {
						const pool = inputs.pools[index];

						const amountsOut = await Promise.all(
							coinInAmounts.map(async (amountIn) => {
								try {
									return await api.fetchTradeAmountOut({
										...inputs,
										pool,
										walletAddress:
											RpcApiHelpers.constants
												.devInspectSigner,
										coinInAmount: amountIn,
									});
								} catch (e) {
									console.error(e);
									return BigInt(0);
								}
							})
						);

						const protocol = protocols[index];

						return {
							pool,
							amountsOut,
							protocol,
						};
					} catch (e) {
						return undefined;
					}
				})
			);

		const results = resultsOrUndefined.filter(
			(result) => result !== undefined
		) as RouterAsyncTradeResult[];

		return {
			...inputs,
			results,
			coinInAmounts,
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

	public protocolNameFromPool = (inputs: {
		pool: RouterAsyncSerializablePool;
	}): RouterAsyncProtocolName => {
		const { pool } = inputs;

		const protocolName: RouterAsyncProtocolName = isTurbosPoolObject(pool)
			? "Turbos"
			: "Cetus";

		return protocolName;
	};
}

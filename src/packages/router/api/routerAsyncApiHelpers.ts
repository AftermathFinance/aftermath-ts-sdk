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

	private readonly protocolNamesToApi: Record<
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
		coinOutType: CoinType;
	}): Promise<RouterAsyncSerializablePool[]> => {
		const { coinOutType } = inputs;

		const apis = this.apisFromProtocolNames(inputs);

		const pools: RouterAsyncSerializablePool[] = (
			await Promise.all(
				apis.map((api) =>
					api.fetchPoolsForCoinType({ coinType: coinOutType })
				)
			)
		).reduce((pools, acc) => [...acc, ...pools], []);

		return pools;
	};

	public fetchTradeResults = async (inputs: {
		protocols: RouterAsyncProtocolName[];
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
	}): Promise<RouterAsyncTradeResults> => {
		const { coinInAmounts, coinInType, coinOutType } = inputs;

		const apis = this.apisFromProtocolNames(inputs);

		const resultsOrUndefined: (RouterAsyncTradeResult | undefined)[] =
			await Promise.all(
				apis.map(async (api, index) => {
					try {
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
										RpcApiHelpers.constants
											.devInspectSigner,
									coinInAmount: amountIn,
								})
							)
						);

						return {
							pool,
							amountsOut,
							protocol: inputs.protocols[index],
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

	private apisFromProtocolNames = (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): RouterAsyncApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};

	private apiFromPool = <T extends RouterAsyncSerializablePool>(inputs: {
		pool: T;
	}): RouterAsyncApiInterface<T> => {
		const { pool } = inputs;

		const protocolName: RouterAsyncProtocolName = isTurbosPoolObject(pool)
			? "Turbos"
			: "Cetus";

		return this.protocolNamesToApi[protocolName]();
	};
}

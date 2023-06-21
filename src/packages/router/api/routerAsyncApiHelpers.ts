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
import { TurbosApi } from "../../external/turbos/turbosApi";
import { isTurbosPoolObject } from "../../external/turbos/turbosTypes";
import { isCetusPoolObject } from "../../external/cetus/cetusTypes";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { isDeepBookPoolObject } from "../../external/deepBook/deepBookTypes";
import { RouterApiHelpers } from "./routerApiHelpers";

export class RouterAsyncApiHelpers {
	// =========================================================================
	//  Constants
	// =========================================================================

	public readonly protocolNamesToApi: Record<
		RouterAsyncProtocolName,
		() => RouterAsyncApiInterface<any>
	> = {
		Cetus: () => new CetusApi(this.Provider),
		Turbos: () => new TurbosApi(this.Provider),
		DeepBook: () => new DeepBookApi(this.Provider),
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): Promise<RouterAsyncSerializablePool[]> => {
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

	public filterPossiblePools = (inputs: {
		protocols: RouterAsyncProtocolName[];
		pools: RouterAsyncSerializablePool[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): {
		exactMatchPools: RouterAsyncSerializablePool[];
		partialMatchPools: RouterAsyncSerializablePool[];
	} => {
		const apis = inputs.protocols.map((protocol) =>
			this.protocolNamesToApi[protocol]()
		);

		const maxPools =
			RouterApiHelpers.constants.defaults.maxAsyncPoolsPerProtocol;
		const allPools: {
			partialMatchPools: RouterAsyncSerializablePool[];
			exactMatchPools: RouterAsyncSerializablePool[];
		} = apis
			.map((api) => api.filterPoolsForTrade(inputs))
			.reduce(
				(acc, pools) => {
					return {
						exactMatchPools: [
							...acc.exactMatchPools,
							...pools.exactMatchPools.slice(0, maxPools),
						],
						partialMatchPools: [
							...acc.partialMatchPools,
							...pools.partialMatchPools.slice(0, maxPools),
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

		const start = performance.now();

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

		const end = performance.now();
		console.log("(RESULTS 1):", end - start, "ms");
		console.log("\n");

		return {
			...inputs,
			results,
			coinInAmounts,
		};
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public protocolNameFromPool = (inputs: {
		pool: RouterAsyncSerializablePool;
	}): RouterAsyncProtocolName => {
		const { pool } = inputs;

		const protocolName: RouterAsyncProtocolName | undefined =
			isTurbosPoolObject(pool)
				? "Turbos"
				: isCetusPoolObject(pool)
				? "Cetus"
				: isDeepBookPoolObject(pool)
				? "DeepBook"
				: undefined;

		if (!protocolName)
			throw new Error("unknown RouterAsyncSerializablePool");

		return protocolName;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private protocolApisFromNames = (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): RouterAsyncApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};
}

import { SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterAsyncProtocolName,
	RouterAsyncSerializablePool,
	RouterAsyncTradeResult,
	RouterAsyncTradeResults,
} from "../routerTypes";
import { Balance, CoinType } from "../../../types";
import { Helpers } from "../../../general/utils";
import { RouterAsyncApiInterface } from "../utils/async/routerAsyncApiInterface";
import { CetusApi } from "../../external/cetus/cetusApi";

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

	constructor(public readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchTradeResults = async (inputs: {
		protocols: RouterAsyncProtocolName[];
		walletAddress: SuiAddress;
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

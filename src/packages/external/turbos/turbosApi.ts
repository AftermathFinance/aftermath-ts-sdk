import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { TurbosApiHelpers } from "./turbosApiHelpers";
import { SuiAddress } from "@mysten/sui.js";
import { Balance, SerializedTransaction } from "../../../types";
import { RouterApiInterface } from "../../router/utils/synchronous/interfaces/routerApiInterface";
import { Helpers } from "../../../general/utils";
import { TurbosPoolObject } from "./turbosTypes";

export class TurbosApi implements RouterApiInterface<TurbosPoolObject> {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new TurbosApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPools = async () => {
		const pools = await this.Helpers.fetchAllPools();
		return pools;
	};

	public fetchPoolsForTrade = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<{
		partialMatchPools: TurbosPoolObject[];
		exactMatchPools: TurbosPoolObject[];
	}> => {
		return this.Helpers.fetchPoolsForTrade(inputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchSupportedCoins = async () => {
		const pools = await this.Helpers.fetchAllPools();

		const allCoins = pools.reduce(
			(acc, pool) => [...acc, pool.coinTypeA, pool.coinTypeB],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	public fetchTradeAmountOut = async (inputs: {
		walletAddress: SuiAddress;
		pool: TurbosPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<Balance> => {
		const tradeResult = await this.Helpers.fetchCalcTradeResult(inputs);
		return tradeResult.amountOut;
	};

	public otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: TurbosPoolObject;
	}) => {
		return TurbosApiHelpers.otherCoinInPool(inputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchTradeTx = (inputs: {
		walletAddress: SuiAddress;
		pool: TurbosPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildTradeTx(inputs)
		);
	};
}

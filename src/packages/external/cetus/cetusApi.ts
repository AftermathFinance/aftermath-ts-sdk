import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { CetusApiHelpers } from "./cetusApiHelpers";
import { SuiAddress } from "@mysten/sui.js";
import { CetusPoolObject } from "./cetusTypes";
import { Balance, SerializedTransaction } from "../../../types";
import { RouterAsyncApiInterface } from "../../router/utils/async/routerAsyncApiInterface";

export class CetusApi implements RouterAsyncApiInterface<CetusPoolObject> {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new CetusApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPoolForCoinTypes = async (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}): Promise<CetusPoolObject> => {
		return this.Helpers.fetchPoolForCoinTypes(inputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchTradeAmountOut = async (inputs: {
		walletAddress: SuiAddress;
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<Balance> => {
		const tradeResult = await this.Helpers.fetchCalcTradeResult(inputs);
		return tradeResult.amountOut;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchTradeTx = (inputs: {
		walletAddress: SuiAddress;
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildTradeTx(inputs)
		);
	};
}

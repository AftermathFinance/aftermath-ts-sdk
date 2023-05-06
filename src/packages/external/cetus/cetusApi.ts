import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { CetusApiHelpers } from "./cetusApiHelpers";
import { SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { CetusCalcTradeResult, CetusPoolSimpleInfo } from "./cetusTypes";
import { Balance, SerializedTransaction } from "../../../types";

export class CetusApi {
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
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCalcTradeResult = async (
		inputs: {
			walletAddress: SuiAddress;
			pool: CetusPoolSimpleInfo;
			coinInType: CoinType;
			coinOutType: CoinType;
		} & (
			| {
					coinInAmount: Balance;
			  }
			| {
					coinOutAmount: Balance;
			  }
		)
	): Promise<CetusCalcTradeResult> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.Helpers.calcTradeResultTx({
			tx,
			...inputs.pool,
			...inputs,
		});

		const resultBytes =
			this.Provider.Inspections().fetchAllBytesFromTxOutput({ tx });

		console.log("resultBytes", resultBytes);

		return {
			amountIn: BigInt(0),
			amountOut: BigInt(0),
			feeAmount: BigInt(0),
			feeRate: BigInt(0),
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchTradeTx = (inputs: {
		walletAddress: SuiAddress;
		pool: CetusPoolSimpleInfo;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildTradeTx(inputs)
		);
	};
}

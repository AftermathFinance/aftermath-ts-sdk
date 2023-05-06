import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { CetusApiHelpers } from "./cetusApiHelpers";
import { SuiAddress, TransactionBlock, bcs } from "@mysten/sui.js";
import { CetusCalcTradeResult, CetusPoolSimpleInfo } from "./cetusTypes";
import { Balance, SerializedTransaction } from "../../../types";
import { BCS } from "@mysten/bcs";

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
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchPoolForCoinTypes = async (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		return this.Helpers.fetchPoolForCoinTypes(inputs);
	};

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
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		bcs.registerStructType("SwapStepResult", {
			current_sqrt_price: BCS.U128,
			target_sqrt_price: BCS.U128,
			current_liquidity: BCS.U128,
			amount_in: BCS.U64,
			amount_out: BCS.U64,
			fee_amount: BCS.U64,
			remainer_amount: BCS.U64,
		});

		bcs.registerStructType("CalculatedSwapResult", {
			amount_in: BCS.U64,
			amount_out: BCS.U64,
			fee_amount: BCS.U64,
			fee_rate: BCS.U64,
			after_sqrt_price: BCS.U128,
			is_exceed: BCS.BOOL,
			step_results: "vector<SwapStepResult>",
		});

		const data = bcs.de(
			"CalculatedSwapResult",
			new Uint8Array(resultBytes)
		);

		return {
			amountIn: BigInt(data.amount_in),
			amountOut: BigInt(data.amount_out),
			feeAmount: BigInt(data.fee_amount),
			feeRate: BigInt(data.fee_rate),
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

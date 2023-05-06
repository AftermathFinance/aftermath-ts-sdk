import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { CetusApiHelpers } from "./cetusApiHelpers";
import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { CetusCalcTradeResult, CetusPoolSimpleInfo } from "./cetusTypes";
import { Balance } from "../../../types";

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

	public addTradeCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		// pool: PartialDeepBookPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
	}) /* (Coin<CoinIn>, Coin<CoinOut>, u64 (amountFilled), u64 (amountOut)) */ => {
		// const commandInputs = {
		// 	...inputs,
		// 	poolObjectId: inputs.pool.objectId,
		// };
		// if (
		// 	Helpers.stripLeadingZeroesFromType(inputs.coinInType) ===
		// 	Helpers.stripLeadingZeroesFromType(inputs.pool.baseCoin)
		// ) {
		// 	return this.Helpers.tradeCoinAToCoinBTx(commandInputs);
		// }
		// return this.Helpers.addTradeQuoteToBaseCommandToTransaction(
		// 	commandInputs
		// );
	};
}

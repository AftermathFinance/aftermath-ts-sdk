import { SuiNetwork } from "../types/suiTypes";
import {
	ApiTransactionsBody,
	Balance,
	SerializedTransaction,
	SuiAddress,
	TransactionsWithCursor,
	Url,
} from "../types/generalTypes";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { TransactionBlock } from "@mysten/sui.js/dist/cjs/builder";
import { ApiDynamicGasBody, ApiDynamicGasResponse } from "./dynamicGasTypes";

export class DynamicGas extends Caller {
	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "dynamic-gas");
	}

	public async getUseDynamicGasForTx(inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress;
		gasCoinType: CoinType;
	}) {
		const { tx, walletAddress, gasCoinType } = inputs;
		return this.fetchApi<ApiDynamicGasResponse, ApiDynamicGasBody>("", {
			serializedTx: tx.serialize(),
			walletAddress,
			gasCoinType,
		});
	}
}

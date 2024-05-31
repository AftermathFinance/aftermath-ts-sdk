import { SuiNetwork } from "../types/suiTypes";
import { SuiAddress, Url } from "../types/generalTypes";
import { CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { Transaction } from "@mysten/sui/transactions";
import { ApiDynamicGasBody, ApiDynamicGasResponse } from "./dynamicGasTypes";

export class DynamicGas extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "dynamic-gas");
	}

	// =========================================================================
	//  Tx Setup
	// =========================================================================

	public async getUseDynamicGasForTx(inputs: {
		tx: Transaction;
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

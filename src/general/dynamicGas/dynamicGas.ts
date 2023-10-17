import { SuiNetwork } from "../types/suiTypes";
import { SuiAddress, Url } from "../types/generalTypes";
import { CoinType } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDynamicGasBody, ApiDynamicGasResponse } from "./dynamicGasTypes";

export class DynamicGas extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "dynamic-gas");
	}

	// =========================================================================
	//  Tx Setup
	// =========================================================================

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

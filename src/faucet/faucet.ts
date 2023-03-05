import { SignableTransaction } from "@mysten/sui.js";
import ApiProvider from "../apiProvider/apiProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import { CoinType, ApiFaucetRequestBody } from "../types";

export class Faucet extends ApiProvider {
	constructor(public readonly network: SuiNetwork) {
		super(network, "faucet");
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getIsPackageOnChain(): Promise<boolean> {
		return this.fetchApi("status");
	}

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supportedCoins");
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	// TODO: add mint coin event getter

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getRequestCoinTransaction(
		coin: CoinType
	): Promise<SignableTransaction> {
		return this.fetchApi<SignableTransaction, ApiFaucetRequestBody>(
			"transactions/request",
			{
				coin,
			}
		);
	}
}

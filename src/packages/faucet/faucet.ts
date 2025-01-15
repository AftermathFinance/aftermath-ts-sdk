import {
	ApiFaucetMintSuiFrenBody,
	ApiFaucetRequestBody,
	CallerConfig,
	CoinType,
	SuiNetwork,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";
import { Transaction } from "@mysten/sui/transactions";

export class Faucet extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		defaultRequestAmountUsd: 10,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, "faucet");
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	// =========================================================================
	//  Events
	// =========================================================================

	// TODO: add mint coin event getter ?

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getRequestCoinTransaction(
		inputs: ApiFaucetRequestBody
	): Promise<Transaction> {
		return this.fetchApiTransaction("request", inputs);
	}

	public async getMintSuiFrenTransaction(inputs: ApiFaucetMintSuiFrenBody) {
		return this.useProvider().fetchBuildMintSuiFrenTx(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Faucet();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

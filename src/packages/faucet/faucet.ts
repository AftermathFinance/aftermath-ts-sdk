import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	ApiFaucetMintSuiFrenBody,
	ApiFaucetRequestBody,
	CallerConfig,
	CoinType,
} from "../../types";

export class Faucet extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "faucet");
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public getRequestCoinTransaction(inputs: ApiFaucetRequestBody): Transaction {
		return this.faucetApi().buildRequestCoinTx(inputs);
	}

	public getMintSuiFrenTransaction(
		inputs: ApiFaucetMintSuiFrenBody
	): Promise<Transaction> {
		return this.faucetApi().fetchBuildMintSuiFrenTx(inputs);
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private readonly faucetApi = () => {
		const faucet = this.api?.Faucet();
		if (!faucet) {
			throw new Error("missing AftermathApi instance");
		}
		return faucet;
	};
}

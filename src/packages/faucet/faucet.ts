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
		public readonly api?: AftermathApi
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

	public async getRequestCoinTransaction(inputs: ApiFaucetRequestBody) {
		return this.faucetApi().buildRequestCoinTx(inputs);
	}

	public async getMintSuiFrenTransaction(inputs: ApiFaucetMintSuiFrenBody) {
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

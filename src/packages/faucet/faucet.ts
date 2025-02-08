import {
	ApiFaucetMintSuiFrenBody,
	ApiFaucetRequestBody,
	CoinType,
	SuiNetwork,
	Url,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";

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
		public readonly network?: SuiNetwork | Url,
		public readonly Provider?: AftermathApi
	) {
		super(network, "faucet");
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

	// TODO: add mint coin event getter

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getRequestCoinTransaction(inputs: ApiFaucetRequestBody) {
		return this.useProvider().buildRequestCoinTx(inputs);
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

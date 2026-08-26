import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	ApiFaucetMintSuiFrenBody,
	ApiFaucetRequestBody,
	CallerConfig,
	CoinType,
} from "../../types";

/**
 * Provides the high-level faucet API for supported coins and faucet transactions.
 */
export class Faucet extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a faucet facade.
	 *
	 * @param config - Optional caller configuration, such as the network and access token.
	 * @param api - Optional provider used to build faucet transactions.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "faucet");
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the coin types currently supported by the faucet.
	 *
	 * @returns A promise for the supported coin type strings.
	 */
	public getSupportedCoins(): Promise<CoinType[]> {
		return this.fetchApi("supported-coins");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds a transaction that mints and transfers one faucet coin.
	 *
	 * @param inputs - Coin type to mint and wallet that receives it.
	 * @returns A transaction ready for the wallet to sign and execute.
	 * @throws `Error` when this facade was created without an `AftermathApi` instance.
	 */
	public getRequestCoinTransaction(inputs: ApiFaucetRequestBody): Transaction {
		return this.faucetApi().buildRequestCoinTx(inputs);
	}

	/**
	 * Fetches the SUI payment coin and builds a transaction that mints a SuiFren.
	 *
	 * @param inputs - Mint fee, SuiFren type, and wallet that signs the transaction.
	 * @returns A promise for a transaction ready for the wallet to sign and execute.
	 * @throws `Error` when this facade was created without an `AftermathApi` instance.
	 */
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

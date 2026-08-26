import type { Transaction } from "@mysten/sui/transactions";
import type { CoinType } from "../../packages/coin/coinTypes";
import type { CallerConfig, SuiAddress } from "../types/generalTypes";
import { Caller } from "../utils/caller";
import type {
	ApiDynamicGasBody,
	ApiDynamicGasResponse,
} from "./dynamicGasTypes";

/**
 * The `DynamicGas` class provides functionality for dynamically determining
 * or attaching a suitable gas payment object to a transaction. This allows
 * for more flexible transaction building when exact gas objects are not
 * predetermined.
 */
export class DynamicGas extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `DynamicGas` instance for interacting with dynamic gas endpoints.
	 *
	 * @param config - Optional caller config, including the Sui network and an access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "dynamic-gas");
	}

	// =========================================================================
	//  Tx Setup
	// =========================================================================

	/**
	 * Requests the dynamic gas service to set up a transaction with an appropriate gas coin,
	 * or sponsor signature if needed, based on the user's wallet and coin type preference.
	 *
	 * @param inputs - An object containing the `Transaction` to be adjusted, the `walletAddress`, and `gasCoinType`.
	 * @returns A promise that resolves to an `ApiDynamicGasResponse`, which includes the new transaction bytes
	 *  (`txBytes`) and possibly a `sponsoredSignature`.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 *
	 * const dynamicGas = afSdk.DynamicGas();
	 *
	 * const updatedTx = await dynamicGas.getUseDynamicGasForTx({
	 *   tx: transactionBlock,
	 *   walletAddress: "0x<user_address>",
	 *   gasCoinType: "0x2::sui::SUI"
	 * });
	 * // updatedTx.txBytes and updatedTx.sponsoredSignature can now be used for signing/execution
	 * ```
	 */
	public async getUseDynamicGasForTx(inputs: {
		tx: Transaction;
		walletAddress: SuiAddress;
		gasCoinType: CoinType;
	}) {
		const { tx, walletAddress, gasCoinType } = inputs;
		return this.fetchApi<ApiDynamicGasResponse, ApiDynamicGasBody>("", {
			serializedTx: await tx.toJSON(),
			walletAddress,
			gasCoinType,
		});
	}
}

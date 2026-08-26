import type { Transaction } from "@mysten/sui/transactions";
import type { CoinType } from "../../packages/coin/coinTypes";
import type { CallerConfig, SuiAddress } from "../types/generalTypes";
import { Caller } from "../utils/caller";
import type {
	ApiDynamicGasBody,
	ApiDynamicGasResponse,
} from "./dynamicGasTypes";

/**
 * Prepares a transaction through the Aftermath dynamic-gas HTTP service.
 *
 * The service receives the serialized transaction, wallet address, and
 * preferred coin type at the configured `dynamic-gas` endpoint. This class does
 * not use the Sui gRPC or JSON-RPC clients.
 */
export class DynamicGas extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a dynamic-gas service client.
	 *
	 * @param config - Optional caller configuration. Set `network` to use the
	 * canonical Aftermath host, or set `baseUrl` for a custom or local service.
	 * Include `accessToken` when the service requires authentication.
	 */
	constructor(config?: CallerConfig) {
		super(config, "dynamic-gas");
	}

	// =========================================================================
	//  Tx Setup
	// =========================================================================

	/**
	 * Sends a transaction to the dynamic-gas service for gas preparation.
	 *
	 * This method performs one HTTP `POST` request to `/api/dynamic-gas` under
	 * the configured base URL. It serializes `tx` with `Transaction.toJSON()` and
	 * sends the wallet address and preferred Move coin type in the JSON body. It
	 * does not sign or execute the transaction locally.
	 *
	 * @param inputs - The transaction to serialize, the Sui wallet address, and a
	 * fully qualified coin type such as `0x2::sui::SUI`.
	 * @returns The service's serialized transaction bytes and sponsor signature.
	 * @throws `AftermathTransportError` for HTTP, network, abort, timeout, or
	 * response-decode failures. A missing API base URL also rejects the request.
	 *
	 * @example
	 * ```typescript
	 * import { Aftermath } from "aftermath-ts-sdk";
	 * import { Transaction } from "@mysten/sui/transactions";
	 *
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 * const dynamicGas = afSdk.DynamicGas();
	 * const transactionBlock = new Transaction();
	 *
	 * const updatedTx = await dynamicGas.getUseDynamicGasForTx({
	 *   tx: transactionBlock,
	 *   walletAddress: "0x00000000000000000000000000000000000000000000000000000000000000aa",
	 *   gasCoinType: "0x2::sui::SUI"
	 * });
	 * // Use updatedTx.txBytes and updatedTx.sponsoredSignature in the signing flow.
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

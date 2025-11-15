import {
	CallerConfig,
	SignMessageCallback,
	SuiAddress,
	SuiNetwork,
} from "../../types.ts";
import { Caller } from "../../general/utils/caller.ts";
import {
	ApiCreateAuthAccountBody,
	ApiGetAccessTokenBody,
	ApiGetAccessTokenResponse,
	RateLimit,
} from "./authTypes.ts";
import { Helpers } from "../../general/utils/index.ts";

/**
 * The `Auth` class manages creation and refreshing of access tokens
 * to obtain higher rate limits on the Aftermath API. It includes methods
 * to initialize authorization either by a direct callback-based approach
 * or by importing a local Sui keystore. Optionally, administrative functions
 * are provided for creating specialized auth accounts.
 *
 * @example
 * ```typescript
 * const auth = new Auth();
 * const stopAuth = await auth.init({
 *   walletAddress: "0x<address>",
 *   signMessageCallback: async ({ message }) => {
 *     // sign message
 *   },
 * });
 * // ... make authenticated requests ...
 * stopAuth(); // stop auto refresh
 * ```
 */
export class Auth extends Caller {
	// =========================================================================
	//  Private Class Members
	// =========================================================================

	/**
	 * Holds the timer reference for scheduled token refreshes.
	 */
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	/**
	 * Indicates whether the user has canceled auto token refresh.
	 */
	private isCanceled = false;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new `Auth` instance for token-based rate limit increases.
	 *
	 * @param config - Optional caller configuration, including network and access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "auth");
	}

	// =========================================================================
	//  User-Facing
	// =========================================================================

	/**
	 * Initializes the auth system by fetching an access token for the provided wallet address.
	 * After obtaining the token, it automatically schedules periodic refresh calls until stopped.
	 *
	 * @param inputs - An object containing the user's `walletAddress` and a `signMessageCallback` function
	 *  for cryptographically signing messages.
	 *
	 * @returns A function that, when called, cancels further token refresh attempts.
	 *
	 * @example
	 * ```typescript
	 * const auth = new Auth();
	 * const stopAuth = await auth.init({
	 *   walletAddress: "0x<address>",
	 *   signMessageCallback: async ({ message }) => {
	 *     // sign the message with your private key / keypair
	 *   },
	 * });
	 *
	 * // ... make authorized calls ...
	 *
	 * stopAuth(); // Cancel further token refreshes
	 * ```
	 */
	public async init(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: SignMessageCallback;
	}): Promise<() => void> {
		this.isCanceled = false; // Mark as active

		const startRefresh = async () => {
			if (this.isCanceled) return; // No-op if canceled

			const { accessToken, expirationTimestamp } =
				await this.getAccessToken(inputs);
			this.setAccessToken(accessToken);

			if (this.isCanceled) return; // Double-check after token fetch

			// Provide a margin by refreshing before actual expiration
			const TIMEOUT_REDUCTION_RATIO = 0.9;
			const interval =
				(expirationTimestamp - Date.now()) * TIMEOUT_REDUCTION_RATIO;

			// Schedule next refresh
			this.refreshTimer = setTimeout(startRefresh, interval);
		};

		// Kick off first refresh
		await startRefresh();

		// Return cancellation function
		return () => {
			this.isCanceled = true;
			if (this.refreshTimer) {
				clearTimeout(this.refreshTimer);
			}
		};
	}

	/**
	 * Initializes the auth system by reading a local Sui keystore file (on the server side),
	 * using the private keys matching a provided address to sign messages for token creation.
	 * After the token is obtained, it automatically schedules periodic refresh calls until stopped.
	 *
	 * @param inputs - An object containing the target `walletAddress` and an optional path to the `.keystore`.
	 *  If `path` is not provided, it defaults to `~/.sui/sui_config/sui.keystore`.
	 * @returns A function that, when called, cancels further token refresh attempts.
	 *
	 * @throws If this method is called in a browser environment (client-side).
	 *
	 * @example
	 * ```typescript
	 * // On server:
	 * const stopAuth = await auth.initFromSuiKeystore({
	 *   walletAddress: "0x<address>",
	 *   path: "/custom/path/to/keystore.json",
	 * });
	 * // authorized calls...
	 * stopAuth();
	 * ```
	 */
	// public async initFromSuiKeystore(inputs: {
	// 	walletAddress: SuiAddress;
	// 	path?: string;
	// }): Promise<() => void> {
	// 	const { walletAddress, path: pathStr } = inputs;

	// 	if (typeof window === "undefined") {
	// 		// Node environment, proceed with reading a keystore
	// 		const fs = require("fs");
	// 		const path = require("path");
	// 		const os = require("os");

	// 		const keystorePath = pathStr
	// 			? path.join(pathStr)
	// 			: (() => {
	// 					// Default to ~/.sui/sui_config/sui.keystore
	// 					const homeDir = os.homedir();
	// 					if (!homeDir) {
	// 						throw new Error(
	// 							"cannot obtain home directory path"
	// 						);
	// 					}
	// 					return path.join(
	// 						homeDir,
	// 						".sui",
	// 						"sui_config",
	// 						"sui.keystore"
	// 					);
	// 			  })();

	// 		// Read JSON with an array of private keys
	// 		let privateKeys: string[];
	// 		try {
	// 			const fileContent = fs.readFileSync(keystorePath, "utf-8");
	// 			privateKeys = JSON.parse(fileContent);

	// 			if (!Array.isArray(privateKeys)) {
	// 				throw new Error(
	// 					"Invalid keystore format: Expected an array of private keys"
	// 				);
	// 			}
	// 		} catch (error) {
	// 			throw new Error(`Failed to read keystore file: ${error}`);
	// 		}
	// 		if (privateKeys.length <= 0) {
	// 			throw new Error(`Empty keystore file`);
	// 		}

	// 		// Find the matching key for the requested walletAddress
	// 		const foundKeypair = privateKeys
	// 			.map((privateKey) => Helpers.keypairFromPrivateKey(privateKey))
	// 			.find(
	// 				(keypair) =>
	// 					Helpers.addLeadingZeroesToType(
	// 						keypair.toSuiAddress()
	// 					) === Helpers.addLeadingZeroesToType(walletAddress)
	// 			);
	// 		if (!foundKeypair) {
	// 			throw new Error(
	// 				`No private key found in keystore file for ${walletAddress}`
	// 			);
	// 		}

	// 		// Initialize with sign callback
	// 		return this.init({
	// 			walletAddress,
	// 			signMessageCallback: async ({ message }) =>
	// 				foundKeypair.signPersonalMessage(message),
	// 		});
	// 	}

	// 	throw new Error("`initFromSuiKeystore` must be called on server-side");
	// }

	// =========================================================================
	//  Admin
	// =========================================================================

	/**
	 * **Admin-only**: Creates a new auth account with specific rate limits for a given
	 * `accountWalletAddress`. The `walletAddress` performing this action must have
	 * admin privileges, or the call will fail. Use this to create custom sub-accounts
	 * with limited scope or usage rates.
	 *
	 * @param inputs - Contains:
	 *  - `walletAddress`: The admin's wallet address
	 *  - `signMessageCallback`: The admin's signing callback
	 *  - `accountName`: A short name or identifier for the account
	 *  - `accountWalletAddress`: The Sui address representing this sub-account
	 *  - `rateLimits`: An array specifying the rate limits (method-based) for the sub-account
	 * @returns A promise resolving to `true` if successful, otherwise throws or returns `false`.
	 */
	public async adminCreateAuthAccount(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: SignMessageCallback;
		accountName: string;
		accountWalletAddress: SuiAddress;
		rateLimits: RateLimit[];
	}): Promise<boolean> {
		const {
			walletAddress,
			signMessageCallback,
			accountName,
			accountWalletAddress,
			rateLimits,
		} = inputs;

		// Prepare the data to sign
		const serializedJson = Auth.createSerializedJson<{
			sub: string;
			wallet_address: SuiAddress;
			rate_limits: RateLimit[];
		}>("AccountCreate", {
			sub: accountName,
			wallet_address:
				Helpers.addLeadingZeroesToType(accountWalletAddress),
			rate_limits: rateLimits,
		});
		const message = new TextEncoder().encode(serializedJson);

		const { signature } = await signMessageCallback({ message });

		return this.fetchApi<boolean, ApiCreateAuthAccountBody>(
			"create-account",
			{
				signature,
				serializedJson,
				walletAddress: Helpers.addLeadingZeroesToType(walletAddress),
			}
		);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	/**
	 * Requests a new access token from the API by sending a signed message
	 * indicating the user wants a token.
	 *
	 * @param inputs - Contains the user's `walletAddress` and `signMessageCallback`.
	 * @returns A response object that includes the `accessToken` and an `expirationTimestamp`.
	 */
	private async getAccessToken(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: SignMessageCallback;
	}): Promise<ApiGetAccessTokenResponse> {
		const { walletAddress, signMessageCallback } = inputs;

		// Prepare signable data
		const serializedJson = Auth.createSerializedJson("GetAccessToken", {});
		const message = new TextEncoder().encode(serializedJson);

		const { signature } = await signMessageCallback({ message });

		return this.fetchApi<ApiGetAccessTokenResponse, ApiGetAccessTokenBody>(
			"access-token",
			{
				signature,
				serializedJson,
				walletAddress: Helpers.addLeadingZeroesToType(walletAddress),
			}
		);
	}

	// =========================================================================
	//  Private Static
	// =========================================================================

	/**
	 * Creates a JSON string with a standard format:
	 * ```json
	 * {
	 *   "date": <epoch-seconds>,
	 *   "nonce": <random_number>,
	 *   "method": <method_string>,
	 *   "value": <passed_value>
	 * }
	 * ```
	 *
	 * @param method - A short method name describing the action ("GetAccessToken", "AccountCreate", etc.).
	 * @param value - The data object to embed under the `value` field.
	 * @returns A JSON-serialized string for signing.
	 */
	private static createSerializedJson<DataToSerialize extends Object>(
		method: string,
		value: DataToSerialize
	) {
		const timestampSeconds = Math.floor(Date.now() / 1000);
		const random = Math.floor(Math.random() * 1024 * 1024);
		const data = {
			date: timestampSeconds,
			nonce: random,
			method,
			value,
		};
		return JSON.stringify(data);
	}
}

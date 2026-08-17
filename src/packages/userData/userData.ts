import { Caller } from "../../general/utils/caller";
import type { CallerConfig } from "../../types";
import type {
	ApiUserDataCreateUserBody,
	ApiUserDataPublicKeyBody,
} from "./userDataTypes";

/**
 * The `UserData` class provides functionality for managing user-specific
 * information in the Aftermath system. It enables creating and retrieving
 * user public keys, as well as generating messages for signing.
 */
export class UserData extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new instance of the `UserData` class for interacting with user data endpoints.
	 *
	 * @param config - Optional configuration for the `Caller`, including network and access token.
	 */
	constructor(config?: CallerConfig) {
		super(config, "user-data");
	}

	// =========================================================================
	//  API
	// =========================================================================

	/**
	 * Retrieves the stored user public key (if any) for a given wallet address.
	 *
	 * @param inputs - An object implementing `ApiUserDataPublicKeyBody`, containing the user's wallet address.
	 * @returns A promise that resolves to a string representation of the user's public key, or `undefined` if none is found.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 *
	 * const userData = afSdk.UserData();
	 *
	 * const pubkey = await userData.getUserPublicKey({
	 *   walletAddress: "0x<address>"
	 * });
	 * console.log(pubkey); // "0x<hex_public_key>" or undefined
	 * ```
	 */
	public async getUserPublicKey(
		inputs: ApiUserDataPublicKeyBody
	): Promise<string | undefined> {
		return this.fetchApi<string | undefined, ApiUserDataPublicKeyBody>(
			"public-key",
			inputs
		);
	}

	/**
	 * Creates (or updates) the stored public key for a user on the backend, linking
	 * it to their wallet address.
	 *
	 * @param inputs - Details required to create or update the user's public key, including signature data.
	 * @returns A promise that resolves to `true` if the public key was successfully created/updated, otherwise `false` or an error.
	 *
	 * @example
	 * ```typescript
	 * const created = await userData.createUserPublicKey({
	 *   walletAddress: "0x<address>",
	 *   bytes: "0x<message_as_bytes>",
	 *   signature: "0x<signature>"
	 * });
	 * console.log("Was public key created?", created);
	 * ```
	 */
	public async createUserPublicKey(
		inputs: ApiUserDataCreateUserBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiUserDataCreateUserBody>(
			"save-public-key",
			inputs
		);
	}

	/**
	 * Generates a simple message object that the user should sign to prove their
	 * intention to create or link an account in the Aftermath system.
	 *
	 * @returns An object with an `action` property, used as the data to sign.
	 *
	 * @example
	 * ```typescript
	 * const userData = new UserData();
	 * const msgToSign = userData.createUserAccountMessageToSign();
	 * console.log(msgToSign.action); // "CREATE_USER_ACCOUNT"
	 * // The user can then sign msgToSign with their private key.
	 * ```
	 */
	public createUserAccountMessageToSign() {
		return {
			action: "CREATE_USER_ACCOUNT",
		};
	}

	/**
	 * The single message every wallet signs once per session to prove ownership.
	 * af-fe decodes the personal-message bytes and compares this text byte for
	 * byte, so it must stay exactly this string: no JSON wrapper, action, date,
	 * or trailing whitespace.
	 */
	public static readonly termsAndConditionsMessage =
		"Aftermath Terms and Conditions";

	/**
	 * Returns the canonical Terms and Conditions message to sign. Sign it as a
	 * personal message over its UTF-8 bytes and reuse the signature for the whole
	 * session: it is the one credential af-fe verifies for referrals, rewards,
	 * stop/twap order datas, collateral/order history, the websocket `user`
	 * subscription, and gas-pool sponsorship.
	 *
	 * @returns The exact string to sign.
	 *
	 * @example
	 * ```typescript
	 * const message = new UserData().createTermsAndConditionsMessage();
	 * const { bytes, signature } = await signPersonalMessage(
	 *   new TextEncoder().encode(message)
	 * );
	 * ```
	 */
	public createTermsAndConditionsMessage(): string {
		return UserData.termsAndConditionsMessage;
	}

	/**
	 * Generates a simple message object that the user should sign to confirm their agreement
	 * with the Terms and Conditions of the service.
	 *
	 * @deprecated af-fe no longer accepts the `{action:...}` wrapper and rejects
	 * it with error 2034. Sign {@link createTermsAndConditionsMessage} instead.
	 * @returns An object with an `action` property set to "SIGN_TERMS_AND_CONDITIONS".
	 */
	public createSignTermsAndConditionsMessageToSign(): {
		action: string;
	} {
		return {
			action: "SIGN_TERMS_AND_CONDITIONS",
		};
	}
}

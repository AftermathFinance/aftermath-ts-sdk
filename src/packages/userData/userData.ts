import { Caller } from "../../general/utils/caller";
import { SuiAddress, SuiNetwork } from "../../types";
import { AftermathApi } from "../../general/providers";
import {
	ApiUserDataCreateUserBody,
	ApiUserDataOwnedBody,
	UserDataKeyType,
} from "./userDataTypes";

export class UserData extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "user-data");
	}

	public static readonly constants = {
		termsAndConsKey: "user-signedTermsAndCons",
	};

	// =========================================================================
	//  API
	// =========================================================================
	/**
	 * Fetches the API for users public key.
	 * @async
	 * @param { SuiAddress } inputs - An object containing the walletAddress.
	 * @returns { Promise<string | undefined> } A promise that resolves users public key.
	 */

	public async getUserPublicKey(
		inputs: ApiUserDataOwnedBody
	): Promise<string | undefined> {
		return this.fetchApi<string | undefined, ApiUserDataOwnedBody>(
			`public-key`,
			inputs
		);
	}

	/**
	 * Fetches the API to create users public key.
	 * @async
	 * @param { ApiUserDataCreateUserBody } inputs - The inputs for creating users public key on BE side.
	 * @returns { Promise<boolean> } A promise that resolves to result if user pk has been created.
	 */

	public async createUserPublicKey(
		inputs: ApiUserDataCreateUserBody
	): Promise<boolean> {
		return this.fetchApi<boolean, ApiUserDataCreateUserBody>(
			`save-public-key`,
			inputs
		);
	}

	/**
	 * Fetches the API for user create message to sign.
	 * @async
	 * @param { UserDataKeyType } inputs - key of the service you interract with.
	 * @returns { string } message to sign with action related to the service you interract with.
	 */

	public createUserAccountMessageToSign(key: UserDataKeyType): {
		action: string;
	} {
		return {
			action: `CREATE_${key.toUpperCase()}_ACCOUNT`,
		};
	}

	/**
	 * Fetches the API for creating sign and terms message to sign.
	 * @async
	 * @param { UserDataKeyType } inputs - key of the service you interract with.
	 * @returns { string } message to sign with action related to the service you interract with.
	 */

	public createSignTermsAndConditionsMessageToSign(): {
		action: string;
	} {
		return {
			action: `SIGN_TERMS_AND_CONDITIONS`,
		};
	}

	public static getTermsAndConsKey(inputs: {
		walletAddress: SuiAddress | undefined;
	}) {
		return `${this.constants.termsAndConsKey}-${inputs.walletAddress}`;
	}
}

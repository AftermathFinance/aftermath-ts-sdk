import { Caller } from "../../general/utils/caller";
import { CallerConfig } from "../../types";
import {
	ApiUserDataCreateUserBody,
	ApiUserDataOwnedBody,
} from "./userDataTypes";

export class UserData extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "user-data");
	}

	// =========================================================================
	//  API
	// =========================================================================
	/**
	 * Fetches the API for users public key.
	 * @async
	 * @param { SuiAddress } inputs - An object containing the walletAddress.
	 * @returns { Promise<string | undefined | "None"> } A promise that resolves users public key.
	 */

	public async getUserPublicKey(
		inputs: ApiUserDataOwnedBody
	): Promise<string | undefined | "None"> {
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
	 * @returns { string } message to sign with action related to the service you interact with.
	 */

	public createUserAccountMessageToSign() {
		return {
			action: `CREATE_USER_ACCOUNT`,
		};
	}

	/**
	 * Fetches the API for creating sign and terms message to sign.
	 * @returns { string } message to sign with action related to the service you interact with.
	 */

	public createSignTermsAndConditionsMessageToSign(): {
		action: string;
	} {
		return {
			action: `SIGN_TERMS_AND_CONDITIONS`,
		};
	}
}

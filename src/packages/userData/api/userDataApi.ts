import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	ApiUserDataCreateUserBody,
	ApiUserDataOwnedBody,
} from "../userDataTypes";
import {
	UserDataIndexerCreateUserRequest,
	UserDataIndexerCreateUserResponse,
	UserDataIndexerUserRequest,
	UserDataIndexerUserResponse,
} from "./userDataCastingTypes";

export class UserDataApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Get Public Key
	// =========================================================================

	public fetchUserPublicKey = async (
		inputs: ApiUserDataOwnedBody
	): Promise<string | undefined> => {
		const data = await this.Provider.indexerCaller.fetchIndexer<
			UserDataIndexerUserResponse,
			UserDataIndexerUserRequest
		>(
			// TODO: - add ${inputs.key}/ in front for AF-FE
			`user/get`,
			{
				address: inputs.walletAddress,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		console.log({ data });
		return data ? data.public_key_object : undefined;
	};

	// =========================================================================
	//  Create Public Key
	// =========================================================================

	public fetchCreateUserPublicKey = async (
		inputs: ApiUserDataCreateUserBody
	): Promise<boolean> => {
		return this.Provider.indexerCaller.fetchIndexer<
			UserDataIndexerCreateUserResponse,
			UserDataIndexerCreateUserRequest
		>(
			// TODO: - add ${inputs.key}/ in front for AF-FE
			`user/add`,
			{
				address: inputs.walletAddress,
				signature: inputs.signature,
				message: inputs.bytes,
			},
			undefined,
			undefined,
			undefined,
			true
		);
	};
}

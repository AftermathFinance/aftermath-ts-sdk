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
		// TODO: - replace fetchIndexerTest with fetchIndexer
		const data = await this.Provider.indexerCaller.fetchIndexerTest<
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
		// TODO: - replace fetchIndexerTest with fetchIndexer
		return this.Provider.indexerCaller.fetchIndexerTest<
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

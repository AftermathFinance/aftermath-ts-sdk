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
}

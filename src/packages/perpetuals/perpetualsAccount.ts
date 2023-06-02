import { Caller } from "../../general/utils/caller";
import { SuiNetwork, Url } from "../../types";

export class PerpetualsAccount extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public account: PerpetualsAccount,
		public readonly network?: SuiNetwork | Url
	) {
		super(
			network,
			`perpetuals/accounts/${"keys::account(user, account_id)"}`
		);
	}

	// refresh account
}

import { SuiAddress, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiCreateAuthAccountBody,
	ApiGetAccessTokenBody,
	ApiGetAccessTokenResponse,
} from "./authTypes";
import { Helpers } from "../../general/utils";

export class Auth extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "auth");
	}

	// =========================================================================
	//  Admin
	// =========================================================================

	public async getAccessToken(inputs: {
		privateKey: string;
	}): Promise<ApiGetAccessTokenResponse> {
		const { privateKey } = inputs;

		const serializedJson = Auth.createSerializedJson("GetAccessToken");
		const message = new TextEncoder().encode(serializedJson);

		const keypair = Helpers.keypairFromPrivateKey(privateKey);

		const { signature } = await keypair.signPersonalMessage(message);

		return this.fetchApi<ApiGetAccessTokenResponse, ApiGetAccessTokenBody>(
			"access-token",
			{
				signature,
				serializedJson,
				walletAddress: Helpers.addLeadingZeroesToType(
					keypair.toSuiAddress()
				),
			}
		);
	}

	// =========================================================================
	//  Admin
	// =========================================================================

	// NOTE: admin only (add docs)
	public async adminCreateAuthAccount(inputs: {
		privateKey: string;
		accountName: string;
		accountWalletAddress: SuiAddress;
		rateLimits: {
			// TODO: refine type definition
			p: string;
			m: { GET?: { l: number }; POST?: { l: number }; l: number };
		}[];
	}): Promise<boolean> {
		const { privateKey, accountName, accountWalletAddress, rateLimits } =
			inputs;

		const serializedJson = Auth.createSerializedJson("AccountCreate", {
			sub: accountName,
			wallet_address:
				Helpers.addLeadingZeroesToType(accountWalletAddress),
			rate_limits: rateLimits, // [{ p: "/test", m: { POST: { l: 1000 } } }]
		});
		const message = new TextEncoder().encode(serializedJson);

		const keypair = Helpers.keypairFromPrivateKey(privateKey);

		const { signature } = await keypair.signPersonalMessage(message);

		return this.fetchApi<boolean, ApiCreateAuthAccountBody>(
			"create-account",
			{
				signature,
				serializedJson,
				walletAddress: Helpers.addLeadingZeroesToType(
					keypair.toSuiAddress()
				),
			}
		);
	}

	// =========================================================================
	//  Private
	// =========================================================================

	private static createSerializedJson(method: string, value = {}) {
		const unixTimestamp = Math.floor(Date.now() / 1000);
		const random = Math.floor(Math.random() * 1024 * 1024);
		const data = {
			date: unixTimestamp,
			nonce: random,
			method: method,
			value: value,
		};
		return JSON.stringify(data);
	}
}

import { CallerConfig, SuiAddress, SuiNetwork } from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiCreateAuthAccountBody,
	ApiGetAccessTokenBody,
	ApiGetAccessTokenResponse,
} from "./authTypes";
import { Helpers } from "../../general/utils";

export class Auth extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config: CallerConfig) {
		super(config, "auth");
	}

	// =========================================================================
	//  User-Facing
	// =========================================================================

	public async init(inputs: { privateKey: string }): Promise<() => void> {
		const { accessToken, expirationTimestamp, header } =
			await this.getAccessToken(inputs);
		console.log({
			accessToken,
			expirationTimestamp,
			header,
		});

		this.setAccessToken(accessToken);

		// const TIMEOUT_REDUCTION_RATIO = 0.9;
		const TIMEOUT_REDUCTION_RATIO = (1 / 60) * (1 / 6);
		const interval =
			(expirationTimestamp - Date.now()) * TIMEOUT_REDUCTION_RATIO;
		const timer = setTimeout(() => this.init(inputs), interval);

		return () => clearTimeout(timer);
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

	private async getAccessToken(inputs: {
		privateKey: string;
	}): Promise<ApiGetAccessTokenResponse> {
		const { privateKey } = inputs;

		const serializedJson = Auth.createSerializedJson("GetAccessToken", {});
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
	//  Private Static
	// =========================================================================

	private static createSerializedJson(method: string, value: Object) {
		const timestampSeconds = Math.floor(Date.now() / 1000);
		const random = Math.floor(Math.random() * 1024 * 1024);
		const data = {
			date: timestampSeconds,
			nonce: random,
			method: method,
			value: value,
		};
		return JSON.stringify(data);
	}
}

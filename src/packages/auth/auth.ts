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

	public async init(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: (args: { message: Uint8Array }) => Promise<{
			signature: string;
		}>;
	}): Promise<() => void> {
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

	// NOTE: admin only (should add docs)
	public async adminCreateAuthAccount(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: (args: { message: Uint8Array }) => Promise<{
			signature: string;
		}>;
		accountName: string;
		accountWalletAddress: SuiAddress;
		rateLimits: {
			p: string;
			m: { GET?: { l: number }; POST?: { l: number } };
		}[];
	}): Promise<boolean> {
		const {
			walletAddress,
			signMessageCallback,
			accountName,
			accountWalletAddress,
			rateLimits,
		} = inputs;

		const serializedJson = Auth.createSerializedJson("AccountCreate", {
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

	private async getAccessToken(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: (args: { message: Uint8Array }) => Promise<{
			signature: string;
		}>;
	}): Promise<ApiGetAccessTokenResponse> {
		const { walletAddress, signMessageCallback } = inputs;

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

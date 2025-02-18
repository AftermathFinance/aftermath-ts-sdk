import {
	CallerConfig,
	SignMessageCallback,
	SuiAddress,
	SuiNetwork,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import {
	ApiCreateAuthAccountBody,
	ApiGetAccessTokenBody,
	ApiGetAccessTokenResponse,
	RateLimit,
} from "./authTypes";
import { Helpers } from "../../general/utils";

export class Auth extends Caller {
	// =========================================================================
	//  Private Class Members
	// =========================================================================

	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private isCanceled = false;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config?: CallerConfig) {
		super(config, "auth");
	}

	// =========================================================================
	//  User-Facing
	// =========================================================================

	public async init(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: SignMessageCallback;
	}): Promise<() => void> {
		// Step 1: Mark as "not canceled" before the new run
		this.isCanceled = false;

		// Step 2: Define a function that does the “work” + schedules next call
		const startRefresh = async () => {
			// If canceled at the time we enter, don’t do anything
			if (this.isCanceled) return;

			const { accessToken, expirationTimestamp } =
				await this.getAccessToken(inputs);
			this.setAccessToken(accessToken);

			if (this.isCanceled) return; // double-check before scheduling next timer

			const TIMEOUT_REDUCTION_RATIO = 0.9;
			const interval =
				(expirationTimestamp - Date.now()) * TIMEOUT_REDUCTION_RATIO;

			// Store the timer so we can cancel it later
			this.refreshTimer = setTimeout(startRefresh, interval);
		};

		// Step 3: Kick off the first refresh
		await startRefresh();

		// Step 4: Return a function that cancels further refreshes
		return () => {
			this.isCanceled = true;
			if (this.refreshTimer) {
				clearTimeout(this.refreshTimer);
			}
		};
	}

	public async initFromSuiKeystore(inputs: {
		walletAddress: SuiAddress;
		path?: string;
	}): Promise<() => void> {
		const { walletAddress, path: pathStr } = inputs;

		if (typeof window === "undefined") {
			const fs = require("fs");
			const path = require("path");
			const os = require("os");

			const keystorePath = pathStr
				? path.join(pathStr)
				: (() => {
						// Locate the user’s home directory
						const homeDir = os.homedir();
						if (!homeDir) {
							throw new Error(
								"cannot obtain home directory path"
							);
						}
						// Construct the path: ~/.sui/sui_config/sui.keystore
						return path.join(
							homeDir,
							".sui",
							"sui_config",
							"sui.keystore"
						);
				  })();

			// Read the JSON file from `keystorePath`
			let privateKeys: string[];
			try {
				const fileContent = fs.readFileSync(keystorePath, "utf-8");
				privateKeys = JSON.parse(fileContent);

				if (!Array.isArray(privateKeys)) {
					throw new Error(
						"Invalid keystore format: Expected an array of private keys"
					);
				}
			} catch (error) {
				throw new Error(`Failed to read keystore file: ${error}`);
			}
			if (privateKeys.length <= 0) {
				throw new Error(`Empty keystore file`);
			}

			const foundKeypair = privateKeys
				.map((privateKey) => Helpers.keypairFromPrivateKey(privateKey))
				.find(
					(keypair) =>
						Helpers.addLeadingZeroesToType(
							keypair.toSuiAddress()
						) === Helpers.addLeadingZeroesToType(walletAddress)
				);
			if (!foundKeypair) {
				throw new Error(
					`No private key found in keystore file for ${walletAddress}`
				);
			}

			return this.init({
				walletAddress,
				signMessageCallback: async ({ message }) =>
					foundKeypair.signPersonalMessage(message),
			});
		}

		throw new Error("`initFromSuiKeystore` must be called on server-side");
	}

	// =========================================================================
	//  Admin
	// =========================================================================

	// NOTE: admin only (should add docs)
	public async adminCreateAuthAccount(inputs: {
		walletAddress: SuiAddress;
		signMessageCallback: SignMessageCallback;
		accountName: string;
		accountWalletAddress: SuiAddress;
		rateLimits: RateLimit[];
	}): Promise<boolean> {
		const {
			walletAddress,
			signMessageCallback,
			accountName,
			accountWalletAddress,
			rateLimits,
		} = inputs;

		const serializedJson = Auth.createSerializedJson<{
			sub: string;
			wallet_address: SuiAddress;
			rate_limits: RateLimit[];
		}>("AccountCreate", {
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
		signMessageCallback: SignMessageCallback;
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

	private static createSerializedJson<DataToSerialize extends Object>(
		method: string,
		value: DataToSerialize
	) {
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

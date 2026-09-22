import { Caller } from "../../general/utils/caller";
import { AftermathTransportError } from "../../general/utils/transportError";
import type { CallerConfig } from "../../types";
import type {
	ApiAchievementsClaimBody,
	ApiAchievementsClaimResponse,
	ApiAchievementsGetDefinitionsResponse,
	ApiAchievementsGetMeBody,
	ApiAchievementsGetMeResponse,
} from "./achievementsTypes";

/**
 * Provides HTTP access to achievement definitions, a wallet's unlocks, and
 * unsigned claim-assist intents.
 *
 * Methods request data from the configured Aftermath API. This client does
 * not mint, sign, or submit transactions. `claimAchievement` returns an
 * unsigned intent that the caller signs and pays for.
 */
export class Achievements extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an achievements HTTP client.
	 *
	 * @param config - Optional network, API host, access token, and API path.
	 */
	constructor(config?: CallerConfig) {
		super(config, "achievements");
	}

	// =========================================================================
	//  Fetching
	// =========================================================================

	/**
	 * Fetches the public achievement catalog.
	 *
	 * The request is a GET with no body.
	 *
	 * @returns Definitions currently exposed by the API.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getDefinitions(): Promise<ApiAchievementsGetDefinitionsResponse> {
		return this.fetchApi<ApiAchievementsGetDefinitionsResponse>("definitions");
	}

	/**
	 * Fetches unlocks and progress for an authenticated wallet.
	 *
	 * Authentication is the Terms personal message. af-fe accepts only a
	 * signature over the fixed string `Aftermath Terms and Conditions` (see
	 * `UserData.termsAndConditionsMessage`), the same session credential used
	 * by rewards and user data.
	 *
	 * @param inputs - Wallet address, base64 UTF-8 bytes of
	 * `Aftermath Terms and Conditions`, and the matching personal-message
	 * signature for that wallet.
	 * @returns The wallet's progress, when stored, and its unlocks. The
	 * decoded response is returned when the wallet addresses match or either
	 * address is missing.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 * A `decode` error is thrown when both wallet addresses are present and
	 * the response wallet address does not match the request.
	 */
	public async getMe(
		inputs: ApiAchievementsGetMeBody
	): Promise<ApiAchievementsGetMeResponse> {
		const response = await this.fetchApi<
			ApiAchievementsGetMeResponse,
			ApiAchievementsGetMeBody
		>("me", inputs);

		if (
			inputs.walletAddress &&
			response?.walletAddress &&
			inputs.walletAddress !== response.walletAddress
		) {
			throw new AftermathTransportError("decode", {
				message:
					"Response walletAddress does not match the request walletAddress",
			});
		}

		return response;
	}

	/**
	 * Requests an unsigned user-pays claim intent for one unlocked achievement.
	 *
	 * Authentication is the Terms personal message. af-fe accepts only a
	 * signature over the fixed string `Aftermath Terms and Conditions` (see
	 * `UserData.termsAndConditionsMessage`), the same session credential used
	 * by `getMe`.
	 *
	 * The response is an unsigned Move call intent. The caller builds, signs,
	 * and pays for the transaction. This method does not mint, sign, or submit.
	 *
	 * @param inputs - Wallet address, terms-message bytes and signature,
	 * achievement id, and an optional on-chain progress object id.
	 * @returns The unsigned claim intent and service notes. The caller signs
	 * and pays gas.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async claimAchievement(
		inputs: ApiAchievementsClaimBody
	): Promise<ApiAchievementsClaimResponse> {
		return await this.fetchApi<
			ApiAchievementsClaimResponse,
			ApiAchievementsClaimBody
		>("claim", inputs);
	}
}

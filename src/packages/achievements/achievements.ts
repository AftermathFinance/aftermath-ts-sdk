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

const OBJECT_ID_PATTERN = /^0x[0-9a-fA-F]+$/;

function isObjectId(value: unknown): value is string {
	return typeof value === "string" && OBJECT_ID_PATTERN.test(value);
}

/**
 * Rejects a claim response that does not describe the requested claim.
 *
 * @throws `AftermathTransportError` with kind `decode` when the wallet,
 * achievement, function, object ids, or progress object id are invalid.
 */
function assertClaimResponse(
	response: ApiAchievementsClaimResponse | undefined,
	inputs: ApiAchievementsClaimBody
): asserts response is ApiAchievementsClaimResponse {
	if (response?.walletAddress !== inputs.walletAddress) {
		throw new AftermathTransportError("decode", {
			message: "Claim response wallet does not match the signed wallet",
		});
	}
	if (response.achievementId !== inputs.achievementId) {
		throw new AftermathTransportError("decode", {
			message: "Claim response achievement does not match the request",
		});
	}
	if (response.intent?.achievementId !== inputs.achievementId) {
		throw new AftermathTransportError("decode", {
			message: "Claim intent achievement does not match the request",
		});
	}
	if (response.intent?.function !== "claim_achievement") {
		throw new AftermathTransportError("decode", {
			message: "Claim intent function is not claim_achievement",
		});
	}
	if (!isObjectId(response.intent?.packageId)) {
		throw new AftermathTransportError("decode", {
			message: "Claim intent package id is invalid",
		});
	}
	if (!isObjectId(response.intent?.registryId)) {
		throw new AftermathTransportError("decode", {
			message: "Claim intent registry id is invalid",
		});
	}
	if (!isObjectId(response.intent?.claimAllowlistId)) {
		throw new AftermathTransportError("decode", {
			message: "Claim intent allowlist id is invalid",
		});
	}
	const progressObjectId = response.intent?.progressObjectId;
	if (progressObjectId != null) {
		if (!isObjectId(progressObjectId)) {
			throw new AftermathTransportError("decode", {
				message: "Claim intent progress object id is invalid",
			});
		}
		if (
			inputs.progressObjectId != null &&
			progressObjectId !== inputs.progressObjectId
		) {
			throw new AftermathTransportError("decode", {
				message: "Claim intent progress object id does not match the request",
			});
		}
	}
}

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
	 * and pays gas. The decoded response is returned when it matches the
	 * request.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 * A `decode` error is thrown when the response wallet address, achievement
	 * id, intent function, object ids, or progress object id do not match the
	 * request.
	 */
	public async claimAchievement(
		inputs: ApiAchievementsClaimBody
	): Promise<ApiAchievementsClaimResponse> {
		const response = await this.fetchApi<
			ApiAchievementsClaimResponse,
			ApiAchievementsClaimBody
		>("claim", inputs);
		assertClaimResponse(response, inputs);
		return response;
	}
}

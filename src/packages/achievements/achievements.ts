import { Caller } from "../../general/utils/caller";
import type { CallerConfig } from "../../types";
import type {
	ApiAchievementsGetDefinitionsResponse,
	ApiAchievementsGetMeBody,
	ApiAchievementsGetMeResponse,
} from "./achievementsTypes";

/**
 * Provides HTTP access to achievement definitions and a wallet's unlocks.
 *
 * Read methods request data from the configured Aftermath API. This client
 * does not mint, sign, or submit transactions.
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
	 * The request uses the signed authentication fields in `inputs`.
	 *
	 * @param inputs - Wallet address, signed message bytes, and signature.
	 * @returns The wallet's progress, when stored, and its unlocks.
	 * @throws `AftermathTransportError` when the API request or response fails.
	 */
	public async getMe(
		inputs: ApiAchievementsGetMeBody
	): Promise<ApiAchievementsGetMeResponse> {
		return this.fetchApi<
			ApiAchievementsGetMeResponse,
			ApiAchievementsGetMeBody
		>("me", inputs);
	}
}

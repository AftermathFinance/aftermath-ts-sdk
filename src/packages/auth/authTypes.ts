import { SuiAddress, Timestamp } from "../../types";

/**
 * Interface specifying allowable rate limits for an auth account.
 * The `p` field indicates the path or endpoint (e.g., "/pools"),
 * while `m` indicates the method-based limits (GET or POST, or both).
 */
export interface RateLimit {
	/**
	 * The path or endpoint to be rate-limited, e.g. "/pools" or "/router/trade".
	 */
	p: string;
	/**
	 * The method-based limit specification.
	 * For example:
	 * ```
	 * { GET: { l: 100 } }
	 * { POST: { l: 50 } }
	 * { GET: { l: 100 }, POST: { l: 100 } }
	 * ```
	 */
	m:
		| { GET: { l: number } }
		| { POST: { l: number } }
		| { GET: { l: number }; POST: { l: number } };
}

// =========================================================================
//  Bodies
// =========================================================================

/**
 * The request body for creating a new auth account, typically
 * reserved for admin usage. The admin signs a JSON containing
 * an "AccountCreate" `method` plus desired sub-account data.
 */
export interface ApiCreateAuthAccountBody {
	/**
	 * The admin's Sui address, zero-padded if necessary.
	 */
	walletAddress: SuiAddress;
	/**
	 * The signature of the serialized JSON data, from the admin's private key.
	 */
	signature: string;
	/**
	 * The JSON string that was signed, containing the method and sub-account details.
	 */
	serializedJson: string;
}

/**
 * The request body for obtaining or refreshing an access token. The user signs
 * a "GetAccessToken" method message plus any relevant fields.
 */
export interface ApiGetAccessTokenBody {
	/**
	 * The user's Sui address, zero-padded if needed.
	 */
	walletAddress: SuiAddress;
	/**
	 * The signature over the JSON-serialized request data (nonce, date, etc.).
	 */
	signature: string;
	/**
	 * The actual JSON string that was signed, e.g.:
	 * ```
	 * {
	 *   "date": 1234567890,
	 *   "nonce": 512,
	 *   "method": "GetAccessToken",
	 *   "value": {}
	 * }
	 * ```
	 */
	serializedJson: string;
}

// =========================================================================
//  Responses
// =========================================================================

/**
 * The response returned when a user obtains or refreshes an access token,
 * containing the token string, the HTTP header name (usually "Authorization"),
 * and the token's expiration timestamp in milliseconds.
 */
export interface ApiGetAccessTokenResponse {
	/**
	 * The newly issued access token to be used in `Authorization` headers.
	 */
	accessToken: string;
	/**
	 * The header key that should contain `accessToken` (e.g., "Authorization").
	 */
	header: string;
	/**
	 * The UNIX timestamp (milliseconds) after which the token is invalid.
	 */
	expirationTimestamp: Timestamp;
}

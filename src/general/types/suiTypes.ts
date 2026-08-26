// =========================================================================
//  Network
// =========================================================================

/**
 * Sui network supported by the SDK.
 *
 * `Aftermath.create` uses the selected value to choose canonical API and
 * fullnode URLs unless `baseUrl` or `fullnodeUrl` overrides them. `LOCAL`
 * selects the local development endpoints.
 *
 * @example
 * ```typescript
 * const network: SuiNetwork = "TESTNET";
 * ```
 */
export type SuiNetwork = "DEVNET" | "TESTNET" | "LOCAL" | "MAINNET";

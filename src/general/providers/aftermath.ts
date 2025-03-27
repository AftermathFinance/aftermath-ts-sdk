import { Pools } from "../../packages/pools/pools";
import {
	CoinType,
	ConfigAddresses,
	SuiAddress,
	SuiNetwork,
	Url,
} from "../../types";
import { Wallet } from "../wallet/wallet";
import { SuiFrens } from "../../packages/suiFrens/suiFrens";
import { Coin } from "../../packages/coin/coin";
import { Faucet } from "../../packages/faucet/faucet";
import { Staking } from "../../packages/staking/staking";
import { Helpers } from "../utils/helpers";
import { Casting } from "../utils/casting";
import { Caller } from "../utils/caller";
import { Prices } from "../prices/prices";
import {
	Auth,
	LeveragedStaking,
	NftAmm,
	ReferralVault,
	Router,
	Sui,
} from "../../packages";
import { Perpetuals } from "../../packages/perpetuals";
import { Oracle } from "../../packages/oracle/oracle";
import { Farms } from "../../packages/farms/farms";
import { DynamicGas } from "../dynamicGas/dynamicGas";
import { AftermathApi } from "./aftermathApi";
import { SuiClient, SuiHTTPTransport } from "@mysten/sui/client";
import { Dca } from "../../packages/dca/dca";
import { Multisig } from "../../packages/multisig/multisig";
import { LimitOrders } from "../../packages/limitOrders/limitOrders";
import { UserData } from "../../packages/userData/userData";

/**
 * The `Aftermath` class serves as the primary entry point for interacting with
 * the Aftermath Finance protocols and utilities on the Sui blockchain.
 * It provides various sub-providers (e.g. `Router`, `Staking`, `Farms`)
 * initialized under the specified network environment (MAINNET, TESTNET, etc).
 *
 * @example
 * ```typescript
 * // Create provider
 * const aftermath = new Aftermath("MAINNET");
 * // Create package provider
 * const router = aftermath.Router();
 * // Call sdk from package provider
 * const supportedCoins = await router.getSupportedCoins();
 *
 * // Or do it all in one go
 * const supportedCoins = await (new Aftermath("MAINNET")).Router().getSupportedCoins();
 * ```
 */
export class Aftermath extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an `Aftermath` provider instance to call the Aftermath Finance APIs
	 * and interact with Sui-based protocols.
	 *
	 * @param network - The target Sui network ("MAINNET", "TESTNET", "DEVNET", or "LOCAL").
	 * @param Provider - Optionally pass a custom `AftermathApi` instance if you already have one.
	 */
	constructor(
		private readonly network?: SuiNetwork,
		private Provider?: AftermathApi
	) {
		super({
			network,
			accessToken: undefined,
		});
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	/**
	 * Initializes the Aftermath provider by fetching addresses from the backend
	 * and configuring the Sui fullnode client. This method must be called before
	 * performing many API operations.
	 *
	 * @param inputs - Optional object allowing you to override the default `fullnodeUrl`.
	 * @example
	 * ```typescript
	 * const afSdk = new Aftermath("MAINNET");
	 * await afSdk.init(); // sets up internal providers
	 * ```
	 */
	public async init(inputs?: { fullnodeUrl: Url }) {
		const addresses = await this.getAddresses();

		// Determine the fullnode URL based on the chosen network or user override
		const fullnodeUrl =
			inputs?.fullnodeUrl ??
			(this.network === "LOCAL"
				? "http://127.0.0.1:9000"
				: this.network === "DEVNET"
				? "https://fullnode.devnet.sui.io:443"
				: this.network === "TESTNET"
				? "https://fullnode.testnet.sui.io:443"
				: "https://fullnode.mainnet.sui.io:443");

		// Create a new AftermathApi provider
		this.Provider = new AftermathApi(
			new SuiClient({
				transport: new SuiHTTPTransport({
					url: fullnodeUrl,
				}),
			}),
			addresses
		);
	}

	/**
	 * Retrieves the Aftermath-specific on-chain addresses (object IDs, packages, etc.).
	 *
	 * @returns A `ConfigAddresses` object containing relevant addresses for the protocol.
	 *
	 * @example
	 * ```typescript
	 * const addresses = await aftermath.getAddresses();
	 * console.log(addresses); // { routerPackageId: "...", someOtherPackageId: "..." }
	 * ```
	 */
	public async getAddresses() {
		return this.fetchApi<ConfigAddresses>("addresses");
	}

	/**
	 * Returns the base URL used for Aftermath API calls.
	 *
	 * @returns The base URL for this instance's API.
	 *
	 * @example
	 * ```typescript
	 * const apiBaseUrl = aftermath.getApiBaseUrl();
	 * console.log(apiBaseUrl); // "https://api.after..."
	 * ```
	 */
	public getApiBaseUrl() {
		return this.apiBaseUrl;
	}

	// =========================================================================
	//  Class Object Creation
	// =========================================================================

	// =========================================================================
	//  Packages
	// =========================================================================

	/**
	 * Returns an instance of the `Pools` class, which handles DEX pool operations
	 * within the Aftermath platform (if supported).
	 */
	public Pools = () => new Pools(this.config, this.Provider);

	/**
	 * Returns an instance of the `Staking` class for Aftermath's staking and unstaking features.
	 */
	public Staking = () => new Staking(this.config, this.Provider);

	/**
	 * Returns an instance of `LeveragedStaking` for advanced leveraged staking workflows (if supported).
	 */
	public LeveragedStaking = () => new LeveragedStaking(this.config);

	/**
	 * Returns an instance of `SuiFrens`, a specialized package for social or utility services.
	 */
	public SuiFrens = () => new SuiFrens(this.config, this.Provider);

	/**
	 * Returns an instance of `Faucet`, allowing test/dev networks to dispense tokens.
	 */
	public Faucet = () => new Faucet(this.config, this.Provider);

	/**
	 * Returns an instance of the `Router` class, which handles smart order routing
	 * across multiple DEX protocols.
	 */
	public Router = () => new Router(this.config);

	/**
	 * Returns an instance of `NftAmm`, which supports NFT AMM (automated market maker) features.
	 */
	public NftAmm = () => new NftAmm(this.config, this.Provider);

	/**
	 * Returns an instance of `ReferralVault` for referral-based interactions in the protocol.
	 */
	public ReferralVault = () => new ReferralVault(this.config, this.Provider);

	/**
	 * Returns an instance of `Perpetuals` for futures or perpetual contract interactions.
	 */
	public Perpetuals = () => new Perpetuals(this.config);

	/**
	 * Returns an instance of `Oracle`, which provides price oracles or other data feed services.
	 */
	public Oracle = () => new Oracle(this.config, this.Provider);

	/**
	 * Returns an instance of `Farms` for yield farming or liquidity mining functionalities.
	 */
	public Farms = () => new Farms(this.config, this.Provider);

	/**
	 * Returns an instance of the `Dca` class, supporting dollar-cost averaging logic.
	 */
	public Dca = () => new Dca(this.config);

	/**
	 * Returns an instance of `Multisig`, enabling multi-signature address creation and management.
	 */
	public Multisig = () => new Multisig(this.config, this.Provider);

	/**
	 * Returns an instance of `LimitOrders`, supporting limit order placement on certain DEX protocols.
	 */
	public LimitOrders = () => new LimitOrders(this.config);

	/**
	 * Returns an instance of `UserData` for creating and managing user-specific data or key storage.
	 */
	public UserData = () => new UserData(this.config);

	// =========================================================================
	//  General
	// =========================================================================

	/**
	 * Returns an instance of `Sui` for low-level Sui chain information and utilities.
	 */
	public Sui = () => new Sui(this.config, this.Provider);

	/**
	 * Returns an instance of `Prices`, which provides coin price data from external or internal feeds.
	 */
	public Prices = () => new Prices(this.config);

	/**
	 * Creates a new `Wallet` instance for a specific user address, enabling you to fetch balances,
	 * transaction history, etc.
	 *
	 * @param address - The Sui address of the wallet (e.g., "0x<32_byte_hex>").
	 */
	public Wallet = (address: SuiAddress) =>
		new Wallet(address, this.config, this.Provider);

	/**
	 * Returns an instance of the `Coin` class, which handles coin metadata, decimal conversions,
	 * and other coin-related utilities for a specified `CoinType`.
	 *
	 * @param coinType - Optionally specify a coin type for immediate usage in coin methods.
	 */
	public Coin = (coinType?: CoinType) =>
		new Coin(coinType, this.config, this.Provider);

	/**
	 * Returns an instance of `DynamicGas`, enabling dynamic assignment of gas
	 * objects or sponsored transactions for user operations.
	 */
	public DynamicGas = () => new DynamicGas(this.config);

	/**
	 * Returns an instance of `Auth`, handling user authentication or token-based flows (if applicable).
	 */
	public Auth = () => new Auth(this.config);

	// =========================================================================
	//  Utils
	// =========================================================================

	/**
	 * Exposes a set of helper functions for general-purpose usage across
	 * the Aftermath ecosystem. Includes utilities for math, logging, etc.
	 */
	public static helpers = Helpers;

	/**
	 * Exposes a set of casting utilities for data type conversions (e.g., BigInt <-> fixed).
	 */
	public static casting = Casting;
}

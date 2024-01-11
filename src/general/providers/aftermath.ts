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
	LeveragedStaking,
	NftAmm,
	ReferralVault,
	Router,
	Sui,
} from "../../packages";
import { HistoricalData } from "../historicalData/historicalData";
import { Perpetuals } from "../../packages/perpetuals";
import { Oracle } from "../../packages/oracle/oracle";
// import { PriceFeeds } from "../priceFeeds/priceFeeds";
import { Farms } from "../../packages/farms/farms";
import { DynamicGas } from "../dynamicGas/dynamicGas";

/**
 * @class Aftermath Provider
 *
 * @example
 * ```
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
	 * Creates `Aftermath` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Aftermath` instance
	 */
	constructor(network?: SuiNetwork) {
		super(network);
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	/**
	 * Retrieves the addresses from the Aftermath API.
	 * @returns A promise that resolves to a ConfigAddresses object.
	 */
	public async getAddresses() {
		return this.fetchApi<ConfigAddresses>("addresses");
	}

	public async getFrontEndConfig() {
		return this.fetchApi<unknown>("config");
	}

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
	 * Returns an instance of the Pools class.
	 * @returns {Pools} An instance of the Pools class.
	 */
	public Pools = () => new Pools(this.network);
	/**
	 * Creates a new instance of the Staking class.
	 * @returns A new instance of the Staking class.
	 */
	public Staking = () => new Staking(this.network);
	public LeveragedStaking = () => new LeveragedStaking(this.network);
	public SuiFrens = () => new SuiFrens(this.network);
	public Faucet = () => new Faucet(this.network);
	/**
	 * Creates a new instance of the Router class with the current network.
	 * @returns A new instance of the Router class.
	 */
	public Router = () => new Router(this.network);
	public NftAmm = () => new NftAmm(this.network);
	public ReferralVault = () => new ReferralVault(this.network);
	public Perpetuals = () => new Perpetuals(this.network);
	public Oracle = () => new Oracle(this.network);
	/**
	 * Creates a new instance of the Farms class.
	 * @returns A new instance of the Farms class.
	 */
	public Farms = () => new Farms(this.network);

	// =========================================================================
	//  General
	// =========================================================================

	public Sui = () => new Sui(this.network);
	public Prices = () => new Prices(this.network);
	/**
	 * Creates a new instance of the Wallet class.
	 * @param address - The address of the wallet.
	 * @returns A new instance of the Wallet class.
	 */
	public Wallet = (address: SuiAddress) => new Wallet(address, this.network);
	/**
	 * Creates a new instance of the Coin class.
	 * @param coinType The type of coin to create.
	 * @returns A new instance of the Coin class.
	 */
	public Coin = (coinType?: CoinType) => new Coin(coinType, this.network);
	public HistoricalData = () => new HistoricalData(this.network);
	// public PriceFeeds = () => new PriceFeeds(this.network);
	public DynamicGas = () => new DynamicGas(this.network);

	// =========================================================================
	//  Utils
	// =========================================================================

	public static helpers = Helpers;
	public static casting = Casting;
}

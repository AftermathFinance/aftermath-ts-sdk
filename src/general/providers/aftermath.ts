import { SuiAddress } from "@mysten/sui.js";
import { Pools } from "../../packages/pools/pools";
import { CoinType, SuiNetwork, Url } from "../../types";
import { Wallet } from "../wallet/wallet";
import { SuiFrens } from "../../packages/suiFrens/suiFrens";
import { Coin } from "../../packages/coin/coin";
import { Faucet } from "../../packages/faucet/faucet";
import { Staking } from "../../packages/staking/staking";
import { Helpers } from "../utils/helpers";
import { Casting } from "../utils/casting";
import { Caller } from "../utils/caller";
import { Prices } from "../prices/prices";
import { NftAmm, ReferralVault, Router, Sui } from "../../packages";
import { HistoricalData } from "../historicalData/historicalData";
import { Perpetuals } from "../../packages/perpetuals";
import { Farms } from "../../packages/farms/farms";

/**
 * @class Aftermath Provider
 *
 * @example
 * ```
 * // Create provider
 * const aftermath = new Aftermath("TESTNET");
 * // Create package provider
 * const router = aftermath.Router();
 * // Call sdk from package provider
 * const supportedCoins = await router.getSupportedCoins();
 *
 * // Or do it all in one go
 * const supportedCoins = await (new Aftermath("TESTNET")).Router().getSupportedCoins();
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
	constructor(network?: SuiNetwork | Url) {
		super(network);
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Class Object Creation
	// =========================================================================

	// =========================================================================
	//  Packages
	// =========================================================================

	public Pools = () => new Pools(this.network);
	public Staking = () => new Staking(this.network);
	public SuiFrens = () => new SuiFrens(this.network);
	public Faucet = () => new Faucet(this.network);
	public Router = () => new Router(this.network);
	public NftAmm = () => new NftAmm(this.network);
	public ReferralVault = () => new ReferralVault(this.network);
	public Perpetuals = () => new Perpetuals(this.network);
	public Farms = () => new Farms(this.network);

	// =========================================================================
	//  General
	// =========================================================================

	public Sui = () => new Sui(this.network);
	public Prices = () => new Prices(this.network);
	public Wallet = (address: SuiAddress) => new Wallet(address, this.network);
	public Coin = (coinType?: CoinType) => new Coin(coinType, this.network);
	public HistoricalData = () => new HistoricalData(this.network);

	// =========================================================================
	//  Utils
	// =========================================================================

	public static helpers = Helpers;
	public static casting = Casting;
}

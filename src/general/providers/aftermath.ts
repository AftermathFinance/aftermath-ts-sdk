import { SuiAddress } from "@mysten/sui.js";
import { Pools } from "../../packages/pools/pools";
import { CoinType, SuiNetwork } from "../../types";
import { Wallet } from "../wallet/wallet";
import { Capys } from "../../packages/capys/capys";
import { Coin } from "../../packages/coin/coin";
import { Faucet } from "../../packages/faucet/faucet";
import { Staking } from "../../packages/staking/staking";
import { Helpers } from "../utils/helpers";
import { Casting } from "../utils/casting";
import { Caller } from "../utils/caller";
import { Prices } from "../prices/prices";
import { NftAmm, ReferralVault, Router, Sui } from "../../packages";

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
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	/**
	 * Creates `Aftermath` provider to call api.
	 *
	 * @param network - The Sui network to interact with
	 * @returns New `Aftermath` instance
	 */
	constructor(network?: SuiNetwork) {
		super(network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Class Object Creation
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Packages
	/////////////////////////////////////////////////////////////////////

	public Pools = () => new Pools(this.network);
	public Staking = () => new Staking(this.network);
	public Capys = () => new Capys(this.network);
	public Faucet = () => new Faucet(this.network);
	public Router = () => new Router(this.network);
	public NftAmm = () => new NftAmm(this.network);
	public ReferralVault = () => new ReferralVault(this.network);

	/////////////////////////////////////////////////////////////////////
	//// General
	/////////////////////////////////////////////////////////////////////

	public Sui = () => new Sui(this.network);
	public Prices = () => new Prices(this.network);
	public Wallet = (address: SuiAddress) => new Wallet(address, this.network);
	public Coin = (coinType: CoinType) => new Coin(coinType, this.network);

	/////////////////////////////////////////////////////////////////////
	//// Utils
	/////////////////////////////////////////////////////////////////////

	public static helpers = Helpers;
	public static casting = Casting;
}

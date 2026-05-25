import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Auth, NftAmm, ReferralVault, Router, Sui } from "../../packages";
import { Coin } from "../../packages/coin/coin";
import { Dca } from "../../packages/dca/dca";
import { Farms } from "../../packages/farms/farms";
import { Faucet } from "../../packages/faucet/faucet";
import { GasPools } from "../../packages/gasPools";
import { LimitOrders } from "../../packages/limitOrders/limitOrders";
import { Multisig } from "../../packages/multisig/multisig";
import { Perpetuals } from "../../packages/perpetuals";
import { Pools } from "../../packages/pools/pools";
import { Referrals } from "../../packages/referrals/referrals";
import { Rewards } from "../../packages/rewards/rewards";
import { Staking } from "../../packages/staking/staking";
import { SuiFrens } from "../../packages/suiFrens/suiFrens";
import { UserData } from "../../packages/userData/userData";
import type {
	CoinType,
	ConfigAddresses,
	SuiAddress,
	SuiNetwork,
	TranslatedMoveError,
	Url,
} from "../../types";
import { DynamicGas } from "../dynamicGas/dynamicGas";
import { Prices } from "../prices/prices";
import { Caller } from "../utils/caller";
import { Casting } from "../utils/casting";
import { Helpers } from "../utils/helpers";
import { Wallet } from "../wallet/wallet";
import { AftermathApi } from "./aftermathApi";

/**
 * Options accepted by {@link Aftermath.create}. All fields are optional —
 * pass `{}` for the canonical mainnet setup.
 */
export interface AftermathOptions {
	/**
	 * The target Sui network. Determines the canonical API host and
	 * Sui fullnode URL when no explicit overrides are supplied.
	 * @default "MAINNET"
	 */
	network?: SuiNetwork;
	/**
	 * Explicit override for the Aftermath API host (e.g.
	 * `"http://localhost:8080"`). Useful for staging or local backends.
	 */
	baseUrl?: Url;
	/**
	 * Explicit override for the Sui fullnode URL.
	 */
	fullnodeUrl?: Url;
	/**
	 * Override for the API path segment between host and package prefix.
	 * Defaults to `"api"`. Override only when targeting a backend that
	 * mounts the Aftermath API under a different path.
	 */
	apiEndpoint?: string;
	/**
	 * Preloaded on-chain addresses. When supplied, `create` skips the
	 * network round-trip that normally fetches them.
	 */
	addresses?: ConfigAddresses;
	/**
	 * Pre-built `AftermathApi` instance. When supplied, `create` uses it
	 * directly and skips address discovery and Sui client setup entirely.
	 */
	api?: AftermathApi;
}

/**
 * The `Aftermath` class is the primary entry point for interacting with
 * the Aftermath Finance protocols and utilities on the Sui blockchain.
 * It exposes sub-providers (e.g. `Router`, `Staking`, `Farms`) configured
 * for the chosen network.
 *
 * Instances are created through the async {@link Aftermath.create} factory
 * — direct construction is not supported.
 *
 * @example
 * ```typescript
 * const aftermath = await Aftermath.create({ network: "MAINNET" });
 * const supportedCoins = await aftermath.Router().getSupportedCoins();
 * ```
 */
export class Aftermath extends Caller {
	// =========================================================================
	//  Factory
	// =========================================================================

	/**
	 * Constructs and fully initializes an `Aftermath` instance.
	 *
	 * Resolves on-chain addresses, configures the Sui fullnode client, and
	 * returns a ready-to-use instance. Pass `addresses` or `api` to skip
	 * the corresponding bootstrap steps.
	 */
	static async create(options: AftermathOptions = {}): Promise<Aftermath> {
		const af = new Aftermath(options);
		await af.bootstrap();
		return af;
	}

	// =========================================================================
	//  Construction (private — use Aftermath.create)
	// =========================================================================

	private readonly options: AftermathOptions;

	private constructor(options: AftermathOptions) {
		super({
			network: options.network ?? "MAINNET",
			baseUrl: options.baseUrl,
			apiEndpoint: options.apiEndpoint,
			accessToken: undefined,
		});
		this.options = options;
	}

	/**
	 * Resolves addresses and wires up the internal `AftermathApi`. Called
	 * exactly once by the {@link Aftermath.create} factory.
	 */
	private async bootstrap(): Promise<void> {
		if (this.options.api) {
			this.api = this.options.api;
			return;
		}

		const network = this.network;
		const addresses = this.options.addresses ?? (await this.getAddresses());
		const fullnodeUrl =
			this.options.fullnodeUrl ?? Caller.defaultFullnodeUrl(network);

		const client = new SuiJsonRpcClient({
			url: fullnodeUrl,
			network: network.toLowerCase(),
		});

		this.api = new AftermathApi(client, addresses);
	}

	/**
	 * The fully-bootstrapped low-level API provider. Set by `bootstrap()`
	 * before any accessor is callable.
	 */
	private api!: AftermathApi;

	// =========================================================================
	//  Public Accessors
	// =========================================================================

	/**
	 * The Sui network this provider is configured for (e.g. "MAINNET").
	 */
	get network(): SuiNetwork {
		return (this.config.network as SuiNetwork) ?? "MAINNET";
	}

	/**
	 * The resolved API base URL for this instance.
	 */
	getApiBaseUrl(): Url | undefined {
		return this.apiBaseUrl;
	}

	/**
	 * Fetches the Aftermath on-chain addresses (object IDs, packages, etc.)
	 * directly from the API. Typically you don't need to call this — the
	 * `create` factory handles it. Useful for cache warmers or tooling.
	 */
	getAddresses(): Promise<ConfigAddresses> {
		return this.fetchApi<ConfigAddresses>("addresses");
	}

	/**
	 * Attempts to decode a raw Move abort/error string into a structured
	 * error code, package ID, module name, and human-readable message.
	 * Returns `undefined` when no registered package recognizes the error.
	 *
	 * Thin pass-through to the underlying {@link AftermathApi} so consumers
	 * don't need to reach into the private `api` field.
	 */
	translateMoveErrorMessage(
		inputs: { errorMessage: string }
	): TranslatedMoveError | undefined {
		return this.api.translateMoveErrorMessage(inputs);
	}

	// =========================================================================
	//  Packages
	// =========================================================================

	/** DEX pool operations. */
	Pools = () => new Pools(this.config, this.api);

	/** Liquid staking and unstaking. */
	Staking = () => new Staking(this.config, this.api);

	/** SuiFrens — specialized social/utility package. */
	SuiFrens = () => new SuiFrens(this.config, this.api);

	/** Test-network faucet for dispensing tokens. */
	Faucet = () => new Faucet(this.config, this.api);

	/** Smart order router across DEX protocols. */
	Router = () => new Router(this.config);

	/** NFT AMM operations. */
	NftAmm = () => new NftAmm(this.config, this.api);

	/**
	 * Referral vault interactions.
	 * @deprecated Use `Referrals` instead.
	 */
	ReferralVault = () => new ReferralVault(this.config);

	/** Referral-program interactions. */
	Referrals = () => new Referrals(this.config);

	/** Shared gas pool interactions. */
	GasPools = () => new GasPools(this.config, this.api);

	/** Perpetual / futures contracts. */
	Perpetuals = () => new Perpetuals(this.config, this.api);

	/** User reward-point queries. */
	Rewards = () => new Rewards(this.config, this.api);

	/** Yield farming / liquidity mining. */
	Farms = () => new Farms(this.config, this.api);

	/** Dollar-cost averaging. */
	Dca = () => new Dca(this.config);

	/** Multi-signature address creation and management. */
	Multisig = () => new Multisig(this.config, this.api);

	/** Limit orders on supported DEX protocols. */
	LimitOrders = () => new LimitOrders(this.config);

	/** User-specific data / key storage. */
	UserData = () => new UserData(this.config);

	// =========================================================================
	//  General
	// =========================================================================

	/** Low-level Sui chain utilities. */
	Sui = () => new Sui(this.config, this.api);

	/** Coin price feeds. */
	Prices = () => new Prices(this.config);

	/**
	 * Creates a `Wallet` instance scoped to a specific user address.
	 * @param address - The Sui address (e.g., `"0x..."`).
	 */
	Wallet = (address: SuiAddress) => new Wallet(address, this.config, this.api);

	/**
	 * Returns a `Coin` helper for the given coin type. Pass `undefined`
	 * for generic coin-metadata utilities.
	 */
	Coin = (coinType?: CoinType) => new Coin(coinType, this.config, this.api);

	/** Dynamic gas-object assignment for sponsored transactions. */
	DynamicGas = () => new DynamicGas(this.config);

	/** Authentication / token-based flows. */
	Auth = () => new Auth(this.config);

	// =========================================================================
	//  Static utilities
	// =========================================================================

	/** General-purpose helpers (math, logging, etc.). */
	static helpers = Helpers;

	/** Casting utilities for data type conversions (BigInt <-> IFixed, etc.). */
	static casting = Casting;
}

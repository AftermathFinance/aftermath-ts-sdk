import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	PerpetualsMarketState,
	PerpetualsMarketData,
	PerpetualsAccountData,
	PerpetualsMarketId,
	ApiPerpetualsOwnedAccountCapsBody,
	PerpetualsPosition,
	PerpetualsOrderSide,
	PerpetualsOrderbook,
	CoinType,
	PerpetualsOrderId,
	FilledTakerOrderEvent,
	Timestamp,
	PerpetualsMarketCandleDataPoint,
	ApiPerpetualsHistoricalMarketDataResponse,
	PerpetualsAccountCap,
	PerpetualsAccountId,
	PerpetualsAccountObject,
	IFixed,
	MoveErrorCode,
	CallerConfig,
	SuiAddress,
	ObjectId,
	ApiPerpetualsMarkets24hrStatsResponse,
	ApiPerpetualsAccountCapsBody,
	PerpetualsVaultObject,
	Percentage,
	Balance,
	PerpetualsVaultCap,
	PerpetualsVaultWithdrawRequest,
	ApiPerpetualsVaultWithdrawRequestsBody,
	PerpetualsVaultCapExtended,
	PerpetualsOrderPrice,
	ApiTransactionResponse,
	PerpetualsWsUpdatesSubscriptionMessage,
	PerpetualsWsUpdatesResponseMessage,
	PerpetualsWsCandleResponseMessage,
	ApiPerpetualsCreateVaultBody,
	ApiPerpetualsCreateVaultCapBody,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";
import { IFixedUtils } from "../../general/utils/iFixedUtils";
import { FixedUtils } from "../../general/utils/fixedUtils";
import { Casting, Helpers } from "../../general/utils";
import { PerpetualsOrderUtils } from "./utils";
import { AftermathApi } from "../../general/providers";
import { Coin } from "../coin";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { PerpetualsVault } from "./perpetualsVault";

/**
 * High-level client for interacting with Aftermath Perpetuals.
 *
 * This class exposes a typed, ergonomic interface over the Perpetuals HTTP API
 * and websocket endpoints, including:
 *
 * - Market discovery (`getAllMarkets`, `getMarkets`, `getMarket`)
 * - Vault discovery (`getAllVaults`, `getVaults`, `getVault`)
 * - Account & position data (`getAccount`, `getAccounts`, `getAccountObjects`)
 * - Ownership queries (`getOwnedAccountCaps`, `getOwnedVaultCaps`)
 * - Historical data & stats (`getMarketHistoricalData`, `getMarkets24hrStats`)
 * - Pricing helpers (`getPrices`, `getLpCoinPrices`)
 * - Transaction builders (`getCreateAccountTx`, `getCreateVaultCapTx`, `getCreateVaultTx`)
 * - Websocket feeds (`openUpdatesWebsocketStream`, `openMarketCandlesWebsocketStream`)
 *
 * Typical usage via the root SDK:
 *
 * ```ts
 * import { Aftermath } from "@aftermath/sdk";
 *
 * const afSdk = new Aftermath("MAINNET");
 * await afSdk.init();
 *
 * const perps = afSdk.Perpetuals();
 *
 * // Fetch markets for a given collateral coin type
 * const markets = await perps.getAllMarkets({
 *   collateralCoinType: "0x2::sui::SUI",
 * });
 *
 * // Fetch account + positions for a given account cap
 * const [accountCap] = await perps.getOwnedAccountCaps({
 *   walletAddress: "0x...",
 * });
 *
 * const account = await perps.getAccount({ accountCap });
 *
 * // Build a create-account transaction (not signed or sent)
 * const createAccountTx = await perps.getCreateAccountTx({
 *   walletAddress: "0x...",
 *   collateralCoinType: "0x2::sui::SUI",
 * });
 * ```
 */
export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Helper namespace for order-specific utilities such as parsing order IDs,
	 * extracting price bits, etc.
	 *
	 * This is a direct alias of {@link PerpetualsOrderUtils}.
	 */
	public static readonly OrderUtils = PerpetualsOrderUtils;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a new Perpetuals client.
	 *
	 * @param config - Optional caller configuration (network, auth token, etc.).
	 * @param Provider - Optional shared {@link AftermathApi} provider instance. When
	 *   provided, transaction-building helpers (e.g. `getCreateAccountTx`) can
	 *   derive serialized `txKind` from a `Transaction` object.
	 */
	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetch all perpetual markets for a given collateral coin type.
	 *
	 * @param inputs.collateralCoinType - Coin type used as collateral, e.g. `"0x2::sui::SUI"`.
	 * @returns Array of {@link PerpetualsMarket} instances, each wrapping the raw market data.
	 *
	 * @example
	 * ```ts
	 * const markets = await perps.getAllMarkets({
	 *   collateralCoinType: "0x2::sui::SUI",
	 * });
	 * ```
	 */
	public async getAllMarkets(inputs: {
		collateralCoinType: CoinType;
	}): Promise<PerpetualsMarket[]> {
		const marketDatas = await this.fetchApi<
			PerpetualsMarketData[],
			{
				collateralCoinType: CoinType;
			}
		>("all-markets", inputs);
		return marketDatas.map(
			(marketData) => new PerpetualsMarket(marketData, this.config)
		);
	}

	/**
	 * Fetch a single market by ID.
	 *
	 * Internally calls {@link getMarkets} and returns the first entry.
	 *
	 * @param inputs.marketId - The market (clearing house) object ID.
	 * @returns A {@link PerpetualsMarket} instance corresponding to the given ID.
	 *
	 * @example
	 * ```ts
	 * const market = await perps.getMarket({ marketId: "0x..." });
	 * ```
	 */
	public async getMarket(inputs: {
		marketId: PerpetualsMarketId;
		// withOrderbook: boolean;
	}): Promise<PerpetualsMarket> {
		const markets = await this.getMarkets({
			marketIds: [inputs.marketId],
		});
		return markets[0];
	}

	/**
	 * Fetch multiple markets by ID.
	 *
	 * NOTE: the backend currently always returns market data together with an
	 * orderbook object, but this SDK helper ignores the orderbook and constructs
	 * {@link PerpetualsMarket} instances from the `market` field only.
	 *
	 * @param inputs.marketIds - Array of market object IDs to fetch.
	 * @returns Array of {@link PerpetualsMarket} objects in the same order as `marketIds`.
	 *
	 * @example
	 * ```ts
	 * const [marketA, marketB] = await perps.getMarkets({
	 *   marketIds: ["0x..A", "0x..B"],
	 * });
	 * ```
	 */
	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
		// withOrderbook: boolean;
	}): Promise<PerpetualsMarket[]> {
		const marketDatas = await this.fetchApi<
			{
				market: PerpetualsMarketData;
				orderbook: PerpetualsOrderbook;
			}[],
			{
				marketIds: PerpetualsMarketId[];
				withOrderbook: boolean | undefined;
			}
		>("markets", {
			...inputs,
			withOrderbook: false,
		});
		return marketDatas.map(
			(marketData) =>
				// TODO: make orderbook as input ?
				new PerpetualsMarket(marketData.market, this.config)
		);
	}

	/**
	 * Fetch all vaults on the current network.
	 *
	 * @returns Array of {@link PerpetualsVault} objects, each wrapping a vault on-chain object.
	 *
	 * @example
	 * ```ts
	 * const vaults = await perps.getAllVaults();
	 * ```
	 */
	public async getAllVaults(): Promise<PerpetualsVault[]> {
		const vaultObjects = await this.fetchApi<PerpetualsVaultObject[], {}>(
			"vaults",
			{}
		);
		return vaultObjects.map(
			(vaultObject) => new PerpetualsVault(vaultObject, this.config)
		);
	}

	/**
	 * Fetch a single vault by ID.
	 *
	 * Internally calls {@link getVaults} and returns the first entry.
	 *
	 * @param inputs.marketId - The vault object ID (note: named `marketId` for historical reasons).
	 * @returns A {@link PerpetualsVault} instance.
	 *
	 * @example
	 * ```ts
	 * const vault = await perps.getVault({ marketId: "0x..." });
	 * ```
	 */
	public async getVault(inputs: {
		marketId: ObjectId;
	}): Promise<PerpetualsVault> {
		const vaults = await this.getVaults({
			vaultIds: [inputs.marketId],
		});
		return vaults[0];
	}

	/**
	 * Fetch multiple vaults by ID.
	 *
	 * @param inputs.vaultIds - Array of vault object IDs.
	 * @returns Array of {@link PerpetualsVault} objects in the same order as `vaultIds`.
	 *
	 * @example
	 * ```ts
	 * const [vaultA, vaultB] = await perps.getVaults({
	 *   vaultIds: ["0x..A", "0x..B"],
	 * });
	 * ```
	 */
	public async getVaults(inputs: {
		vaultIds: ObjectId[];
	}): Promise<PerpetualsVault[]> {
		const vaultObjects = await this.fetchApi<
			PerpetualsVaultObject[],
			{
				vaultIds: ObjectId[];
			}
		>("vaults", inputs);
		return vaultObjects.map(
			(vaultObject) => new PerpetualsVault(vaultObject, this.config)
		);
	}

	/**
	 * Convenience helper to fetch a single account (positions + account object) from an account cap.
	 *
	 * Internally calls {@link getAccounts} and returns the first entry.
	 *
	 * @param inputs.accountCap - Account-cap or vault-cap-extended object to derive account metadata from.
	 * @param inputs.marketIds - Optional list of markets to filter positions by.
	 * @returns A {@link PerpetualsAccount} instance.
	 *
	 * @example
	 * ```ts
	 * const [accountCap] = await perps.getOwnedAccountCaps({ walletAddress: "0x..." });
	 * const account = await perps.getAccount({ accountCap });
	 * ```
	 */
	// TODO: merge this with `getAccountObjects` as an option ?
	public async getAccount(inputs: {
		accountCap: PerpetualsAccountCap | PerpetualsVaultCapExtended;
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccount> {
		const { accountCap, marketIds } = inputs;
		return (
			await this.getAccounts({
				accountCaps: [accountCap],
				marketIds,
			})
		)[0];
	}

	/**
	 * Fetch one or more accounts (positions + account objects) from account caps.
	 *
	 * This composes two API calls:
	 * - `/perpetuals/accounts/positions` to fetch {@link PerpetualsAccountObject}s
	 * - Local pairing with the provided `accountCaps`
	 *
	 * The resulting {@link PerpetualsAccount} objects wrap both the on-chain account
	 * data and the cap metadata in a single helper.
	 *
	 * @param inputs.accountCaps - Array of account caps or vault-cap-extended objects.
	 * @param inputs.marketIds - Optional list of market IDs to filter positions by.
	 * @returns Array of {@link PerpetualsAccount} instances in the same order as `accountCaps`.
	 *
	 * @example
	 * ```ts
	 * const accountCaps = await perps.getOwnedAccountCaps({ walletAddress: "0x..." });
	 * const accounts = await perps.getAccounts({ accountCaps });
	 * ```
	 */
	// TODO: make account fetching get positions and account cap data all at once ?
	public async getAccounts(inputs: {
		accountCaps: (PerpetualsAccountCap | PerpetualsVaultCapExtended)[];
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccount[]> {
		const { accountCaps, marketIds } = inputs;
		if (accountCaps.length <= 0) return [];

		// TODO: handle different collateral coin types
		const accountObjects = await this.getAccountObjects({
			accountIds: accountCaps.map((accountCap) => accountCap.accountId),
			collateralCoinType: accountCaps[0].collateralCoinType,
			marketIds,
		});
		return accountObjects.map(
			(account, index) =>
				new PerpetualsAccount(
					account,
					accountCaps[index],
					this.config,
					this.Provider
				)
		);
	}

	/**
	 * Fetch raw account objects (including positions) for one or more account IDs.
	 *
	 * @param inputs.accountIds - List of account IDs to query.
	 * @param inputs.collateralCoinType - Collateral coin type to use for valuation.
	 * @param inputs.marketIds - Optional list of market IDs to filter positions by.
	 * @returns Array of {@link PerpetualsAccountObject} in the same order as `accountIds`.
	 *
	 * @example
	 * ```ts
	 * const accountObjects = await perps.getAccountObjects({
	 *   accountIds: [123n, 456n],
	 *   collateralCoinType: "0x2::sui::SUI",
	 * });
	 * ```
	 */
	// TODO: handle different collateral coin types ?
	public async getAccountObjects(inputs: {
		accountIds: PerpetualsAccountId[];
		collateralCoinType: CoinType;
		marketIds?: PerpetualsMarketId[];
	}): Promise<PerpetualsAccountObject[]> {
		const { accountIds, collateralCoinType, marketIds } = inputs;
		if (accountIds.length <= 0) return [];

		return this.fetchApi<
			PerpetualsAccountObject[],
			{
				accountIds: PerpetualsAccountId[];
				collateralCoinType: CoinType;
				marketIds: PerpetualsMarketId[] | undefined;
			}
		>("accounts/positions", {
			accountIds,
			collateralCoinType,
			marketIds,
		});
	}

	/**
	 * Fetch all account caps (perpetuals accounts) owned by a wallet, optionally
	 * filtered by collateral coin types.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @param inputs.collateralCoinTypes - Optional list of collateral coin types to filter by.
	 * @returns Array of {@link PerpetualsAccountCap} objects.
	 *
	 * @example
	 * ```ts
	 * const caps = await perps.getOwnedAccountCaps({
	 *   walletAddress: "0x...",
	 *   collateralCoinTypes: ["0x2::sui::SUI"],
	 * });
	 * ```
	 */
	public async getOwnedAccountCaps(
		inputs: ApiPerpetualsOwnedAccountCapsBody & {
			collateralCoinTypes?: CoinType[];
		}
	): Promise<PerpetualsAccountCap[]> {
		const { walletAddress, collateralCoinTypes } = inputs;

		return this.fetchApi<
			PerpetualsAccountCap[],
			{
				walletAddress: SuiAddress;
				collateralCoinTypes: CoinType[] | undefined;
			}
		>("accounts/owned", {
			walletAddress,
			collateralCoinTypes,
		});
	}

	/**
	 * Fetch all vault caps owned by a wallet.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @returns Array of {@link PerpetualsVaultCap} objects.
	 *
	 * @example
	 * ```ts
	 * const vaultCaps = await perps.getOwnedVaultCaps({
	 *   walletAddress: "0x...",
	 * });
	 * ```
	 */
	public async getOwnedVaultCaps(
		inputs: ApiPerpetualsOwnedAccountCapsBody
	): Promise<PerpetualsVaultCap[]> {
		return this.fetchApi<
			PerpetualsVaultCap[],
			{
				walletAddress: SuiAddress;
			}
		>("vaults/owned-vault-caps", inputs);
	}

	/**
	 * Fetch all pending vault withdrawal requests created by a given wallet.
	 *
	 * @param inputs.walletAddress - Wallet address that created the withdraw requests.
	 * @returns Array of {@link PerpetualsVaultWithdrawRequest}.
	 *
	 * @example
	 * ```ts
	 * const withdrawRequests = await perps.getOwnedWithdrawRequests({
	 *   walletAddress: "0x...",
	 * });
	 * ```
	 */
	public async getOwnedWithdrawRequests(inputs: {
		walletAddress: SuiAddress;
	}) {
		return this.fetchApi<
			PerpetualsVaultWithdrawRequest[],
			ApiPerpetualsVaultWithdrawRequestsBody
		>("vaults/owned-withdraw-requests", {
			...inputs,
			// vaultIds: undefined,
		});
	}

	/**
	 * Fetch account caps by their cap object IDs.
	 *
	 * @param inputs.accountCapIds - List of account cap object IDs.
	 * @returns Array of {@link PerpetualsAccountCap}.
	 *
	 * @example
	 * ```ts
	 * const caps = await perps.getAccountCaps({
	 *   accountCapIds: ["0xcap1", "0xcap2"],
	 * });
	 * ```
	 */
	public async getAccountCaps(
		inputs: ApiPerpetualsAccountCapsBody
	): Promise<PerpetualsAccountCap[]> {
		return this.fetchApi<
			PerpetualsAccountCap[],
			ApiPerpetualsAccountCapsBody
		>("accounts", inputs);
	}

	// =========================================================================
	//  Data
	// =========================================================================

	/**
	 * Fetch historical OHLCV candle data for a single market.
	 *
	 * @param inputs.marketId - Market ID to query.
	 * @param inputs.fromTimestamp - Start timestamp (inclusive).
	 * @param inputs.toTimestamp - End timestamp (exclusive).
	 * @param inputs.intervalMs - Candle interval in milliseconds.
	 * @returns Array of {@link PerpetualsMarketCandleDataPoint}.
	 *
	 * @example
	 * ```ts
	 * const candles = await perps.getMarketHistoricalData({
	 *   marketId: "0x...",
	 *   fromTimestamp: Date.now() - 24 * 60 * 60 * 1000,
	 *   toTimestamp: Date.now(),
	 *   intervalMs: 60_000, // 1 minute
	 * });
	 * ```
	 */
	public getMarketHistoricalData(inputs: {
		marketId: PerpetualsMarketId;
		fromTimestamp: Timestamp;
		toTimestamp: Timestamp;
		intervalMs: number;
	}): Promise<ApiPerpetualsHistoricalMarketDataResponse> {
		const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;
		return this.fetchApi("market/candle-history", {
			marketId,
			fromTimestamp,
			toTimestamp,
			intervalMs,
		});
	}

	/**
	 * Fetch 24-hour stats for multiple markets.
	 *
	 * @param inputs.marketIds - Market IDs to query.
	 * @returns Array of 24hr stats aligned with `marketIds`.
	 *
	 * @example
	 * ```ts
	 * const stats = await perps.getMarkets24hrStats({
	 *   marketIds: ["0x...", "0x..."],
	 * });
	 * ```
	 */
	public getMarkets24hrStats(inputs: {
		marketIds: PerpetualsMarketId[];
	}): Promise<ApiPerpetualsMarkets24hrStatsResponse> {
		return this.fetchApi<
			ApiPerpetualsMarkets24hrStatsResponse,
			{
				marketIds: PerpetualsMarketId[];
			}
		>("markets/24hr-stats", inputs);
	}

	// =========================================================================
	//  Prices
	// =========================================================================

	/**
	 * Fetch the latest oracle prices (base & collateral) for one or more markets.
	 *
	 * @param inputs.marketIds - List of market IDs to query.
	 * @returns Array of `{ basePrice, collateralPrice }` objects in the same order as `marketIds`.
	 *   Returns `[]` if `marketIds` is empty.
	 *
	 * @example
	 * ```ts
	 * const prices = await perps.getPrices({ marketIds: ["0x..."] });
	 * const { basePrice, collateralPrice } = prices[0];
	 * ```
	 */
	public async getPrices(inputs: { marketIds: ObjectId[] }): Promise<
		{
			basePrice: number;
			collateralPrice: number;
		}[]
	> {
		if (inputs.marketIds.length <= 0) return [];
		return this.fetchApi("markets/prices", inputs);
	}

	/**
	 * Fetch LP coin prices (in collateral units) for a set of vaults.
	 *
	 * @param inputs.vaultIds - List of vault IDs to query.
	 * @returns Array of LP prices corresponding to each vault ID; returns `[]` if none are provided.
	 *
	 * @example
	 * ```ts
	 * const [price] = await perps.getLpCoinPrices({ vaultIds: ["0x..."] });
	 * ```
	 */
	public async getLpCoinPrices(inputs: {
		vaultIds: ObjectId[];
	}): Promise<number[]> {
		if (inputs.vaultIds.length <= 0) return [];
		return this.fetchApi("vaults/lp-coin-prices", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Build a `create-account` transaction for Aftermath Perpetuals.
	 *
	 * This helper:
	 * - Optionally converts a {@link Transaction} into a serialized `txKind`
	 *   via the shared `Provider` (if present).
	 * - Calls the `/perpetuals/transactions/create-account` endpoint.
	 * - Returns a serialized transaction (`txKind`) that you can sign and execute.
	 *
	 * @param inputs.walletAddress - The wallet address that will own the new account.
	 * @param inputs.collateralCoinType - Collateral coin type to be used with this account.
	 * @param inputs.tx - Optional {@link Transaction} to extend; if provided,
	 *   the create-account commands are appended to this transaction.
	 *
	 * @returns API transaction response containing `txKind`.
	 *
	 * @example
	 * ```ts
	 * const { txKind } = await perps.getCreateAccountTx({
	 *   walletAddress: "0x...",
	 *   collateralCoinType: "0x2::sui::SUI",
	 * });
	 * // sign + execute txKind with your wallet adapter
	 * ```
	 */
	public async getCreateAccountTx(inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		tx?: Transaction;
	}) {
		const { walletAddress, collateralCoinType, tx } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCreateAccountBody,
			ApiTransactionResponse
		>(
			"transactions/create-account",
			{
				walletAddress,
				collateralCoinType,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	/**
	 * Build a `create-vault-cap` transaction.
	 *
	 * This helper directly forwards the body through to the backend. If you wish
	 * to extend an existing {@link Transaction}, build the `txKind` yourself
	 * and pass it as part of {@link ApiPerpetualsCreateVaultCapBody}.
	 *
	 * @param inputs - Request body for the create-vault-cap endpoint.
	 * @returns API transaction response containing `txKind`.
	 *
	 * @example
	 * ```ts
	 * const { txKind } = await perps.getCreateVaultCapTx({
	 *   walletAddress: "0x...",
	 * });
	 * ```
	 */
	public async getCreateVaultCapTx(
		// TODO: add tx support ?
		inputs: ApiPerpetualsCreateVaultCapBody
	) {
		return this.fetchApiTxObject<
			ApiPerpetualsCreateVaultCapBody,
			ApiTransactionResponse
		>("vault/transactions/create-vault-cap", inputs, undefined, {
			txKind: true,
		});
	}

	/**
	 * Build a `create-vault` transaction.
	 *
	 * This helper:
	 * - Optionally converts a {@link Transaction} into a serialized `txKind`
	 *   via the shared `Provider` (if present).
	 * - Calls `/perpetuals/vault/transactions/create-vault`.
	 * - Returns a serialized transaction (`txKind`) that you can sign and execute.
	 *
	 * You can specify the initial deposit either as an explicit amount or as a
	 * `depositCoinArg` referring to an existing transaction argument.
	 *
	 * @param inputs.name - Human-readable vault name.
	 * @param inputs.walletAddress - Address of vault owner.
	 * @param inputs.lpCoinType - Coin type for the LP token.
	 * @param inputs.collateralCoinType - Collateral coin type for the vault.
	 * @param inputs.collateralOracleId - Oracle ID for collateral.
	 * @param inputs.lockPeriodMs - Lock-in period for deposits in milliseconds.
	 * @param inputs.ownerFeePercentage - Percentage of user profits taken as owner fee.
	 * @param inputs.forceWithdrawDelayMs - Delay before forced withdrawals are processed.
	 * @param inputs.isSponsoredTx - Whether this transaction is sponsored (fees paid by another party).
	 * @param inputs.initialDepositAmount - Initial deposit amount (mutually exclusive with `initialDepositCoinArg`).
	 * @param inputs.initialDepositCoinArg - Transaction object argument referencing the deposit coin.
	 * @param inputs.tx - Optional {@link Transaction} to extend.
	 *
	 * @returns API transaction response containing `txKind`.
	 *
	 * @example
	 * ```ts
	 * const { txKind } = await perps.getCreateVaultTx({
	 *   name: "My Vault",
	 *   walletAddress: "0x...",
	 *   lpCoinType: "0x...::lp::LP",
	 *   collateralCoinType: "0x2::sui::SUI",
	 *   collateralOracleId: "0xoracle",
	 *   lockPeriodMs: BigInt(7 * 24 * 60 * 60 * 1000),
	 *   ownerFeePercentage: 0.2,
	 *   forceWithdrawDelayMs: BigInt(24 * 60 * 60 * 1000),
	 *   initialDepositAmount: BigInt("1000000000"),
	 * });
	 * ```
	 */
	public async getCreateVaultTx(
		inputs: {
			name: string;
			walletAddress: SuiAddress;
			lpCoinType: CoinType;
			collateralCoinType: CoinType;
			collateralOracleId: ObjectId;
			// TODO: find out if needed
			// collateralPriceFeedId: ObjectId;
			// collateralPriceFeedTolerance: bigint;
			// NOTE: is this correct ?
			lockPeriodMs: bigint;
			ownerFeePercentage: Percentage;
			// NOTE: is this correct ?
			forceWithdrawDelayMs: bigint;
			tx?: Transaction;
			isSponsoredTx?: boolean;
		} & (
			| {
					initialDepositAmount: Balance;
			  }
			| {
					initialDepositCoinArg: TransactionObjectArgument;
			  }
		)
	) {
		const { tx, ...otherInputs } = inputs;
		return this.fetchApiTxObject<
			ApiPerpetualsCreateVaultBody,
			ApiTransactionResponse
		>(
			"vault/transactions/create-vault",
			{
				...otherInputs,
				txKind: await this.Provider?.Transactions().fetchBase64TxKindFromTx(
					{ tx }
				),
			},
			undefined,
			{
				txKind: true,
			}
		);
	}

	// =========================================================================
	//  Public Static Functions
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Determine the logical order side (Bid/Ask) from a signed base asset amount.
	 *
	 * @param inputs.baseAssetAmount - Position base size. Positive => Bid (long), negative => Ask (short).
	 * @returns Corresponding {@link PerpetualsOrderSide}.
	 *
	 * @example
	 * ```ts
	 * const side = Perpetuals.positionSide({ baseAssetAmount: -1 });
	 * // side === PerpetualsOrderSide.Ask
	 * ```
	 */
	public static positionSide(inputs: {
		baseAssetAmount: number;
	}): PerpetualsOrderSide {
		const baseAmount = inputs.baseAssetAmount;
		const isLong = Math.sign(baseAmount);
		const side =
			isLong >= 0 ? PerpetualsOrderSide.Bid : PerpetualsOrderSide.Ask;
		return side;
	}

	/**
	 * Compute the effective price from a {@link FilledTakerOrderEvent}.
	 *
	 * Uses `quoteAssetDelta / baseAssetDelta`.
	 *
	 * @param inputs.orderEvent - Filled taker order event.
	 * @returns Trade price as a `number`.
	 */
	public static orderPriceFromEvent(inputs: {
		orderEvent: FilledTakerOrderEvent;
	}): number {
		const { orderEvent } = inputs;
		return orderEvent.quoteAssetDelta / orderEvent.baseAssetDelta;
	}

	/**
	 * Extract the price (as floating-point) from an encoded order ID.
	 *
	 * Internally uses {@link PerpetualsOrderUtils.price} and converts the
	 * fixed-point `PerpetualsOrderPrice` into a `number`.
	 *
	 * @param inputs.orderId - Encoded order ID.
	 * @returns Floating-point price.
	 */
	public static orderPriceFromOrderId(inputs: {
		orderId: PerpetualsOrderId;
	}): number {
		const { orderId } = inputs;
		const orderPrice = PerpetualsOrderUtils.price(orderId);
		return this.orderPriceToPrice({ orderPrice });
	}

	/**
	 * Convert a floating-point price into a fixed-point {@link PerpetualsOrderPrice}
	 * using 9 decimal places of precision.
	 *
	 * @param inputs.price - Floating-point price.
	 * @returns Encoded {@link PerpetualsOrderPrice} as `bigint`.
	 */
	public static priceToOrderPrice = (inputs: {
		price: number;
	}): PerpetualsOrderPrice => {
		const { price } = inputs;
		return BigInt(Math.round(price * FixedUtils.fixedOneN9));
	};

	/**
	 * Convert a fixed-point {@link PerpetualsOrderPrice} to a human-friendly price.
	 *
	 * @param inputs.orderPrice - Encoded order price as `bigint`.
	 * @returns Floating-point price value.
	 */
	public static orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
	}): number => {
		const { orderPrice } = inputs;
		return Number(orderPrice) / FixedUtils.fixedOneN9;
	};

	/**
	 * Convert a fixed-point lot or tick size (9 decimals) to a `number`.
	 *
	 * @param lotOrTickSize - Fixed-point size as `bigint`.
	 * @returns Floating-point representation.
	 */
	public static lotOrTickSizeToNumber(lotOrTickSize: bigint): number {
		return Number(lotOrTickSize) / FixedUtils.fixedOneN9;
	}

	/**
	 * Convert a floating-point lot or tick size to its fixed-point representation (9 decimals).
	 *
	 * @param lotOrTickSize - Floating-point size.
	 * @returns Fixed-point representation as `bigint`.
	 */
	public static lotOrTickSizeToBigInt(lotOrTickSize: number): bigint {
		return BigInt(Math.round(lotOrTickSize * FixedUtils.fixedOneN9));
	}

	/**
	 * Infer the order side from an order ID.
	 *
	 * Uses {@link PerpetualsOrderUtils.isAsk} under the hood.
	 *
	 * @param orderId - Encoded order ID.
	 * @returns {@link PerpetualsOrderSide.Ask} if ask, otherwise {@link PerpetualsOrderSide.Bid}.
	 */
	public static orderIdToSide = (
		orderId: PerpetualsOrderId
	): PerpetualsOrderSide => {
		return Perpetuals.OrderUtils.isAsk(orderId)
			? PerpetualsOrderSide.Ask
			: PerpetualsOrderSide.Bid;
	};

	/**
	 * Construct a full event type string for a collateral-specific event.
	 *
	 * Many Move events are generic over a collateral coin type. This helper
	 * appends `<collateralCoinType>` to a base `eventType`.
	 *
	 * @param inputs.eventType - Base event type without type parameters.
	 * @param inputs.collateralCoinType - Collateral coin type, e.g. `"0x2::sui::SUI"`.
	 * @returns Fully-qualified event type string.
	 *
	 * @example
	 * ```ts
	 * const fullType = Perpetuals.eventTypeForCollateral({
	 *   eventType: "0x1::perps::DepositedCollateral",
	 *   collateralCoinType: "0x2::sui::SUI",
	 * });
	 * // "0x1::perps::DepositedCollateral<0x2::sui::SUI>"
	 * ```
	 */
	public static eventTypeForCollateral = (inputs: {
		eventType: string;
		collateralCoinType: CoinType;
	}): string => {
		return `${inputs.eventType}<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	// public static calcEntryPrice(inputs: {
	// 	baseAssetAmount: number;
	// 	quoteAssetNotionalAmount: number;
	// }): number {
	// 	const { baseAssetAmount, quoteAssetNotionalAmount } = inputs;

	// 	const denominator = baseAssetAmount;
	// 	if (!denominator) return 0;

	// 	return Math.abs(quoteAssetNotionalAmount / denominator);
	// }

	// =========================================================================
	//  Websocket
	// =========================================================================

	/**
	 * Open the main updates websocket: `/perpetuals/ws/updates`.
	 *
	 * This stream can deliver:
	 * - Market updates
	 * - User account + stop order updates
	 * - Oracle price updates
	 * - Orderbook deltas
	 * - Market trades
	 * - User trades
	 * - User collateral changes
	 *
	 * The returned controller object includes a set of convenient subscribe /
	 * unsubscribe helpers for each stream type.
	 *
	 * @param args.onMessage - Handler for incoming messages from the ws.
	 * @param args.onOpen - Optional hook called when the websocket is opened.
	 * @param args.onError - Optional hook called on websocket error.
	 * @param args.onClose - Optional hook called when the websocket closes.
	 *
	 * @returns An object containing:
	 * - `ws`: the underlying `WebSocket` instance
	 * - subscribe/unsubscribe helpers:
	 *   - `subscribeMarket` / `unsubscribeMarket`
	 *   - `subscribeUser` / `unsubscribeUser`
	 *   - `subscribeOracle` / `unsubscribeOracle`
	 *   - `subscribeOrderbook` / `unsubscribeOrderbook`
	 *   - `subscribeMarketTrades` / `unsubscribeMarketTrades`
	 *   - `subscribeUserTrades` / `unsubscribeUserTrades`
	 *   - `subscribeUserCollateralChanges` / `unsubscribeUserCollateralChanges`
	 * - `close`: function to close the websocket
	 *
	 * @example
	 * ```ts
	 * const stream = perps.openUpdatesWebsocketStream({
	 *   onMessage: (msg) => {
	 *     if ("market" in msg) {
	 *       console.log("Market update", msg.market);
	 *     }
	 *   },
	 * });
	 *
	 * stream.subscribeMarket({ marketId: "0x..." });
	 * stream.subscribeUser({ accountId: 123n, withStopOrders: undefined });
	 * ```
	 */
	public openUpdatesWebsocketStream(args: {
		onMessage: (env: PerpetualsWsUpdatesResponseMessage) => void;
		onOpen?: (ev: Event) => void;
		onError?: (ev: Event) => void;
		onClose?: (ev: CloseEvent) => void;
	}) {
		const { onMessage, onOpen, onError, onClose } = args;

		const ctl = this.openWsStream<
			PerpetualsWsUpdatesSubscriptionMessage,
			PerpetualsWsUpdatesResponseMessage
		>({
			path: "ws/updates",
			onMessage,
			onOpen,
			onError,
			onClose,
		});

		// ---- subscribe/unsubscribe helpers ----
		const subscribeMarket = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { market: { marketId } },
			});

		const unsubscribeMarket = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { market: { marketId } },
			});

		const subscribeUser = ({
			accountId,
			withStopOrders,
		}: {
			accountId: PerpetualsAccountId;
			withStopOrders:
				| {
						walletAddress: SuiAddress;
						bytes: string;
						signature: string;
				  }
				| undefined;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { user: { accountId, withStopOrders } },
			});

		const unsubscribeUser = ({
			accountId,
			withStopOrders,
		}: {
			accountId: PerpetualsAccountId;
			withStopOrders:
				| {
						walletAddress: SuiAddress;
						bytes: string;
						signature: string;
				  }
				| undefined;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { user: { accountId, withStopOrders } },
			});

		const subscribeOracle = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { oracle: { marketId } },
			});

		const unsubscribeOracle = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { oracle: { marketId } },
			});

		const subscribeOrderbook = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { orderbook: { marketId } },
			});

		const unsubscribeOrderbook = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { orderbook: { marketId } },
			});

		const subscribeMarketTrades = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { marketTrades: { marketId } },
			});

		const unsubscribeMarketTrades = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { marketTrades: { marketId } },
			});

		const subscribeUserTrades = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { userTrades: { accountId } },
			});

		const unsubscribeUserTrades = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { userTrades: { accountId } },
			});

		const subscribeUserCollateralChanges = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { userCollateralChanges: { accountId } },
			});

		const unsubscribeUserCollateralChanges = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { userCollateralChanges: { accountId } },
			});

		return {
			ws: ctl.ws,
			subscribeMarket,
			unsubscribeMarket,
			subscribeUser,
			unsubscribeUser,
			subscribeOracle,
			unsubscribeOracle,
			subscribeOrderbook,
			unsubscribeOrderbook,
			subscribeMarketTrades,
			unsubscribeMarketTrades,
			subscribeUserTrades,
			unsubscribeUserTrades,
			subscribeUserCollateralChanges,
			unsubscribeUserCollateralChanges,
			close: ctl.close,
		};
	}

	/**
	 * Open a market-candles websocket stream for a single market/interval:
	 * `/perpetuals/ws/market-candles/{market_id}/{interval_ms}`.
	 *
	 * The stream emits {@link PerpetualsWsCandleResponseMessage} messages,
	 * typically containing the latest candle for the specified interval.
	 *
	 * @param args.marketId - Market ID to subscribe to.
	 * @param args.intervalMs - Candle interval in milliseconds.
	 * @param args.onMessage - Handler for incoming candle updates.
	 * @param args.onOpen - Optional hook called when the websocket opens.
	 * @param args.onError - Optional hook called on websocket error.
	 * @param args.onClose - Optional hook called when the websocket closes.
	 *
	 * @returns An object containing:
	 * - `ws`: the underlying `WebSocket` instance
	 * - `close`: function to close the websocket
	 *
	 * @example
	 * ```ts
	 * const stream = perps.openMarketCandlesWebsocketStream({
	 *   marketId: "0x...",
	 *   intervalMs: 60_000,
	 *   onMessage: ({ lastCandle }) => {
	 *     console.log("New candle:", lastCandle);
	 *   },
	 * });
	 * ```
	 */
	public openMarketCandlesWebsocketStream(args: {
		marketId: PerpetualsMarketId;
		intervalMs: number;
		onMessage: (msg: PerpetualsWsCandleResponseMessage) => void;
		onOpen?: (ev: Event) => void;
		onError?: (ev: Event) => void;
		onClose?: (ev: CloseEvent) => void;
	}) {
		const { marketId, intervalMs, onMessage, onOpen, onError, onClose } =
			args;

		const path = `ws/market-candles/${encodeURIComponent(
			marketId
		)}/${intervalMs}`;

		// Generic handler already BigInt-parses any "123n" in payloads
		const ctl = this.openWsStream<
			undefined,
			PerpetualsWsCandleResponseMessage
		>({
			path,
			onMessage,
			onOpen,
			onError,
			onClose,
		});

		return {
			ws: ctl.ws,
			close: ctl.close,
		};
	}
}

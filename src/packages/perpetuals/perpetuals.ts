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
	ApiPerpetualsMarketCandleHistoryResponse,
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
	ApiPerpetualsVaultOwnedWithdrawRequestsBody,
	PerpetualsOrderPrice,
	ApiTransactionResponse,
	PerpetualsWsUpdatesSubscriptionMessage,
	PerpetualsWsUpdatesResponseMessage,
	PerpetualsWsCandleResponseMessage,
	ApiPerpetualsCreateVaultBody,
	ApiPerpetualsCreateVaultCapBody,
	PerpetualsVaultLpCoin,
	PerpetualsPartialVaultCap,
	PerpetualsVaultMetatada,
	ApiPerpetualsMarketCandleHistoryBody,
	ApiPerpetualsAccountCapsResponse,
	ApiPerpetualsOwnedAccountCapsResponse,
	ApiPerpetualsAccountPositionsResponse,
	ApiPerpetualsAccountPositionsBody,
	ApiPerpetualsAllMarketsResponse,
	ApiPerpetualsAllMarketsBody,
	ApiPerpetualsMarketsBody,
	ApiPerpetualsMarketsResponse,
	ApiPerpetualsMarketsPricesResponse,
	ApiPerpetualsMarketsPricesBody,
	ApiPerpetualsVaultLpCoinPricesResponse,
	ApiPerpetualsVaultLpCoinPricesBody,
	ApiPerpetualsVaultOwnedLpCoinsResponse,
	ApiPerpetualsVaultOwnedLpCoinsBody,
	ApiPerpetualsOwnedVaultCapsBody,
	ApiPerpetualsOwnedVaultCapsResponse,
	ApiPerpetualsVaultOwnedWithdrawRequestsResponse,
	ApiPerpetualsVaultsResponse,
	ApiPerpetualsVaultsBody,
	SdkTransactionResponse,
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
 * - Historical data & stats (`getMarketCandleHistory`, `getMarkets24hrStats`)
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
	 *   provided, transaction-building helpers can derive serialized `txKind`
	 *   from a {@link Transaction} object via `Provider.Transactions().fetchBase64TxKindFromTx`.
	 *
	 * @remarks
	 * This class extends {@link Caller} with the `"perpetuals"` route prefix, meaning:
	 * - HTTP calls resolve under `/perpetuals/...`
	 * - Websocket calls resolve under `/perpetuals/ws/...`
	 */
	constructor(
		config?: CallerConfig,
		public readonly Provider?: AftermathApi
	) {
		super(config, "perpetuals");
	}

	// =========================================================================
	//  Markets
	// =========================================================================

	/**
	 * Fetch all perpetual markets for a given collateral coin type.
	 *
	 * This method returns *wrapped* {@link PerpetualsMarket} instances, not the raw
	 * market structs. Each instance provides additional helpers for pricing, margin,
	 * and order parsing.
	 *
	 * @param inputs.collateralCoinType - Coin type used as collateral, e.g. `"0x2::sui::SUI"`.
	 * @returns Object containing `markets`.
	 *
	 * @example
	 * ```ts
	 * const { markets } = await perps.getAllMarkets({
	 *   collateralCoinType: "0x2::sui::SUI",
	 * });
	 * ```
	 */
	public async getAllMarkets(inputs: {
		collateralCoinType: CoinType;
	}): Promise<{
		markets: PerpetualsMarket[];
	}> {
		const res = await this.fetchApi<
			ApiPerpetualsAllMarketsResponse,
			ApiPerpetualsAllMarketsBody
		>("all-markets", inputs);
		return {
			markets: res.markets.map(
				(marketData) =>
					new PerpetualsMarket(marketData, this.config, this.Provider)
			),
		};
	}

	/**
	 * Fetch a single market by ID.
	 *
	 * Internally calls {@link getMarkets} and returns the first entry.
	 *
	 * @param inputs.marketId - The market (clearing house) object ID.
	 * @returns Object containing `market`.
	 *
	 * @throws If the backend returns an empty list for the given `marketId`,
	 * this will still attempt to return `markets[0]` (which would be `undefined`).
	 * Callers may want to validate the result.
	 *
	 * @example
	 * ```ts
	 * const { market } = await perps.getMarket({ marketId: "0x..." });
	 * ```
	 */
	public async getMarket(inputs: {
		marketId: PerpetualsMarketId;
		// withOrderbook: boolean;
	}): Promise<{ market: PerpetualsMarket }> {
		const { markets } = await this.getMarkets({
			marketIds: [inputs.marketId],
		});
		return {
			market: markets[0],
		};
	}

	/**
	 * Fetch multiple markets by ID.
	 *
	 * Backend note:
	 * - The API supports returning orderbooks. This SDK currently forces
	 *   `withOrderbook: false` and constructs {@link PerpetualsMarket} from
	 *   the returned `marketDatas[].market`.
	 *
	 * @param inputs.marketIds - Array of market object IDs to fetch.
	 * @returns Object containing `markets` in the same order as `marketIds`.
	 *
	 * @example
	 * ```ts
	 * const { markets } = await perps.getMarkets({
	 *   marketIds: ["0x..A", "0x..B"],
	 * });
	 * ```
	 */
	public async getMarkets(inputs: {
		marketIds: PerpetualsMarketId[];
		// withOrderbook: boolean;
	}): Promise<{
		markets: PerpetualsMarket[];
	}> {
		const res = await this.fetchApi<
			ApiPerpetualsMarketsResponse,
			ApiPerpetualsMarketsBody
		>("markets", {
			...inputs,
			withOrderbook: false,
		});
		return {
			markets: res.marketDatas.map(
				(marketData) =>
					new PerpetualsMarket(
						marketData.market,
						this.config,
						this.Provider
					)
			),
		};
	}

	// =========================================================================
	//  Vaults
	// =========================================================================

	/**
	 * Fetch all vaults on the current network.
	 *
	 * Vaults are managed accounts that can hold positions; LPs deposit collateral
	 * and receive an LP coin (see pricing helpers like {@link getLpCoinPrices}).
	 *
	 * @returns Object containing `vaults`.
	 *
	 * @example
	 * ```ts
	 * const { vaults } = await perps.getAllVaults();
	 * ```
	 */
	public async getAllVaults(): Promise<{
		vaults: PerpetualsVault[];
	}> {
		const res = await this.fetchApi<
			ApiPerpetualsVaultsResponse,
			ApiPerpetualsVaultsBody
		>("vaults", {});
		return {
			vaults: res.vaults.map(
				(vaultObject) =>
					new PerpetualsVault(vaultObject, this.config, this.Provider)
			),
		};
	}

	/**
	 * Fetch a single vault by ID.
	 *
	 * Internally calls {@link getVaults} and returns the first entry.
	 *
	 * Naming note:
	 * - This method’s parameter is named `marketId` for historical reasons,
	 *   but it refers to a vault object ID.
	 *
	 * @param inputs.marketId - Vault object ID.
	 * @returns Object containing `vault`.
	 */
	public async getVault(inputs: { marketId: ObjectId }): Promise<{
		vault: PerpetualsVault;
	}> {
		const { vaults } = await this.getVaults({
			vaultIds: [inputs.marketId],
		});
		return {
			vault: vaults[0],
		};
	}

	/**
	 * Fetch multiple vaults by ID.
	 *
	 * @param inputs.vaultIds - Array of vault object IDs.
	 * @returns Object containing `vaults` in the same order as `vaultIds`.
	 */
	public async getVaults(inputs: { vaultIds: ObjectId[] }): Promise<{
		vaults: PerpetualsVault[];
	}> {
		const res = await this.fetchApi<
			ApiPerpetualsVaultsResponse,
			ApiPerpetualsVaultsBody
		>("vaults", inputs);
		return {
			vaults: res.vaults.map(
				(vaultObject) =>
					new PerpetualsVault(vaultObject, this.config, this.Provider)
			),
		};
	}

	// =========================================================================
	//  Accounts
	// =========================================================================

	/**
	 * Convenience helper to fetch a single account (positions + account object) from an account cap.
	 *
	 * Internally calls {@link getAccounts} and returns the first entry.
	 *
	 * @param inputs.accountCap - Account-cap or vault-cap-extended object to derive account metadata from.
	 * @param inputs.marketIds - Optional list of markets to filter positions by.
	 * @returns Object containing `account`.
	 *
	 * @example
	 * ```ts
	 * const [accountCap] = await perps.getOwnedAccountCaps({ walletAddress: "0x..." });
	 * const { account } = await perps.getAccount({ accountCap });
	 * ```
	 */
	// TODO: merge this with `getAccountObjects` as an option ?
	public async getAccount(inputs: {
		accountCap: PerpetualsAccountCap | PerpetualsPartialVaultCap;
		marketIds?: PerpetualsMarketId[];
	}): Promise<{
		account: PerpetualsAccount;
	}> {
		const { accountCap, marketIds } = inputs;
		return {
			account: (
				await this.getAccounts({
					accountCaps: [accountCap],
					marketIds,
				})
			).accounts[0],
		};
	}

	/**
	 * Fetch one or more accounts (positions + account objects) from account caps.
	 *
	 * This composes:
	 * 1) {@link getAccountObjects} to fetch {@link PerpetualsAccountObject}s by account ID
	 * 2) Local pairing of returned account objects with `accountCaps`
	 *
	 * The returned {@link PerpetualsAccount} instances encapsulate:
	 * - The account snapshot (positions, balances, etc.)
	 * - The ownership/cap metadata (accountId, collateral type, vaultId, etc.)
	 *
	 * @param inputs.accountCaps - Array of account caps or vault-cap-extended objects.
	 * @param inputs.marketIds - Optional list of market IDs to filter positions by.
	 * @returns Object containing `accounts` in the same order as `accountCaps`.
	 *
	 * @remarks
	 * If `accountCaps` is empty, this returns `{ accounts: [] }` without making an API call.
	 */
	public async getAccounts(inputs: {
		accountCaps: (PerpetualsAccountCap | PerpetualsPartialVaultCap)[];
		marketIds?: PerpetualsMarketId[];
	}): Promise<{
		accounts: PerpetualsAccount[];
	}> {
		const { accountCaps, marketIds } = inputs;
		if (accountCaps.length <= 0)
			return {
				accounts: [],
			};

		const accountObjects = (
			await this.getAccountObjects({
				accountIds: accountCaps.map(
					(accountCap) => accountCap.accountId
				),
				marketIds,
			})
		).accounts;

		return {
			accounts: accountObjects.map(
				(account, index) =>
					new PerpetualsAccount(
						account,
						accountCaps[index],
						this.config,
						this.Provider
					)
			),
		};
	}

	/**
	 * Fetch raw account objects (including positions) for one or more account IDs.
	 *
	 * This is the lower-level primitive used by {@link getAccounts}.
	 *
	 * @param inputs.accountIds - List of account IDs to query.
	 * @param inputs.marketIds - Optional list of market IDs to filter positions by.
	 *
	 * @returns {@link ApiPerpetualsAccountPositionsResponse} containing `accounts`.
	 *
	 * @remarks
	 * If `accountIds` is empty, this returns `{ accounts: [] }` without making an API call.
	 */
	public async getAccountObjects(
		inputs: ApiPerpetualsAccountPositionsBody
	): Promise<ApiPerpetualsAccountPositionsResponse> {
		const { accountIds, marketIds } = inputs;
		if (accountIds.length <= 0)
			return {
				accounts: [],
			};

		return this.fetchApi<
			ApiPerpetualsAccountPositionsResponse,
			ApiPerpetualsAccountPositionsBody
		>("accounts/positions", {
			accountIds,
			marketIds,
		});
	}

	// =========================================================================
	//  Ownership Queries
	// =========================================================================

	/**
	 * Fetch all account caps (perpetuals accounts) owned by a wallet, optionally
	 * filtered by collateral coin types.
	 *
	 * Returned values are “caps” (ownership objects), not full account snapshots.
	 * To fetch account positions, use {@link getAccount} or {@link getAccounts}.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @param inputs.collateralCoinTypes - Optional list of collateral coin types to filter by.
	 * @returns {@link ApiPerpetualsOwnedAccountCapsResponse} containing `accounts`.
	 *
	 * @example
	 * ```ts
	 * const { accounts } = await perps.getOwnedAccountCaps({
	 *   walletAddress: "0x...",
	 *   collateralCoinTypes: ["0x2::sui::SUI"],
	 * });
	 * ```
	 */
	public async getOwnedAccountCaps(
		inputs: ApiPerpetualsOwnedAccountCapsBody
	) {
		const { walletAddress, collateralCoinTypes } = inputs;
		return this.fetchApi<
			ApiPerpetualsOwnedAccountCapsResponse,
			ApiPerpetualsOwnedAccountCapsBody
		>("accounts/owned", {
			walletAddress,
			collateralCoinTypes,
		});
	}

	/**
	 * Fetch all vault caps owned by a wallet.
	 *
	 * Vault caps represent ownership/administrative authority over a vault.
	 *
	 * @param inputs.walletAddress - Owner wallet address.
	 * @returns {@link ApiPerpetualsOwnedVaultCapsResponse} containing vault caps.
	 */
	public async getOwnedVaultCaps(inputs: ApiPerpetualsOwnedVaultCapsBody) {
		return this.fetchApi<
			ApiPerpetualsOwnedVaultCapsResponse,
			ApiPerpetualsOwnedVaultCapsBody
		>("vaults/owned-vault-caps", inputs);
	}

	/**
	 * Fetch all pending vault withdrawal requests created by a given wallet.
	 *
	 * Withdraw requests are typically created when LPs request to exit a vault
	 * and may be subject to lock periods / delays depending on vault configuration.
	 *
	 * @param inputs.walletAddress - Wallet address that created the withdraw requests.
	 * @returns {@link ApiPerpetualsVaultOwnedWithdrawRequestsResponse} containing requests.
	 */
	public async getOwnedVaultWithdrawRequests(
		inputs: ApiPerpetualsVaultOwnedWithdrawRequestsBody
	) {
		return this.fetchApi<
			ApiPerpetualsVaultOwnedWithdrawRequestsResponse,
			ApiPerpetualsVaultOwnedWithdrawRequestsBody
		>("vaults/owned-withdraw-requests", {
			...inputs,
			// vaultIds: undefined,
		});
	}

	/**
	 * Fetch all Perpetuals vault LP coins owned by a wallet.
	 *
	 * This returns coin objects (or summaries) representing LP token holdings.
	 * Use {@link getLpCoinPrices} to value them in collateral units.
	 *
	 * @param inputs - {@link ApiPerpetualsVaultOwnedLpCoinsBody}.
	 * @returns {@link ApiPerpetualsVaultOwnedLpCoinsResponse}.
	 */
	public async getOwnedVaultLpCoins(
		inputs: ApiPerpetualsVaultOwnedLpCoinsBody
	): Promise<ApiPerpetualsVaultOwnedLpCoinsResponse> {
		return this.fetchApi<
			ApiPerpetualsVaultOwnedLpCoinsResponse,
			ApiPerpetualsVaultOwnedLpCoinsBody
		>("vaults/owned-lp-coins", inputs);
	}

	/**
	 * Fetch account caps by their cap object IDs.
	 *
	 * @param inputs.accountCapIds - List of account cap object IDs.
	 * @returns {@link ApiPerpetualsAccountCapsResponse} containing caps.
	 */
	public async getAccountCaps(inputs: ApiPerpetualsAccountCapsBody) {
		return this.fetchApi<
			ApiPerpetualsAccountCapsResponse,
			ApiPerpetualsAccountCapsBody
		>("accounts", inputs);
	}

	// =========================================================================
	//  Historical Data & Stats
	// =========================================================================

	/**
	 * Fetch historical OHLCV candle data for a single market.
	 *
	 * @param inputs.marketId - Market ID to query.
	 * @param inputs.fromTimestamp - Start timestamp (inclusive).
	 * @param inputs.toTimestamp - End timestamp (exclusive).
	 * @param inputs.intervalMs - Candle interval in milliseconds.
	 *
	 * @returns {@link ApiPerpetualsMarketCandleHistoryResponse} containing candle points.
	 *
	 * @remarks
	 * This is currently implemented on the Perpetuals root client, but it may be
	 * relocated to {@link PerpetualsMarket} in the future.
	 */
	// TODO: move to market class ?
	public getMarketCandleHistory(
		inputs: ApiPerpetualsMarketCandleHistoryBody
	) {
		const { marketId, fromTimestamp, toTimestamp, intervalMs } = inputs;
		return this.fetchApi<
			ApiPerpetualsMarketCandleHistoryResponse,
			ApiPerpetualsMarketCandleHistoryBody
		>("market/candle-history", {
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
	 * @returns {@link ApiPerpetualsMarkets24hrStatsResponse}.
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
	 * @returns {@link ApiPerpetualsMarketsPricesResponse} containing `marketsPrices`.
	 *
	 * @remarks
	 * If `marketIds` is empty, returns `{ marketsPrices: [] }` without making an API call.
	 */
	public async getPrices(inputs: {
		marketIds: ObjectId[];
	}): Promise<ApiPerpetualsMarketsPricesResponse> {
		if (inputs.marketIds.length <= 0)
			return {
				marketsPrices: [],
			};
		return this.fetchApi<
			ApiPerpetualsMarketsPricesResponse,
			ApiPerpetualsMarketsPricesBody
		>("markets/prices", inputs);
	}

	/**
	 * Fetch LP coin prices (in collateral units) for a set of vaults.
	 *
	 * @param inputs.vaultIds - List of vault IDs to query.
	 * @returns {@link ApiPerpetualsVaultLpCoinPricesResponse} containing `lpCoinPrices`.
	 *
	 * @remarks
	 * If `vaultIds` is empty, returns `{ lpCoinPrices: [] }` without making an API call.
	 */
	public async getLpCoinPrices(
		inputs: ApiPerpetualsVaultLpCoinPricesBody
	): Promise<ApiPerpetualsVaultLpCoinPricesResponse> {
		if (inputs.vaultIds.length <= 0)
			return {
				lpCoinPrices: [],
			};
		return this.fetchApi<
			ApiPerpetualsVaultLpCoinPricesResponse,
			ApiPerpetualsVaultLpCoinPricesBody
		>("vaults/lp-coin-prices", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Build a `create-account` transaction for Aftermath Perpetuals.
	 *
	 * @param inputs.walletAddress - Wallet address that will own the new account.
	 * @param inputs.collateralCoinType - Collateral coin type used by the account.
	 * @param inputs.tx - Optional {@link Transaction} to extend; if provided, the
	 *   create-account commands are appended to this transaction.
	 *
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getCreateAccountTx(inputs: {
		walletAddress: SuiAddress;
		collateralCoinType: CoinType;
		tx?: Transaction;
	}): Promise<SdkTransactionResponse> {
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
	 * A vault cap is an ownership/admin object for interacting with vault management
	 * flows. This method returns a transaction kind that mints/creates that cap.
	 *
	 * @param inputs - {@link ApiPerpetualsCreateVaultCapBody}.
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getCreateVaultCapTx(inputs: ApiPerpetualsCreateVaultCapBody) {
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
	 * This creates a new vault plus its on-chain metadata and initial LP supply
	 * seeded by the initial deposit.
	 *
	 * Deposit input:
	 * - Use `initialDepositAmount` to have the API select/merge coins as needed, OR
	 * - Use `initialDepositCoinArg` if you already have a coin argument in a larger tx.
	 *
	 * Metadata:
	 * - Stored on-chain (or in a referenced object) as part of vault creation.
	 * - `extraFields` allows forward-compatible additions (e.g. social links).
	 *
	 * @param inputs.walletAddress - Address of vault owner/curator.
	 * @param inputs.metadata - Vault display metadata (name, description, curator info).
	 * @param inputs.metadata - Vault display metadata (name, description, curator info).
	 * @param inputs.coinMetadataId - Coin metadata object id obtained from create vault cap tx
	 * @param inputs.treasuryCapId - Treasury cap object id obtained from create vault cap tx
	 * @param inputs.collateralCoinType - Collateral coin type for deposits.
	 * @param inputs.lockPeriodMs - Lock-in period for deposits in milliseconds.
	 * @param inputs.performanceFeePercentage - Fraction of profits taken as curator fee.
	 * @param inputs.forceWithdrawDelayMs - Delay before forced withdrawals can be processed.
	 * @param inputs.isSponsoredTx - Whether this tx is sponsored (gas paid by another party).
	 * @param inputs.initialDepositAmount - Initial deposit amount (mutually exclusive with `initialDepositCoinArg`).
	 * @param inputs.initialDepositCoinArg - Transaction object argument referencing the deposit coin.
	 * @param inputs.tx - Optional {@link Transaction} to extend.
	 *
	 * @returns {@link SdkTransactionResponse} with `tx`.
	 */
	public async getCreateVaultTx(
		inputs: {
			walletAddress: SuiAddress;
			metadata: {
				/** A human-readable name for the `Vault`. */
				name: string;
				/** A verbose description of the `Vault`. */
				description: string;
				/** The `Vault` curator's name. */
				curatorName?: string;
				/** A url for the `Vault`'s curator. Ideally their website. */
				curatorUrl?: string;
				/** An image url for the `Vault`'s curator. Ideally their logo. */
				curatorLogoUrl?: string;
				/**
				 * Extra / optional fields for future extensibility.
				 * Recommended keys include: `twitter_url`.
				 */
				extraFields?: Record<string, string>;
			};
			coinMetadataId: ObjectId;
			treasuryCapId: ObjectId;
			collateralCoinType: CoinType;
			lockPeriodMs: bigint;
			performanceFeePercentage: Percentage;
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
	//  Public Static Helpers
	// =========================================================================

	/**
	 * Determine the logical order side (Bid/Ask) from a signed base asset amount.
	 *
	 * @param inputs.baseAssetAmount - Position base size. Positive/zero => Bid (long), negative => Ask (short).
	 * @returns {@link PerpetualsOrderSide}.
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
	 * Compute the effective trade price from a {@link FilledTakerOrderEvent}.
	 *
	 * Uses the ratio: `quoteAssetDelta / baseAssetDelta`.
	 *
	 * @param inputs.orderEvent - Filled taker order event.
	 * @returns Trade price.
	 */
	public static orderPriceFromEvent(inputs: {
		orderEvent: FilledTakerOrderEvent;
	}): number {
		const { orderEvent } = inputs;
		return orderEvent.quoteAssetDelta / orderEvent.baseAssetDelta;
	}

	/**
	 * Extract the floating-point price from an encoded order ID.
	 *
	 * Internally uses {@link PerpetualsOrderUtils.price} and converts the fixed-point
	 * {@link PerpetualsOrderPrice} into a `number`.
	 *
	 * @param inputs.orderId - Encoded order ID.
	 * @returns Price as a `number`.
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
	 * @param inputs.price - Price as a float.
	 * @returns Fixed-point order price.
	 */
	public static priceToOrderPrice = (inputs: {
		price: number;
	}): PerpetualsOrderPrice => {
		const { price } = inputs;
		return BigInt(Math.round(price * FixedUtils.fixedOneN9));
	};

	/**
	 * Convert a fixed-point {@link PerpetualsOrderPrice} to a float price.
	 *
	 * @param inputs.orderPrice - Fixed-point order price.
	 * @returns Price as a float.
	 */
	public static orderPriceToPrice = (inputs: {
		orderPrice: PerpetualsOrderPrice;
	}): number => {
		const { orderPrice } = inputs;
		return Number(orderPrice) / FixedUtils.fixedOneN9;
	};

	/**
	 * Convert a fixed-point lot/tick size (9 decimals) to a `number`.
	 *
	 * @param lotOrTickSize - Fixed-point size as `bigint`.
	 * @returns Floating-point size.
	 */
	public static lotOrTickSizeToNumber(lotOrTickSize: bigint): number {
		return Number(lotOrTickSize) / FixedUtils.fixedOneN9;
	}

	/**
	 * Convert a floating-point lot/tick size to its fixed-point representation (9 decimals).
	 *
	 * @param lotOrTickSize - Floating-point size.
	 * @returns Fixed-point size as `bigint`.
	 */
	public static lotOrTickSizeToBigInt(lotOrTickSize: number): bigint {
		return BigInt(Math.round(lotOrTickSize * FixedUtils.fixedOneN9));
	}

	/**
	 * Infer the order side from an encoded order ID.
	 *
	 * @param orderId - Encoded order ID.
	 * @returns {@link PerpetualsOrderSide}.
	 */
	public static orderIdToSide = (
		orderId: PerpetualsOrderId
	): PerpetualsOrderSide => {
		return Perpetuals.OrderUtils.isAsk(orderId)
			? PerpetualsOrderSide.Ask
			: PerpetualsOrderSide.Bid;
	};

	/**
	 * Construct a collateral-specialized Move event type string.
	 *
	 * Many Move events are generic over a collateral coin type. This helper appends
	 * `<collateralCoinType>` to a base `eventType`.
	 *
	 * @param inputs.eventType - Base event type without type parameters.
	 * @param inputs.collateralCoinType - Collateral coin type (e.g. `"0x2::sui::SUI"`).
	 * @returns Fully-qualified event type string.
	 */
	public static eventTypeForCollateral = (inputs: {
		eventType: string;
		collateralCoinType: CoinType;
	}): string => {
		return `${inputs.eventType}<${inputs.collateralCoinType}>`;
	};

	// =========================================================================
	//  Websocket
	// =========================================================================

	/**
	 * Open the main updates websocket: `/perpetuals/ws/updates`.
	 *
	 * The stream emits {@link PerpetualsWsUpdatesResponseMessage} envelopes and supports
	 * multiple subscription types. This method returns a small controller with
	 * convenience subscribe/unsubscribe functions.
	 *
	 * Subscription types supported by the controller:
	 * - `market`: market state updates
	 * - `user`: user account updates (optionally including stop orders)
	 * - `oracle`: oracle price updates
	 * - `orderbook`: orderbook deltas
	 * - `marketOrders`: public market trades/orders
	 * - `userOrders`: user trade/order events
	 * - `userCollateralChanges`: user collateral change events
	 *
	 * @param args.onMessage - Handler for parsed messages from the websocket.
	 * @param args.onOpen - Optional handler for the `open` event.
	 * @param args.onError - Optional handler for the `error` event.
	 * @param args.onClose - Optional handler for the `close` event.
	 *
	 * @returns A controller object containing:
	 * - `ws`: underlying {@link WebSocket}
	 * - subscribe/unsubscribe helpers for each subscription type
	 * - `close()`: closes the websocket
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

		/**
		 * Subscription helpers
		 *
		 * Each helper sends a structured subscription message of the form:
		 * `{ action: "subscribe" | "unsubscribe", subscriptionType: { ... } }`
		 */
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

		const subscribeMarketOrders = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { marketOrders: { marketId } },
			});

		const unsubscribeMarketOrders = ({
			marketId,
		}: {
			marketId: PerpetualsMarketId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { marketOrders: { marketId } },
			});

		const subscribeUserOrders = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "subscribe",
				subscriptionType: { userOrders: { accountId } },
			});

		const unsubscribeUserOrders = ({
			accountId,
		}: {
			accountId: PerpetualsAccountId;
		}) =>
			ctl.send({
				action: "unsubscribe",
				subscriptionType: { userOrders: { accountId } },
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
			subscribeMarketOrders,
			unsubscribeMarketOrders,
			subscribeUserOrders,
			unsubscribeUserOrders,
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
	 * @returns A controller containing the raw websocket and a `close()` helper.
	 *
	 * @example
	 * ```ts
	 * const stream = perps.openMarketCandlesWebsocketStream({
	 *   marketId: "0x...",
	 *   intervalMs: 60_000,
	 *   onMessage: ({ lastCandle }) => console.log(lastCandle),
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

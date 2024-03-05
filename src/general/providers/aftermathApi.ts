import { ConfigAddresses } from "../types/configTypes";
import { PoolsApi } from "../../packages/pools/api/poolsApi";
import { FaucetApi } from "../../packages/faucet/api/faucetApi";
import { CoinApi } from "../../packages/coin/api/coinApi";
import { DynamicFieldsApiHelpers } from "../apiHelpers/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../apiHelpers/eventsApiHelpers";
import { InspectionsApiHelpers } from "../apiHelpers/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../apiHelpers/objectsApiHelpers";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers";
import { SuiApi } from "../../packages/sui/api/suiApi";
import { WalletApi } from "../wallet/walletApi";
import { RouterApi } from "../../packages/router/api/routerApi";
import { PlaceholderPricesApi } from "../prices/placeholder/placeholderPricesApi";
import { SuiFrensApi } from "../../packages/suiFrens/api/suiFrensApi";
import { StakingApi } from "../../packages/staking/api/stakingApi";
import { NftAmmApi } from "../../packages/nftAmm/api/nftAmmApi";
import { ReferralVaultApi } from "../../packages/referralVault/api/referralVaultApi";
import {
	CoinType,
	PartialRouterOptions,
	RouterProtocolName,
	RouterSynchronousOptions,
	ScallopProviders,
	UniqueId,
	Url,
} from "../../types";
import { HistoricalDataApi } from "../historicalData/historicalDataApi";
import { CoinGeckoPricesApi } from "../prices/coingecko/coinGeckoPricesApi";
import { PlaceholderHistoricalDataApi } from "../historicalData/placeholderHistoricalDataApi";
import { PerpetualsApi } from "../../packages/perpetuals/api/perpetualsApi";
import { OracleApi } from "../../packages/oracle/api/oracleApi";
import { CoinGeckoCoinApiId } from "../prices/coingecko/coinGeckoTypes";
// import { PriceFeedsApi } from "../priceFeeds/priceFeedsApi";
import { FarmsApi } from "../../packages/farms/api/farmsApi";
import { IndexerCaller } from "../utils";
import { SuiClient } from "@mysten/sui.js/client";
import { DynamicGasApi } from "../dynamicGas/dynamicGasApi";
import { LeveragedStakingApi } from "../../packages/leveragedStaking/api/leveragedStakingApi";
import { NftsApi } from "../nfts/nftsApi";

/**
 * This class represents the Aftermath API and provides helper methods for various functionalities.
 * @class
 */
export class AftermathApi {
	private cache: Record<
		UniqueId,
		{
			data: unknown;
			expirationMs: number;
			lastUsed: number;
		}
	>;

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static helpers = {
		// =========================================================================
		//  General
		// =========================================================================

		dynamicFields: DynamicFieldsApiHelpers,
		events: EventsApiHelpers,
		inspections: InspectionsApiHelpers,
		objects: ObjectsApiHelpers,
		transactions: TransactionsApiHelpers,

		// =========================================================================
		//  Utils
		// =========================================================================

		wallet: WalletApi,

		// =========================================================================
		//  General Packages
		// =========================================================================

		coin: CoinApi,
		sui: SuiApi,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an instance of AftermathApi.
	 * @param provider - The SuiClient instance to use for interacting with the blockchain.
	 * @param addresses - The configuration addresses for the Aftermath protocol.
	 * @param indexerCaller - The IndexerCaller instance to use for querying the blockchain.
	 * @param coinGeckoApiKey - (Optional) The API key to use for querying CoinGecko for token prices.
	 */
	public constructor(
		public readonly provider: SuiClient,
		public readonly addresses: ConfigAddresses,
		public readonly indexerCaller: IndexerCaller,
		private readonly config?: {
			prices?: {
				coinGeckoApiKey?: string;
				coinApiIdsToCoinTypes?: Record<CoinGeckoCoinApiId, CoinType[]>;
			};
		}
	) {
		this.cache = {};
	}

	// =========================================================================
	//  Class Object Creation
	// =========================================================================

	// =========================================================================
	//  General
	// =========================================================================

	public DynamicFields = () => new DynamicFieldsApiHelpers(this);
	public Events = () => new EventsApiHelpers(this);
	public Inspections = () => new InspectionsApiHelpers(this);
	public Objects = () => new ObjectsApiHelpers(this);
	public Transactions = () => new TransactionsApiHelpers(this);

	// =========================================================================
	//  Utils
	// =========================================================================

	public Wallet = () => new WalletApi(this);
	public DynamicGas = () => new DynamicGasApi(this);
	public Nfts = () => new NftsApi(this);

	public Prices = this?.config?.prices?.coinGeckoApiKey
		? () =>
				new CoinGeckoPricesApi(
					this,
					this?.config?.prices?.coinGeckoApiKey ?? "",
					this?.config?.prices?.coinApiIdsToCoinTypes ?? {}
				)
		: () => new PlaceholderPricesApi();

	public HistoricalData = this?.config?.prices?.coinGeckoApiKey
		? () =>
				new HistoricalDataApi(
					this,
					this?.config?.prices?.coinGeckoApiKey ?? "",
					this?.config?.prices?.coinApiIdsToCoinTypes ?? {}
				)
		: () => new PlaceholderHistoricalDataApi();

	// public PriceFeeds = new PriceFeedsApi(this.pythPriceServiceEndpoint);

	// =========================================================================
	//  General Packages
	// =========================================================================

	public Coin = () => new CoinApi(this);
	public Sui = () => new SuiApi(this);

	// =========================================================================
	//  Aftermath Packages
	// =========================================================================

	public Pools = () => new PoolsApi(this);
	public Faucet = () => new FaucetApi(this);
	public SuiFrens = () => new SuiFrensApi(this);
	public Staking = () => new StakingApi(this);
	public NftAmm = () => new NftAmmApi(this);
	public ReferralVault = () => new ReferralVaultApi(this);
	public Perpetuals = () => new PerpetualsApi(this);
	public Oracle = () => new OracleApi(this);
	public Farms = () => new FarmsApi(this);

	/**
	 * Creates a new instance of the RouterApi class.
	 * @param protocols An optional array of protocol names to use for the router.
	 * @param regularOptions An optional object containing regular router options.
	 * @param preAsyncOptions An optional object containing pre-async router options.
	 * @returns A new instance of the RouterApi class.
	 */
	public Router = (
		protocols?: RouterProtocolName[],
		regularOptions?: PartialRouterOptions,
		preAsyncOptions?: Partial<RouterSynchronousOptions>
	) => new RouterApi(this, protocols, regularOptions, preAsyncOptions);

	public LeveragedStaking = (ScallopProviders?: ScallopProviders) =>
		new LeveragedStakingApi(this, ScallopProviders);

	// =========================================================================
	//  Cache
	// =========================================================================

	public withCache = <Input, Output>(inputs: {
		key: string;
		expirationSeconds: number; // < 0 means never expires
		callback: (...inputs: Input[]) => Promise<Output>;
	}): ((...inputs: Input[]) => Promise<Output>) => {
		const { key, expirationSeconds, callback } = inputs;

		const fetchFunc = async (...inputs: Input[]): Promise<Output> => {
			// this allows BigInt to be JSON serialized (as string)
			(BigInt.prototype as any).toJSON = function () {
				return this.toString() + "n";
			};

			const cachedData = this.getCache<Input, Output>({ key, inputs });
			if (cachedData !== "NO_CACHED_DATA") {
				return cachedData;
			}

			const newData = await callback(...inputs);

			this.setCache({
				key,
				expirationSeconds,
				inputs,
				data: newData,
			});
			return newData;
		};

		return fetchFunc;
	};

	public setCache = <Input, Output>(inputs: {
		key: string;
		expirationSeconds: number; // < 0 means never expires
		data: Output;
		inputs: Input[];
	}) => {
		const cacheKey = this.getCacheKey(inputs);

		this.cache[cacheKey] = {
			data: inputs.data,
			lastUsed: Date.now(),
			expirationMs: inputs.expirationSeconds * 1000, // convert to ms
		};
	};

	public getCache = <Input, Output>(inputs: {
		key: string;
		inputs: Input[];
	}): Output | "NO_CACHED_DATA" => {
		const cacheKey = this.getCacheKey(inputs);

		if (
			cacheKey in this.cache &&
			(this.cache[cacheKey].lastUsed +
				this.cache[cacheKey].expirationMs >=
				Date.now() ||
				this.cache[cacheKey].expirationMs < 0)
		) {
			return this.cache[cacheKey].data as Output;
		}
		return "NO_CACHED_DATA";
	};

	private getCacheKey = <Input, Output>(inputs: {
		key: string;
		inputs: Input[];
	}) => {
		// this allows BigInt to be JSON serialized (as string)
		(BigInt.prototype as any).toJSON = function () {
			return this.toString() + "n";
		};
		return `${inputs.key}_${JSON.stringify(inputs.inputs)}`; // TODO: hash me
	};
}

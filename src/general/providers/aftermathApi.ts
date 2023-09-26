import { ConfigAddresses } from "../types/configTypes";
import { PoolsApi } from "../../packages/pools/api/poolsApi";
import { FaucetApi } from "../../packages/faucet/api/faucetApi";
import { CoinApi } from "../../packages/coin/api/coinApi";
import { DynamicFieldsApiHelpers } from "../api/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../api/eventsApiHelpers";
import { InspectionsApiHelpers } from "../api/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../api/objectsApiHelpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";
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
} from "../../types";
import { HistoricalDataApi } from "../historicalData/historicalDataApi";
import { CoinGeckoPricesApi } from "../prices/coingecko/coinGeckoPricesApi";
import { PlaceholderHistoricalDataApi } from "../historicalData/placeholderHistoricalDataApi";
import { PerpetualsApi } from "../../packages/perpetuals/api/perpetualsApi";
import { FarmsApi } from "../../packages/farms/api/farmsApi";
import { CoinGeckoCoinApiId } from "../prices/coingecko/coinGeckoTypes";
import { IndexerCaller } from "../utils";
import { SuiClient } from "@mysten/sui.js/client";
import { DynamicGasApi } from "../dynamicGas/dynamicGasApi";

export class AftermathApi {
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

	public constructor(
		public readonly provider: SuiClient,
		public readonly addresses: ConfigAddresses,
		public readonly indexerCaller: IndexerCaller,
		private readonly coinGeckoApiKey?: string
	) {}

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

	public Prices = this.coinGeckoApiKey
		? (coinApiIdsToCoinTypes: Record<CoinGeckoCoinApiId, CoinType[]>) =>
				new CoinGeckoPricesApi(
					this.coinGeckoApiKey ?? "",
					coinApiIdsToCoinTypes
				)
		: () => new PlaceholderPricesApi();

	public HistoricalData = this.coinGeckoApiKey
		? (coinApiIdsToCoinTypes: Record<CoinGeckoCoinApiId, CoinType[]>) =>
				new HistoricalDataApi(
					this.coinGeckoApiKey ?? "",
					coinApiIdsToCoinTypes
				)
		: () => new PlaceholderHistoricalDataApi();

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
	public Farms = () => new FarmsApi(this);

	public Router = (
		protocols?: RouterProtocolName[],
		regularOptions?: PartialRouterOptions,
		preAsyncOptions?: Partial<RouterSynchronousOptions>
	) => new RouterApi(this, protocols, regularOptions, preAsyncOptions);
}

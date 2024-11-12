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
import { SuiFrensApi } from "../../packages/suiFrens/api/suiFrensApi";
import { StakingApi } from "../../packages/staking/api/stakingApi";
import { NftAmmApi } from "../../packages/nftAmm/api/nftAmmApi";
import { ReferralVaultApi } from "../../packages/referralVault/api/referralVaultApi";
import {
	ModuleName,
	MoveErrorCode,
	ObjectId,
	// ScallopProviders,
	UniqueId,
} from "../../types";
import { PerpetualsApi } from "../../packages/perpetuals/api/perpetualsApi";
import { OracleApi } from "../../packages/oracle/api/oracleApi";
import { FarmsApi } from "../../packages/farms/api/farmsApi";
import { SuiClient } from "@mysten/sui/client";
import { SuiClient as SuiClientV0 } from "@mysten/sui.js/client";
import { DcaApi } from "../../packages/dca/api/dcaApi";
import { LeveragedStakingApi } from "../../packages/leveragedStaking/api/leveragedStakingApi";
import { NftsApi } from "../nfts/nftsApi";
import { Helpers } from "../utils";
import { MoveErrorsInterface } from "../types/moveErrorsInterface";

/**
 * This class represents the Aftermath API and provides helper methods for various functionalities.
 * @class
 */
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
		public readonly providerV0?: SuiClientV0
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
	public Nfts = () => new NftsApi(this);

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
	public Dca = () => new DcaApi(this);
	// public Multisig = () => new MultisigApi(this);

	/**
	 * Creates a new instance of the RouterApi class.
	 * @returns A new instance of the RouterApi class.
	 */
	public Router = () => new RouterApi(this);

	public LeveragedStaking = (
		ScallopProviders?: any // ScallopProviders
	) => new LeveragedStakingApi(this, ScallopProviders);

	// =========================================================================
	//  Helpers
	// =========================================================================

	public translateMoveErrorMessage = <T extends MoveErrorsInterface>(inputs: {
		errorMessage: string;
	}):
		| {
				errorCode: MoveErrorCode;
				packageId: ObjectId;
				module: ModuleName;
				error: string;
		  }
		| undefined => {
		const { errorMessage } = inputs;

		// TODO: make this work more cleanly
		const packageApis: (() => T)[] = [
			// @ts-ignore
			this.Pools,
			// @ts-ignore
			this.Staking,
			// @ts-ignore
			this.Perpetuals,
			// @ts-ignore
			this.Farms,
			// @ts-ignore
			this.Router,
		];
		for (const packageApi of packageApis) {
			try {
				const moveErrors = packageApi().moveErrors;
				const translation = Helpers.translateMoveErrorMessage({
					errorMessage,
					moveErrors,
				});
				if (!translation) continue;

				return translation;
			} catch (e) {}
		}

		return undefined;
	};
}

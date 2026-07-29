import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { CoinApi } from "../../packages/coin/api/coinApi";
import { DcaApi } from "../../packages/dca/api/dcaApi";
import { FarmsApi } from "../../packages/farms/api/farmsApi";
import { FaucetApi } from "../../packages/faucet/api/faucetApi";
import { LimitOrdersApi } from "../../packages/limitOrders/api/limitOrdersApi";
import { MultisigApi } from "../../packages/multisig/api/multisigApi";
import { NftAmmApi } from "../../packages/nftAmm/api/nftAmmApi";
import { PerpetualsApi } from "../../packages/perpetuals/api/perpetualsApi";
import { PoolsApi } from "../../packages/pools/api/poolsApi";
import { ReferralVaultApi } from "../../packages/referralVault/api/referralVaultApi";
import { RouterApi } from "../../packages/router/api/routerApi";
import { StakingApi } from "../../packages/staking/api/stakingApi";
import { SuiApi } from "../../packages/sui/api/suiApi";
import { SuiFrensApi } from "../../packages/suiFrens/api/suiFrensApi";
import { DynamicFieldsApiHelpers } from "../apiHelpers/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../apiHelpers/eventsApiHelpers";
import { InspectionsApiHelpers } from "../apiHelpers/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../apiHelpers/objectsApiHelpers";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers";
import { NftsApi } from "../nfts/nftsApi";
import type { ConfigAddresses } from "../types/configTypes";
import type {
	MoveErrorsInterface,
	TranslatedMoveError,
} from "../types/moveErrorsInterface";
import { Helpers } from "../utils";
import { WalletApi } from "../wallet/walletApi";

/**
 * The `AftermathApi` class is a low-level factory and reference point for
 * interacting directly with underlying API modules (e.g., PoolsApi, StakingApi).
 * It encapsulates a configured `SuiClient` and the known `addresses` for the
 * Aftermath protocol, allowing flexible or advanced usage scenarios.
 *
 * @example
 * ```typescript
 * import { AftermathApi } from "aftermath-ts-sdk";
 * import { SuiGrpcClient } from "@mysten/sui/grpc";
 * import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
 *
 * const addresses = { ... }; // from aftermath.getAddresses()
 * const fullnodeUrl = "https://fullnode.mainnet.sui.io";
 *
 * const client = new SuiGrpcClient({
 *   network: "mainnet",
 *   baseUrl: fullnodeUrl,
 * });
 * // still required by the handful of helpers with no gRPC equivalent
 * const jsonRpcClient = new SuiJsonRpcClient({
 *   url: fullnodeUrl,
 *   network: "mainnet",
 * });
 *
 * const afApi = new AftermathApi(client, addresses, jsonRpcClient);
 * // access protocol APIs
 * const poolsApi = afApi.Pools();
 * ```
 */
export class AftermathApi {
	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Static helper references for quick usage without instantiating the class.
	 */
	public static helpers = {
		// =========================================================================
		//  General
		// =========================================================================

		/** Helpers for accessing or iterating over dynamic fields in Sui objects. */
		dynamicFields: DynamicFieldsApiHelpers,
		/** Helpers for working with Sui events and pagination. */
		events: EventsApiHelpers,
		/** Helpers for reading on-chain data in an "inspection" manner (designed for Summaries). */
		inspections: InspectionsApiHelpers,
		/** Helpers for retrieving and parsing Sui objects by ID or type. */
		objects: ObjectsApiHelpers,
		/** Helpers for reading transaction data (by digest, query, etc.). */
		transactions: TransactionsApiHelpers,

		// =========================================================================
		//  Utils
		// =========================================================================

		/** Helper for wallet-based operations, separate from the main `Wallet` classes. */
		wallet: WalletApi,

		// =========================================================================
		//  General Packages
		// =========================================================================

		/** Low-level direct coin operations, separate from the higher-level `Coin` class. */
		coin: CoinApi,
		/** Low-level Sui chain data ops, separate from the higher-level `Sui` class. */
		sui: SuiApi,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Constructs a new instance of the `AftermathApi`, binding the given Sui client
	 * to the known `addresses`.
	 *
	 * @param client - A `SuiGrpcClient` for on-chain queries and transactions.
	 * @param addresses - The config addresses (object IDs, package IDs, etc.) for the Aftermath protocol.
	 * @param jsonRpcClient - A `SuiJsonRpcClient` pointed at the same fullnode. Only
	 * used by the helpers listed on {@link AftermathApi.jsonRpcClient}; every other
	 * call goes over gRPC via `client`.
	 */
	public constructor(
		public readonly client: SuiGrpcClient,
		public readonly addresses: ConfigAddresses,
		/**
		 * The **remaining JSON-RPC surface** of this SDK. Sui JSON-RPC is deprecated
		 * and scheduled for removal from fullnodes in mid-October 2026, but these
		 * helpers cannot be expressed with `SuiGrpcClient` without changing what
		 * they return to their callers:
		 *
		 * - `Events().fetchCastEventsWithCursor` — `suix_queryEvents` has no
		 *   `SuiGrpcClient` equivalent (only the raw `ledgerService`, with a
		 *   different filter model).
		 * - `Transactions().fetchTransactionsWithCursor` — `suix_queryTransactionBlocks`
		 *   has no gRPC equivalent at all (GraphQL or an indexer is required).
		 * - `Sui().fetchSystemState` — gRPC has no `SuiSystemStateSummary`
		 *   equivalent (`core.getCurrentSystemState()` carries no validators, and
		 *   `ledgerService.getEpoch`'s validator shape omits several summary
		 *   fields). Already `@deprecated` with no internal callers.
		 *
		 * **This list is now exhaustive**, and `grep -rn "jsonRpcClient\." src/`
		 * returns exactly these three call sites. Neither of the first two is
		 * reachable from the Aftermath frontend.
		 *
		 * The object readers that used to be on this list — `Objects().fetchObject`
		 * / `fetchObjectGeneral` / `fetchObjectBatch` / `fetchOwnedObjects` and
		 * `DynamicFields().fetchDynamicFieldObject` — are **on gRPC as of plan
		 * 251**. gRPC's `json` view does differ in shape from JSON-RPC's
		 * `content.fields` (UIDs flattened, nested structs unwrapped,
		 * `vector<u8>` base64-encoded), but that is decidable per read site from
		 * the `*FieldsOnChain` interface already declared there, so no Move type
		 * layouts are needed — see `GrpcCasting`'s field-shape primitives.
		 */
		public readonly jsonRpcClient: SuiJsonRpcClient
	) {}

	// =========================================================================
	//  Class Object Creation
	// =========================================================================

	// =========================================================================
	//  General
	// =========================================================================

	/**
	 * Creates a new `DynamicFieldsApiHelpers` instance for complex object field queries.
	 */
	public DynamicFields = () => new DynamicFieldsApiHelpers(this);

	/**
	 * Creates a new `EventsApiHelpers` instance for querying Sui events.
	 */
	public Events = () => new EventsApiHelpers(this);

	/**
	 * Creates a new `InspectionsApiHelpers` instance for reading Summaries or inspection data.
	 */
	public Inspections = () => new InspectionsApiHelpers(this);

	/**
	 * Creates a new `ObjectsApiHelpers` instance for object retrieval/manipulation.
	 */
	public Objects = () => new ObjectsApiHelpers(this);

	/**
	 * Creates a new `TransactionsApiHelpers` instance for querying or parsing transaction data.
	 */
	public Transactions = () => new TransactionsApiHelpers(this);

	// =========================================================================
	//  Utils
	// =========================================================================

	/**
	 * Creates a new `WalletApi` instance for direct wallet-based operations (fetching balances, etc.).
	 */
	public Wallet = () => new WalletApi(this);

	/**
	 * Creates a new `NftsApi` instance for retrieving and interacting with NFT data.
	 */
	public Nfts = () => new NftsApi(this);

	// =========================================================================
	//  General Packages
	// =========================================================================

	/**
	 * Creates a new `CoinApi` instance for detailed coin operations.
	 */
	public Coin = () => new CoinApi(this);

	/**
	 * Creates a new `SuiApi` instance for lower-level Sui chain interactions.
	 */
	public Sui = () => new SuiApi(this);

	// =========================================================================
	//  Aftermath Packages
	// =========================================================================

	/**
	 * Creates a new `PoolsApi` instance for pool-related interactions (AMM pools, liquidity, etc.).
	 */
	public Pools = () => new PoolsApi(this);

	/**
	 * Creates a new `FaucetApi` instance for dispensing tokens on supported dev/test networks.
	 */
	public Faucet = () => new FaucetApi(this);

	/**
	 * Creates a new `SuiFrensApi` instance for special social or token gating utilities on Sui.
	 */
	public SuiFrens = () => new SuiFrensApi(this);

	/**
	 * Creates a new `StakingApi` instance for advanced or direct staking operations on Sui.
	 */
	public Staking = () => new StakingApi(this);

	/**
	 * Creates a new `NftAmmApi` instance for NFT AMM logic (buy, sell, liquidity).
	 */
	public NftAmm = () => new NftAmmApi(this);

	/**
	 * Creates a new `ReferralVaultApi` instance for referral-based logic in Aftermath.
	 */
	public ReferralVault = () => new ReferralVaultApi(this);

	/**
	 * Creates a new `PerpetualsApi` instance for futures or perpetual derivatives on Sui.
	 */
	public Perpetuals = () => new PerpetualsApi(this);

	/**
	 * Creates a new `FarmsApi` instance for yield farming or liquidity mining interactions.
	 */
	public Farms = () => new FarmsApi(this);

	/**
	 * Creates a new `DcaApi` instance for dollar-cost averaging logic.
	 */
	public Dca = () => new DcaApi(this);

	/**
	 * Creates a new `MultisigApi` instance for multi-signature address creation and management.
	 */
	public Multisig = () => new MultisigApi(this);

	/**
	 * Creates a new `LimitOrdersApi` instance for placing limit orders on supported DEX protocols.
	 */
	public LimitOrders = () => new LimitOrdersApi(this);

	/**
	 * Creates a new `RouterApi` instance for best-price trade routing across multiple DEX liquidity sources.
	 */
	public Router = () => new RouterApi(this);

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Attempts to decode a Move error message into a structured error code,
	 * package ID, module name, and descriptive error string.
	 *
	 * @param inputs - An object containing the raw `errorMessage`.
	 * @returns An object with `errorCode`, `packageId`, `module`, and `error` if translation is successful, or `undefined`.
	 *
	 * @example
	 * ```typescript
	 * const errorDecoded = afApi.translateMoveErrorMessage({ errorMessage: "MoveAbort at ..." });
	 * if (errorDecoded) {
	 *   console.log(errorDecoded.errorCode, errorDecoded.error);
	 * }
	 * ```
	 */
	public translateMoveErrorMessage(inputs: {
		errorMessage: string;
	}): TranslatedMoveError | undefined {
		// @dev: packages that publish move error tables; order is significant: first match wins.
		const sources: MoveErrorsInterface[] = [
			this.Pools(),
			this.Staking(),
			this.Perpetuals(),
			this.Farms(),
			this.Router(),
		];

		for (const source of sources) {
			const translation = Helpers.translateMoveErrorMessage({
				errorMessage: inputs.errorMessage,
				moveErrors: source.moveErrors,
			});
			if (translation) {
				return translation;
			}
		}

		return undefined;
	}
}

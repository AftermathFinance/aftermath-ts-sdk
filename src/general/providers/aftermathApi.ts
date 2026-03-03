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
import type { ModuleName, MoveErrorCode, ObjectId } from "../../types";
import { DynamicFieldsApiHelpers } from "../apiHelpers/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../apiHelpers/eventsApiHelpers";
import { InspectionsApiHelpers } from "../apiHelpers/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../apiHelpers/objectsApiHelpers";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers";

import { NftsApi } from "../nfts/nftsApi";
import type { ConfigAddresses } from "../types/configTypes";
import type { MoveErrorsInterface } from "../types/moveErrorsInterface";
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
 * import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
 *
 * const addresses = { ... }; // from aftermath.getAddresses()
 * const client = new SuiJsonRpcClient({
 *   url: "https://fullnode.mainnet.sui.io",
 *   network: "mainnet",
 * });
 *
 * const afApi = new AftermathApi(client, addresses);
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
   * @param provider - A `SuiJsonRpcClient` for on-chain queries and transactions.
   * @param addresses - The config addresses (object IDs, package IDs, etc.) for the Aftermath protocol.
   */
  public constructor(
    public readonly provider: SuiJsonRpcClient,
    public readonly addresses: ConfigAddresses
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

    // Candidate packageApis that define `moveErrors` we can search against
    const packageApis: (() => T)[] = [
      // @ts-expect-error
      this.Pools,
      // @ts-expect-error
      this.Staking,
      // @ts-expect-error
      this.Perpetuals,
      // @ts-expect-error
      this.Farms,
      // @ts-expect-error
      this.Router,
    ];
    for (const packageApi of packageApis) {
      try {
        const moveErrors = packageApi().moveErrors;
        const translation = Helpers.translateMoveErrorMessage({
          errorMessage,
          moveErrors,
        });
        if (!translation) {
          continue;
        }

        return translation;
      } catch (e) {
        // If any package lacks `moveErrors`, we skip it
      }
    }

    return undefined;
  };
}

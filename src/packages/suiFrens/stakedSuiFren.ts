import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	Balance,
	CallerConfig,
	ObjectId,
	StakedSuiFrenInfo,
	SuiAddress,
	SuiFrenAccessoryType,
} from "../../types";
import { SuiFren } from "./suiFren";

/**
 * Wraps a staked SuiFren with vault fee accessors and unsigned stake-position
 * transaction builders.
 *
 * The wrapper's `isOwned` flag comes from the fetch path and is used to guard
 * harvest and accessory-removal methods. It is not a live ownership check.
 */
export class StakedSuiFren extends Caller {
	// =========================================================================
	//  Class Members
	// =========================================================================

	/** SuiFren wrapper created from `info.suiFren` with `isStaked: true`. */
	public readonly suiFren: SuiFren;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a staked-SuiFren wrapper without making a request.
	 *
	 * @param info - SuiFren data, vault metadata, and optional owned position.
	 * @param config - Optional network, API host, endpoint, or access-token configuration.
	 * @param isOwned - Whether the caller's source data marks the position as owned.
	 * @param api - Optional `AftermathApi` required by transaction builders.
	 */
	constructor(
		/** Staked SuiFren data and vault metadata. */
		public readonly info: StakedSuiFrenInfo,
		/** Optional caller configuration used by HTTP reads. */
		config?: CallerConfig,
		/** Caller-provided ownership flag for the position. */
		public readonly isOwned: boolean = false,
		/** Optional low-level provider used by transaction builders. */
		public readonly api?: AftermathApi
	) {
		super(config, "sui-frens");
		this.suiFren = new SuiFren(info.suiFren, this.config, true, isOwned);
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Returns the current per-mix fee stored in the staked metadata.
	 *
	 * @returns The fee in the payment coin's smallest unit.
	 */
	public mixFee(): Balance {
		return this.info.metadata.mixFee;
	}

	/**
	 * Returns the object ID of the underlying SuiFren.
	 *
	 * @returns The underlying SuiFren object ID.
	 */
	public suiFrenId(): ObjectId {
		return this.suiFren.suiFren.objectId;
	}

	/**
	 * Creates another wrapper around the same stake information.
	 *
	 * Unlike `SuiFren.clone`, this method passes the optional `api` to the clone.
	 *
	 * @returns A new wrapper sharing the same `info` object.
	 */
	public clone(): StakedSuiFren {
		return new StakedSuiFren(this.info, this.config, this.isOwned, this.api);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches accessories attached to the underlying SuiFren.
	 *
	 * @returns The accessory objects attached to the SuiFren.
	 * @throws `AftermathTransportError` when the configured HTTP request fails.
	 */
	public async getAccessories() {
		return this.suiFren.getAccessories();
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds an unsigned transaction that unstakes this position.
	 *
	 * The method requires `info.position` to contain the owned position object ID,
	 * derives the underlying SuiFren type, and sets `walletAddress` as sender. It
	 * does not enforce `isOwned` before building.
	 *
	 * @param inputs - Wallet address that signs and receives the unstake result.
	 * @returns An unsigned transaction ready for signing and execution.
	 * @throws `Error` when no position is present or no `AftermathApi` is available.
	 */
	public async getUnstakeTransaction(inputs: { walletAddress: SuiAddress }) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}

		return this.suiFrensApi().fetchUnstakeTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	/**
	 * Builds an unsigned transaction that harvests fees from this position.
	 *
	 * The method requires both a position and an `isOwned` flag. The returned
	 * transaction transfers harvested fees to `walletAddress`.
	 *
	 * @param inputs - Wallet address that signs the transaction and receives fees.
	 * @returns An unsigned harvest transaction.
	 * @throws `Error` when no position is present, the wrapper is not marked owned, or no `AftermathApi` is available.
	 */
	public async getHarvestFeesTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}
		if (!this.isOwned) {
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);
		}

		return this.suiFrensApi().fetchBuildHarvestFeesTx({
			...inputs,
			stakedPositionIds: [this.info.position.objectId],
		});
	}

	/**
	 * Builds an unsigned transaction that adds an accessory to the underlying SuiFren.
	 *
	 * This method delegates to the underlying `SuiFren` wrapper.
	 *
	 * @param inputs - Accessory object ID and transaction sender address.
	 * @returns An unsigned accessory transaction.
	 * @throws `Error` when the delegated wrapper has no `AftermathApi` instance.
	 */
	public async getAddAccessoryTransaction(inputs: {
		accessoryId: ObjectId;
		walletAddress: SuiAddress;
	}) {
		return this.suiFren.getAddAccessoryTransaction(inputs);
	}

	/**
	 * Builds an unsigned transaction that removes an accessory from this position.
	 *
	 * The method requires a position and an `isOwned` flag, then selects the
	 * staked-position removal Move call.
	 *
	 * @param inputs - Accessory type string and transaction sender address.
	 * @returns An unsigned accessory-removal transaction.
	 * @throws `Error` when no position is present, the wrapper is not marked owned, or no `AftermathApi` is available.
	 */
	public async getRemoveAccessoryTransaction(inputs: {
		accessoryType: SuiFrenAccessoryType;
		walletAddress: SuiAddress;
	}) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}
		if (!this.isOwned) {
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);
		}

		return this.suiFrensApi().fetchBuildRemoveAccessoryTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private suiFrensApi = () => {
		const suiFrens = this.api?.SuiFrens();
		if (!suiFrens) {
			throw new Error("missing AftermathApi instance");
		}
		return suiFrens;
	};
}

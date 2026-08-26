import {
	ApiStakeSuiFrenBody,
	SuiNetwork,
	SuiFrenObject,
	Url,
	Nft,
	Balance,
	SuiFrenAccessoryType,
	ApiAddSuiFrenAccessoryBody,
	ApiRemoveSuiFrenAccessoryBody,
	SuiFrenAccessoryObject,
	ApiAccessoriesForSuiFrenBody,
	AnyObjectType,
	ObjectId,
	SuiAddress,
	CallerConfig,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { format } from "date-fns";
import { Coin } from "..";
import { AftermathApi } from "../../general/providers";

/**
 * Wraps one SuiFren object with display helpers, accessory reads, and unsigned
 * staking or accessory transaction builders.
 *
 * `isStaked` and `isOwned` are caller-provided state flags from the fetch path.
 * They are not live ownership checks. Transaction methods return unsigned
 * transactions that the wallet identified by `walletAddress` must sign.
 */
export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a SuiFren wrapper without making a request.
	 *
	 * @param suiFren - Complete SuiFren object data.
	 * @param config - Optional network, API host, endpoint, or access-token configuration.
	 * @param isStaked - Whether the caller's source data marks this SuiFren as staked.
	 * @param isOwned - Whether the caller's source data marks this SuiFren as owned by the wallet.
	 * @param api - Optional `AftermathApi` required by transaction builders.
	 */
	constructor(
		/** Complete object data exposed by the wrapper. */
		public readonly suiFren: SuiFrenObject,
		/** Optional caller configuration used by HTTP reads. */
		config?: CallerConfig,
		/** Caller-provided staked-state flag. */
		public readonly isStaked: boolean = false,
		/** Caller-provided ownership flag. */
		public readonly isOwned: boolean = false,
		/** Optional low-level provider used by transaction builders. */
		public readonly api?: AftermathApi
	) {
		super(config, "sui-frens");
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	/**
	 * Returns the inner Move type argument for this SuiFren.
	 *
	 * This is a local operation. It extracts the generic type used by the
	 * SuiFrens Move calls from `suiFren.objectType`.
	 *
	 * @returns The inner SuiFren type argument.
	 */
	public suiFrenType(): AnyObjectType {
		return Coin.getInnerCoinType(this.suiFren.objectType);
	}

	/**
	 * Builds display-oriented property labels from the SuiFren object.
	 *
	 * This local operation formats `birthdate` as `MMMM d, yyyy` and converts
	 * bigint values to strings. The returned map intentionally omits the raw
	 * `genes` array.
	 *
	 * @returns Labels and string values suitable for display.
	 */
	public properties(): Record<string, string> {
		return {
			Skin: this.suiFren.attributes.skin,
			Ears: this.suiFren.attributes.ears,
			Expression: this.suiFren.attributes.expression,
			"Main Color": this.suiFren.attributes.main,
			"Secondary Color": this.suiFren.attributes.secondary,
			"Birth Location": this.suiFren.birthLocation,
			Birthday: format(this.suiFren.birthdate, "MMMM d, yyyy"),
			Cohort: this.suiFren.cohort.toString(),
			Generation: this.suiFren.generation.toString(),
			// Genes: this.suiFren.genes.toString(),
		};
	}

	/**
	 * Builds display labels for optional dynamic fields.
	 *
	 * The result includes a mix count and last-mixed epoch only when the source
	 * values are truthy. As a result, a stored `0n` value is omitted by the
	 * current implementation.
	 *
	 * @returns Present dynamic values converted to strings.
	 */
	public dynamicFields(): Record<string, string> {
		return {
			...(this.suiFren.mixLimit
				? {
						"Mixes Remaining": this.suiFren.mixLimit.toString(),
					}
				: {}),
			...(this.suiFren.lastEpochMixed
				? {
						"Last Epoch Mixed": this.suiFren.lastEpochMixed.toString(),
					}
				: {}),
		};
	}

	/**
	 * Returns the display-number slice derived from the object ID.
	 *
	 * The method returns `suiFren.objectId.slice(-5, -1)` in uppercase. It does
	 * not parse or validate the ID, so the result depends on the supplied string's
	 * length and format.
	 *
	 * @returns The uppercased display-number slice.
	 */
	public displayNumber(): string {
		return this.suiFren.objectId.slice(-5, -1).toUpperCase();
	}

	/**
	 * Creates another wrapper around the same object and caller configuration.
	 *
	 * The current implementation preserves `isStaked` and `isOwned` but does not
	 * pass this wrapper's optional `api` to the clone. Transaction methods on the
	 * clone therefore require an API instance supplied by a different path.
	 *
	 * @returns A new wrapper sharing the same object reference.
	 */
	public clone(): SuiFren {
		return new SuiFren(this.suiFren, this.config, this.isStaked, this.isOwned);
	}

	// public asNft(): Nft {
	// 	return {
	// 		info: {
	// 			objectId: this.suiFren.objectId,
	// 			objectType: this.suiFren.objectType,
	// 		},
	// 		display: {
	// 			suggested: {
	// 				name: "SuiFren",
	// 				...this.suiFren.display,
	// 			},
	// 			other: {
	// 				Skin: this.suiFren.attributes.skin,
	// 				Ears: this.suiFren.attributes.ears,
	// 				Expression: this.suiFren.attributes.expression,
	// 				"Main Color": this.suiFren.attributes.main,
	// 				"Secondary Color": this.suiFren.attributes.secondary,
	// 				"Birth Location": this.suiFren.birthLocation,
	// 				Birthday: dayjs(this.suiFren.birthdate).format(
	// 					"MMMM D, YYYY"
	// 				),
	// 				Cohort: this.suiFren.cohort.toString(),
	// 				Generation: this.suiFren.generation.toString(),
	// 				...(this.suiFren.mixLimit
	// 					? {
	// 							"Mixes Remaining":
	// 								this.suiFren.mixLimit.toString(),
	// 					  }
	// 					: {}),
	// 				...(this.suiFren.lastEpochMixed
	// 					? {
	// 							"Last Epoch Mixed":
	// 								this.suiFren.lastEpochMixed.toString(),
	// 					  }
	// 					: {}),
	// 				// Genes: this.suiFren.genes.toString(),
	// 			},
	// 		},
	// 	};
	// }

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches accessories attached to this SuiFren.
	 *
	 * The method performs an HTTP request through the configured caller host and
	 * sends this object's ID as the request body. It does not require the low-level
	 * `AftermathApi` field.
	 *
	 * @returns The accessory objects attached to this SuiFren.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getAccessories() {
		return this.fetchApi<
			SuiFrenAccessoryObject[],
			ApiAccessoriesForSuiFrenBody
		>("accessories", {
			suiFrenId: this.suiFren.objectId,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds an unsigned transaction that stakes this SuiFren.
	 *
	 * The method derives `suiFrenType` and `suiFrenId` from this wrapper and sets
	 * the supplied wallet as transaction sender. It rejects a wrapper already
	 * marked `isStaked`; it does not verify ownership before building.
	 *
	 * @param inputs - Fee settings in smallest units, minimum mixes to keep, and the signing wallet.
	 * @returns An unsigned transaction ready for signing and execution.
	 * @throws `Error` when `isStaked` is true or no `AftermathApi` is available.
	 */
	public async getStakeTransaction(inputs: {
		baseFee: Balance;
		feeIncrementPerMix: Balance;
		minRemainingMixesToKeep: bigint;
		walletAddress: SuiAddress;
	}) {
		if (this.isStaked)
			throw new Error("unable to stake already staked suiFren");

		return this.suiFrensApi().fetchStakeTx({
			...inputs,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
		});
	}

	/**
	 * Builds an unsigned transaction that adds an accessory to this SuiFren.
	 *
	 * The underlying builder selects the owned or staked Move variant from this
	 * wrapper's `isOwned` flag. The caller must supply an accessory object ID and a
	 * wallet that can use the SuiFren and accessory objects.
	 *
	 * @param inputs - Accessory object ID and transaction sender address.
	 * @returns An unsigned transaction ready for signing and execution.
	 * @throws `Error` when no `AftermathApi` is available.
	 */
	public async getAddAccessoryTransaction(inputs: {
		accessoryId: ObjectId;
		walletAddress: SuiAddress;
	}) {
		return this.suiFrensApi().fetchBuildAddAccessoryTx({
			...inputs,
			isOwned: this.isOwned,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
		});
	}

	/**
	 * Builds an unsigned transaction that removes an accessory from this SuiFren.
	 *
	 * The method rejects wrappers not marked `isOwned` before it calls the low-level
	 * builder. The supplied accessory type is passed to the Move call unchanged.
	 *
	 * @param inputs - Accessory type string and transaction sender address.
	 * @returns An unsigned transaction ready for signing and execution.
	 * @throws `Error` when this wrapper is not marked owned or no `AftermathApi` is available.
	 */
	public async getRemoveAccessoryTransaction(inputs: {
		accessoryType: SuiFrenAccessoryType;
		walletAddress: SuiAddress;
	}) {
		if (!this.isOwned)
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);

		return this.suiFrensApi().fetchBuildRemoveAccessoryTx({
			...inputs,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
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

import {
	ApiMixSuiFrensBody,
	ApiDynamicFieldsBody,
	MixSuiFrensEvent,
	SuiFrenObject,
	SuiFrenStats,
	DynamicFieldObjectsWithCursor,
	EventsInputs,
	StakeSuiFrenEvent,
	SuiNetwork,
	UnstakeSuiFrenEvent,
	Url,
	SuiFrenAttributes,
	CapyLabsAppObject,
	StakedSuiFrenInfo,
	DynamicFieldsInputs,
	Balance,
	SuiFrensSortOption,
	SuiFrenAccessoryObject,
	ApiOwnedSuiFrenAccessoriesBody,
	ApiOwnedSuiFrensBody,
	ApiOwnedStakedSuiFrensBody,
	ApiHarvestSuiFrenFeesBody,
	HarvestSuiFrenFeesEvent,
	ObjectId,
	CallerConfig,
} from "../../types";
import { SuiFren } from "./suiFren";
import { StakedSuiFren } from "./stakedSuiFren";
import { Caller } from "../../general/utils/caller";
import { Coin } from "../coin";
import { Helpers } from "../../general/utils";
import { AftermathApi } from "../../general/providers";

/**
 * Provides high-level SuiFrens reads, event queries, fee calculations, and
 * unsigned transaction builders.
 *
 * Read and event methods use the configured Aftermath API host. Transaction
 * methods require the optional `AftermathApi` provider and return unsigned
 * `Transaction` objects for the caller's wallet to sign and execute.
 */
export class SuiFrens extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Fixed SuiFrens coin, protocol-fee, and mint-fee values. Balances are in MIST. */
	public static readonly constants = {
		/** Coin type used to pay SuiFrens mixing fees. */
		mixingFeeCoinType: Coin.constants.suiCoinType,
		/** Protocol fees and the staked-parent fee percentage. */
		protocolFees: {
			/** Mint protocol fee: `0.25` SUI, or `250_000_000` MIST. */
			mint: BigInt(250_000_000), // 0.25 SUI
			/** Mix fee when both parents are owned: `0.25` SUI, or `250_000_000` MIST. */
			mixOwned: BigInt(250_000_000), // 0.25 SUI
			/** Minimum extra fee per staked parent: `0.25` SUI, or `250_000_000` MIST. */
			minMixStaked: BigInt(250_000_000), // 0.25 SUI
			/** Fraction of a staked parent's `mixFee` added to the internal fee. */
			mixStakedPercentage: 0.1, // 10%
		},
		/** SuiFren-specific fee values. */
		suifrenFees: {
			/** SuiFren mint fee: `8` SUI, or `8_000_000_000` MIST. */
			mint: BigInt(8_000_000_000), // 8 SUI
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a SuiFrens facade without making a request.
	 *
	 * @param config - Optional network, API host, endpoint, or access-token configuration.
	 * @param api - Optional `AftermathApi` required by transaction builders.
	 */
	constructor(
		config?: CallerConfig,
		public readonly api?: AftermathApi
	) {
		super(config, "sui-frens");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the internal mix fee for two parent SuiFrens.
	 *
	 * An `undefined` parent fee represents an owned, non-staked parent. When both
	 * fees are undefined, the method returns the fixed `mixOwned` fee. For each
	 * defined staked fee, it adds the greater of `minMixStaked` and 10% of that
	 * fee. The result excludes `baseFee` from `ApiMixSuiFrensBody`.
	 *
	 * @param inputs - Optional staked-parent fees in the payment coin's smallest unit.
	 * @returns The internal fee in MIST as a `bigint`.
	 */
	public static calcTotalInternalMixFee(inputs: {
		mixFee1: Balance | undefined;
		mixFee2: Balance | undefined;
	}): Balance {
		const { mixFee1, mixFee2 } = inputs;

		if (mixFee1 === undefined && mixFee2 === undefined)
			return this.constants.protocolFees.mixOwned;

		if (mixFee1 !== undefined && mixFee2 !== undefined) {
			return (
				this.calcMixFeeForStakedSuiFren({ mixFee: mixFee1 }) +
				this.calcMixFeeForStakedSuiFren({ mixFee: mixFee2 })
			);
		}

		return mixFee1 !== undefined
			? this.calcMixFeeForStakedSuiFren({ mixFee: mixFee1 })
			: mixFee2 !== undefined
				? this.calcMixFeeForStakedSuiFren({ mixFee: mixFee2 })
				: (() => {
						// to make TS happy :)
						throw new Error("unreachable");
					})();
	}

	private static calcMixFeeForStakedSuiFren(inputs: {
		mixFee: Balance;
	}): Balance {
		const { mixFee } = inputs;

		return (
			mixFee +
			Helpers.maxBigInt(
				this.constants.protocolFees.minMixStaked,
				mixFee /
					BigInt(
						Math.floor(this.constants.protocolFees.mixStakedPercentage * 100)
					)
			)
		);
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	/**
	 * Fetches one SuiFren by object ID.
	 *
	 * @param inputs - The SuiFren object ID.
	 * @returns The first matching `SuiFren` wrapper, or `undefined` when the API returns no object.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getSuiFren(inputs: { suiFrenObjectId: ObjectId }) {
		const suiFrens = await this.getSuiFrens({
			suiFrenObjectIds: [inputs.suiFrenObjectId],
		});
		return suiFrens[0];
	}

	/**
	 * Fetches SuiFrens by object IDs and wraps the results as non-owned objects.
	 *
	 * @param inputs - On-chain SuiFren object IDs.
	 * @returns The returned SuiFren wrappers in API response order.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getSuiFrens(inputs: { suiFrenObjectIds: ObjectId[] }) {
		const suiFrens = await this.fetchApi<SuiFrenObject[]>(
			`${JSON.stringify(inputs.suiFrenObjectIds)}`
		);
		return suiFrens.map((suiFren) => new SuiFren(suiFren, this.config));
	}

	/**
	 * Fetches SuiFrens owned by a wallet.
	 *
	 * @param inputs - The wallet address whose owned objects are listed.
	 * @returns Owned wrappers with `isOwned: true`.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getOwnedSuiFrens(inputs: ApiOwnedSuiFrensBody) {
		const ownedSuiFrens = await this.fetchApi<
			SuiFrenObject[],
			ApiOwnedSuiFrensBody
		>(`owned-sui-frens`, inputs);

		return ownedSuiFrens.map(
			(suiFren) => new SuiFren(suiFren, this.config, false, true)
		);
	}

	/**
	 * Fetches staked SuiFrens owned by a wallet.
	 *
	 * @param inputs - The wallet address whose owned positions are listed.
	 * @returns Staked wrappers with `isOwned: true`.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getOwnedStakedSuiFrens(inputs: ApiOwnedStakedSuiFrensBody) {
		const stakesInfo = await this.fetchApi<
			StakedSuiFrenInfo[],
			ApiOwnedStakedSuiFrensBody
		>(`owned-staked-sui-frens`, inputs);

		return stakesInfo.map((info) => new StakedSuiFren(info, this.config, true));
	}

	/**
	 * Fetches a paginated page of staked SuiFrens filtered by attributes.
	 *
	 * `attributes` is serialized into the endpoint query string. `cursor` and
	 * `limit` are passed as dynamic-field pagination inputs, and `nextCursor` is
	 * `null` when the source has no later page. `sortBy` is serialized as the
	 * `sort` query parameter.
	 *
	 * @param inputs - Attribute filters, optional sort, cursor, and page limit.
	 * @returns Staked wrappers and the endpoint's nullable next cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getAllStakedSuiFrens(
		inputs: {
			attributes: Partial<SuiFrenAttributes>;
			sortBy?: SuiFrensSortOption;
		} & DynamicFieldsInputs
	): Promise<DynamicFieldObjectsWithCursor<StakedSuiFren>> {
		const stakesInfoWithCursor = await this.fetchApi<
			DynamicFieldObjectsWithCursor<StakedSuiFrenInfo>,
			ApiDynamicFieldsBody
		>(
			`filtered-staked-sui-frens/${SuiFrens.createStakedSuiFrensQueryString(
				inputs
			)}`,
			inputs
		);

		const suiFrens = stakesInfoWithCursor.dynamicFieldObjects.map(
			(info) => new StakedSuiFren(info, this.config)
		);
		return {
			dynamicFieldObjects: suiFrens,
			nextCursor: stakesInfoWithCursor.nextCursor,
		};
	}

	/**
	 * Fetches staked SuiFrens by their metadata object IDs.
	 *
	 * @param inputs - Staked SuiFren metadata object IDs.
	 * @returns Staked wrappers without owned-position data.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getStakedSuiFrens(inputs: { stakedSuiFrenIds: ObjectId[] }) {
		const suiFrenInfos = await this.fetchApi<StakedSuiFrenInfo[]>(
			`staked-sui-frens/${JSON.stringify(inputs.stakedSuiFrenIds)}`
		);
		return suiFrenInfos.map((info) => new StakedSuiFren(info, this.config));
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches the configured CapyLabs application object.
	 *
	 * @returns Current CapyLabs application values.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getCapyLabsApp() {
		return this.fetchApi<CapyLabsAppObject>(`capy-labs-app`);
	}

	/**
	 * Fetches accessories owned by a wallet.
	 *
	 * @param inputs - The wallet address whose accessory objects are listed.
	 * @returns Owned accessory objects.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getOwnedAccessories(inputs: ApiOwnedSuiFrenAccessoriesBody) {
		return this.fetchApi<
			SuiFrenAccessoryObject[],
			ApiOwnedSuiFrenAccessoriesBody
		>("owned-accessories", inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Fetches paginated fee-harvest events.
	 *
	 * The cursor and limit use `EventsInputs`; the returned `nextCursor` is null
	 * when no later event page exists.
	 *
	 * @param inputs - Event cursor and page limit.
	 * @returns Harvest events with a nullable cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getHarvestFeesEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<HarvestSuiFrenFeesEvent>(
			"events/harvest-fees",
			inputs
		);
	}

	/**
	 * Fetches paginated SuiFren mix events.
	 *
	 * @param inputs - Event cursor and page limit.
	 * @returns Mix events with a nullable cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getMixEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<MixSuiFrensEvent>("events/mix", inputs);
	}

	/**
	 * Fetches paginated SuiFren stake events.
	 *
	 * @param inputs - Event cursor and page limit.
	 * @returns Stake events with a nullable cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getStakeEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<StakeSuiFrenEvent>("events/stake", inputs);
	}

	/**
	 * Fetches paginated SuiFren unstake events.
	 *
	 * @param inputs - Event cursor and page limit.
	 * @returns Unstake events with a nullable cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	public async getUnstakeEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<UnstakeSuiFrenEvent>("events/unstake", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Builds an unsigned mix transaction for two SuiFrens.
	 *
	 * The low-level builder selects the Move branch from the two optional parent
	 * `mixFee` values, adds `baseFee` to the calculated internal fee, selects the
	 * required SUI coin, and sets `walletAddress` as sender. The caller must sign
	 * and execute the returned transaction.
	 *
	 * @param inputs - Parent IDs and optional staked fees, base fee, SuiFren type, wallet, and sponsorship flag.
	 * @returns An unsigned Sui `Transaction`.
	 * @throws `Error` when no `AftermathApi` is available.
	 * @throws Errors from coin selection, the provider, or the Sui transaction builder.
	 */
	public async getMixTransaction(inputs: ApiMixSuiFrensBody) {
		return this.suiFrensApi().fetchBuildMixTx(inputs);
	}

	/**
	 * Builds an unsigned transaction that harvests fees from staked positions.
	 *
	 * The returned transaction sets `walletAddress` as sender and transfers the
	 * harvested coin to that address after processing every position.
	 *
	 * @param inputs - Non-empty staked-position ID list and wallet address.
	 * @returns An unsigned Sui `Transaction`.
	 * @throws `Error` when no `AftermathApi` is available or the list is empty.
	 */
	public async getHarvestFeesTransaction(inputs: ApiHarvestSuiFrenFeesBody) {
		return this.suiFrensApi().fetchBuildHarvestFeesTx(inputs);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches aggregate SuiFrens statistics.
	 *
	 * The response includes vault totals and mix-event totals calculated over the
	 * previous 24 hours.
	*
	 * @returns Current totals, 24-hour fee volume, and 24-hour mix count.
	 * @throws `AftermathTransportError` when the stats request fails.
	 */
	public async getStats(): Promise<SuiFrenStats> {
		return this.fetchApi("stats");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Unwraps a `SuiFren` from either a plain or staked wrapper.
	 *
	 * @param suiFren - Wrapper to unwrap, or `undefined`.
	 * @returns The plain SuiFren wrapper, or `undefined`.
	 */
	public static suiFren(
		suiFren: SuiFren | StakedSuiFren | undefined
	): SuiFren | undefined {
		return suiFren instanceof SuiFren ? suiFren : suiFren?.suiFren;
	}

	/**
	 * Returns the underlying SuiFren object ID from either wrapper type.
	 *
	 * @param suiFren - Wrapper to inspect, or `undefined`.
	 * @returns The SuiFren object ID, or `undefined`.
	 */
	public static suiFrenId(
		suiFren: SuiFren | StakedSuiFren | undefined
	): ObjectId | undefined {
		return suiFren?.suiFren instanceof SuiFren
			? suiFren?.suiFren?.suiFren.objectId
			: suiFren?.suiFren?.objectId;
	}

	/**
	 * Returns the staked mix fee from a wrapper.
	*
	 * Plain SuiFrens and `undefined` return `undefined`.
	*
	 * @param suiFren - Wrapper to inspect, or `undefined`.
	 * @returns The staked fee in the payment coin's smallest unit, or `undefined`.
	 */
	public static mixFee(
		suiFren: SuiFren | StakedSuiFren | undefined
	): Balance | undefined {
		return suiFren instanceof StakedSuiFren ? suiFren?.mixFee() : undefined;
	}

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static createStakedSuiFrensQueryString(inputs: {
		attributes: Partial<SuiFrenAttributes>;
		sortBy?: SuiFrensSortOption;
	}) {
		const { attributes, sortBy } = inputs;

		const startStr = sortBy ? `?sort=${sortBy}` : "";

		return Object.keys(attributes).length === 0
			? startStr
			: (startStr === "" ? "?" : startStr) +
					Object.entries(attributes)
						.map(
							([key, val], i) =>
								`${i === 0 && startStr === "" ? "" : "&"}${key}=${val}`
						)
						.reduce((acc, curr) => acc + curr, "");
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

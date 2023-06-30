import { ObjectId } from "@mysten/sui.js";
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
} from "../../types";
import { SuiFren } from "./suiFren";
import { StakedSuiFren } from "./stakedSuiFren";
import { Caller } from "../../general/utils/caller";
import { Coin } from "../coin";

export class SuiFrens extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		mixingFeeCoinType: Coin.constants.suiCoinType,
		protocolFees: {
			mint: BigInt(250_000_000), // 0.25 SUI
			mixOwned: BigInt(250_000_000), // 0.25 SUI
			minMixStaked: BigInt(250_000_000), // 0.25 SUI
			mixStakedPercentage: 0.1, // 10%
		},
		suifrenFees: {
			mint: BigInt(8_000_000_000), // 8 SUI
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "sui-frens");
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	// public static calcMixFee(inputs: {
	// 	mixFee1: Balance | undefined;
	// 	mixFee2: Balance | undefined;
	// }): Balance {

	// 	const {mixFee1, mixFee2} = inputs

	// 	if (mixFee1 === undefined && mixFee2 === undefined ) return this.constants.protocolFees.

	// }

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getSuiFren(inputs: { suiFrenObjectId: ObjectId }) {
		const suiFrens = await this.getSuiFrens({
			suiFrenObjectIds: [inputs.suiFrenObjectId],
		});
		return suiFrens[0];
	}

	public async getSuiFrens(inputs: { suiFrenObjectIds: ObjectId[] }) {
		const suiFrens = await this.fetchApi<SuiFrenObject[]>(
			`${JSON.stringify(inputs.suiFrenObjectIds)}`
		);
		return suiFrens.map((suiFren) => new SuiFren(suiFren, this.network));
	}

	public async getOwnedSuiFrens(inputs: ApiOwnedSuiFrensBody) {
		const ownedSuiFrens = await this.fetchApi<
			SuiFrenObject[],
			ApiOwnedSuiFrensBody
		>(`owned-sui-frens`, inputs);

		return ownedSuiFrens.map(
			(suiFren) => new SuiFren(suiFren, this.network, false, true)
		);
	}

	public async getOwnedStakedSuiFrens(inputs: ApiOwnedStakedSuiFrensBody) {
		const stakesInfo = await this.fetchApi<
			StakedSuiFrenInfo[],
			ApiOwnedStakedSuiFrensBody
		>(`owned-staked-sui-frens`, inputs);

		return stakesInfo.map(
			(info) => new StakedSuiFren(info, this.network, true)
		);
	}

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
			(info) => new StakedSuiFren(info, this.network)
		);
		return {
			dynamicFieldObjects: suiFrens,
			nextCursor: stakesInfoWithCursor.nextCursor,
		};
	}

	public async getStakedSuiFrens(inputs: { stakedSuiFrenIds: ObjectId[] }) {
		const suiFrenInfos = await this.fetchApi<StakedSuiFrenInfo[]>(
			`staked-sui-frens/${JSON.stringify(inputs.stakedSuiFrenIds)}`
		);
		return suiFrenInfos.map(
			(info) => new StakedSuiFren(info, this.network)
		);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getCapyLabsApp() {
		return this.fetchApi<CapyLabsAppObject>(`capy-labs-app`);
	}

	public async getOwnedAccessories(inputs: ApiOwnedSuiFrenAccessoriesBody) {
		return this.fetchApi<
			SuiFrenAccessoryObject[],
			ApiOwnedSuiFrenAccessoriesBody
		>("owned-accessories", inputs);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getHarvestFeesEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<HarvestSuiFrenFeesEvent>(
			"events/harvest-fees",
			inputs
		);
	}

	public async getMixEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<MixSuiFrensEvent>("events/mix", inputs);
	}

	public async getStakeEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<StakeSuiFrenEvent>("events/stake", inputs);
	}

	public async getUnstakeEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<UnstakeSuiFrenEvent>(
			"events/unstake",
			inputs
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getMixTransaction(inputs: ApiMixSuiFrensBody) {
		return this.fetchApiTransaction<ApiMixSuiFrensBody>(
			"transactions/mix",
			inputs
		);
	}

	public async getHarvestFeesTransaction(inputs: ApiHarvestSuiFrenFeesBody) {
		return this.fetchApiTransaction<ApiHarvestSuiFrenFeesBody>(
			"transactions/harvest-fees",
			inputs
		);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getStats(): Promise<SuiFrenStats> {
		return this.fetchApi("stats");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static suiFren(
		suiFren: SuiFren | StakedSuiFren | undefined
	): SuiFren | undefined {
		return suiFren instanceof SuiFren ? suiFren : suiFren?.suiFren;
	}

	public static suiFrenId(
		suiFren: SuiFren | StakedSuiFren | undefined
	): ObjectId | undefined {
		return suiFren?.suiFren instanceof SuiFren
			? suiFren?.suiFren?.suiFren.objectId
			: suiFren?.suiFren?.objectId;
	}

	public static mixFee(
		suiFren: SuiFren | StakedSuiFren | undefined
	): Balance | undefined {
		return suiFren instanceof StakedSuiFren ? suiFren.mixFee() : BigInt(0);
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
								`${
									i === 0 && startStr === "" ? "" : "&"
								}${key}=${val}`
						)
						.reduce((acc, curr) => acc + curr, "");
	}
}

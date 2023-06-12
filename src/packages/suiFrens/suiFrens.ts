import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	ApiMixSuiFrensBody,
	ApiDynamicFieldsBody,
	BreedSuiFrensEvent,
	SuiFrenObject,
	SuiFrenStats,
	DynamicFieldObjectsWithCursor,
	EventsInputs,
	StakeSuiFrenEvent,
	StakedSuiFrenMetadataObject,
	SuiNetwork,
	UnstakeSuiFrenEvent,
	Url,
	SuiFrenAttributes,
	CapyLabsAppObject,
	StakedSuiFrenPositionObject,
	StakedSuiFrenInfo,
	DynamicFieldsInputs,
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
	//  Class Objects
	// =========================================================================

	public async getSuiFren(suiFrenObjectId: ObjectId) {
		const suiFrens = await this.getSuiFrens([suiFrenObjectId]);
		return suiFrens[0];
	}

	public async getSuiFrens(suiFrenObjectIds: ObjectId[]) {
		const suiFrens = await this.fetchApi<SuiFrenObject[]>(
			`${JSON.stringify(suiFrenObjectIds)}`
		);
		return suiFrens.map((suiFren) => new SuiFren(suiFren, this.network));
	}

	public async getUserSuiFrens(inputs: { walletAddress: SuiAddress }) {
		const ownedSuiFrens = await this.fetchApi<SuiFrenObject[]>(
			`owned-sui-frens/${inputs.walletAddress}`
		);

		return ownedSuiFrens.map(
			(suiFren) => new SuiFren(suiFren, this.network)
		);
	}

	public async getUserStakedSuiFrens(inputs: { walletAddress: SuiAddress }) {
		const stakesInfo = await this.fetchApi<StakedSuiFrenInfo[]>(
			`staked-sui-frens/${inputs.walletAddress}`
		);

		return stakesInfo.map((info) => new StakedSuiFren(info, this.network));
	}

	public async getStakedSuiFrens(
		inputs: {
			attributes?: Partial<SuiFrenAttributes>;
		} & DynamicFieldsInputs
	): Promise<DynamicFieldObjectsWithCursor<StakedSuiFren>> {
		const stakesInfoWithCursor = await this.fetchApi<
			DynamicFieldObjectsWithCursor<StakedSuiFrenInfo>,
			ApiDynamicFieldsBody
		>(
			`staked-sui-frens${SuiFrens.createSuiFrenAttributesQueryString(
				inputs.attributes
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

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getCapyLabsApp() {
		return this.fetchApi<CapyLabsAppObject>(`capy-labs-app`);
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getMixEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<BreedSuiFrensEvent>("events/breed", inputs);
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
	////////////////////////////////////////////////////////////////////

	public async getMixTx(inputs: ApiMixSuiFrensBody) {
		return this.fetchApiTransaction<ApiMixSuiFrensBody>(
			"transactions/breed",
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
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static createSuiFrenAttributesQueryString(
		attributes?: Partial<SuiFrenAttributes>
	) {
		return attributes === undefined || Object.keys(attributes).length === 0
			? ""
			: "?" +
					Object.entries(attributes)
						.map(
							([key, val], i) =>
								`${i === 0 ? "" : "&"}${key}=${val}`
						)
						.reduce((acc, curr) => acc + curr, "");
	}
}

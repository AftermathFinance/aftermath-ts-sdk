import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	ApiBreedSuiFrenBody,
	ApiDynamicFieldsBody,
	ApiEventsBody,
	BreedSuiFrensEvent,
	SuiFrenAttribute,
	SuiFrenObject,
	SuiFrenStats,
	DynamicFieldObjectsWithCursor,
	EventsInputs,
	EventsWithCursor,
	SerializedTransaction,
	StakeSuiFrenEvent,
	StakedSuiFrenReceiptObject,
	SuiNetwork,
	UnstakeSuiFrenEvent,
	Url,
} from "../../types";
import { SuiFren } from "./suiFren";
import { StakedSuiFrenReceipt } from "./stakedSuiFrenReceipt";
import { Caller } from "../../general/utils/caller";

export class SuiFrens extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		breedingFees: {
			coinType: "0x0000000000000000000000000000000000000002::sui::SUI",
			amounts: {
				breedAndKeep: BigInt(1_000_000), // MIST -> 0.001 SUI
				breedWithStakedAndKeep: BigInt(5_000_000), // MIST -> 0.005 SUI
				breedStakedWithStakedAndKeep: BigInt(10_000_000), // MIST -> 0.01 SUI
			},
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "suiFrens");
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

	public async getOwnedSuiFrens(walletAddress: SuiAddress) {
		const ownedSuiFrens = await this.fetchApi<SuiFrenObject[]>(
			`owned-suiFrens/${walletAddress}`
		);

		return ownedSuiFrens.map((suiFren) => new SuiFren(suiFren, this.network));
	}

	public async getStakedSuiFrenReceipts(walletAddress: SuiAddress) {
		const stakedSuiFrenReceipts = await this.fetchApi<
			StakedSuiFrenReceiptObject[]
		>(`staked-suiFren-receipts/${walletAddress}`);

		const stakedSuiFrens = await this.getSuiFrens(
			stakedSuiFrenReceipts.map((receipt) => receipt.suiFrenId)
		);

		return stakedSuiFrenReceipts.map(
			(receipt, index) =>
				new StakedSuiFrenReceipt(
					new SuiFren(stakedSuiFrens[index].suiFren, this.network, true),
					receipt,
					this.network
				)
		);
	}

	// =========================================================================
	//  Dynamic Fields
	// =========================================================================

	public async getStakedSuiFrens(
		attributes?: SuiFrenAttribute[],
		cursor?: ObjectId,
		limit?: number
	): Promise<DynamicFieldObjectsWithCursor<SuiFren>> {
		const suiFrensWithCursor = await this.fetchApi<
			DynamicFieldObjectsWithCursor<SuiFrenObject>,
			ApiDynamicFieldsBody
		>(`staked-suiFrens${SuiFrens.createSuiFrenAttributesQueryString(attributes)}`, {
			cursor,
			limit,
		});

		const suiFrens = suiFrensWithCursor.dynamicFieldObjects.map(
			(suiFren) => new SuiFren(suiFren, this.network, true)
		);

		return {
			dynamicFieldObjects: suiFrens,
			nextCursor: suiFrensWithCursor.nextCursor,
		};
	}

	// =========================================================================
	//  Events
	// =========================================================================

	public async getBreedSuiFrenEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<BreedSuiFrensEvent>(
			"events/breed-suiFrens",
			inputs
		);
	}

	public async getStakeSuiFrenEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<StakeSuiFrenEvent>("events/stake-suiFren", inputs);
	}

	public async getUnstakeSuiFrenEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<UnstakeSuiFrenEvent>(
			"events/unstake-suiFren",
			inputs
		);
	}

	// =========================================================================
	//  Transactions
	////////////////////////////////////////////////////////////////////

	public async getBreedSuiFrensTransaction(
		walletAddress: SuiAddress,
		suiFrenParentOneId: ObjectId,
		suiFrenParentTwoId: ObjectId
	) {
		return this.fetchApiTransaction<ApiBreedSuiFrenBody>(
			"transactions/breed",
			{
				walletAddress,
				suiFrenParentOneId,
				suiFrenParentTwoId,
			}
		);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getIsPackageOnChain(): Promise<boolean> {
		return this.fetchApi("status");
	}

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
		attributes?: SuiFrenAttribute[]
	) {
		return attributes === undefined || attributes.length === 0
			? ""
			: "?" +
					attributes
						.map(
							(attr, i) =>
								`${i === 0 ? "" : "&"}${attr.name}=${
									attr.value
								}`
						)
						.reduce((acc, curr) => acc + curr, "");
	}
}

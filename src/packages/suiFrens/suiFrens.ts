import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	ApiBreedSuiFrenBody,
	ApiDynamicFieldsBody,
	BreedSuiFrensEvent,
	SuiFrenObject,
	SuiFrenStats,
	DynamicFieldObjectsWithCursor,
	EventsInputs,
	StakeSuiFrenEvent,
	StakedSuiFrenReceiptObject,
	SuiNetwork,
	UnstakeSuiFrenEvent,
	Url,
	SuiFrenAttributes,
} from "../../types";
import { SuiFren } from "./suiFren";
import { StakedSuiFrenReceipt } from "./stakedSuiFrenReceipt";
import { Caller } from "../../general/utils/caller";
import { Coin } from "../coin";

export class SuiFrens extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		breedingFees: {
			coinType: Coin.constants.suiCoinType,
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

	public async getOwnedSuiFrens(walletAddress: SuiAddress) {
		const ownedSuiFrens = await this.fetchApi<SuiFrenObject[]>(
			`owned-sui-frens/${walletAddress}`
		);

		return ownedSuiFrens.map(
			(suiFren) => new SuiFren(suiFren, this.network)
		);
	}

	public async getStakedSuiFrenReceipts(walletAddress: SuiAddress) {
		const stakedSuiFrenReceipts = await this.fetchApi<
			StakedSuiFrenReceiptObject[]
		>(`staked-sui-fren-receipts/${walletAddress}`);

		const stakedSuiFrens = await this.getSuiFrens(
			stakedSuiFrenReceipts.map((receipt) => receipt.suiFrenId)
		);

		return stakedSuiFrenReceipts.map(
			(receipt, index) =>
				new StakedSuiFrenReceipt(
					new SuiFren(
						stakedSuiFrens[index].suiFren,
						this.network,
						true
					),
					receipt,
					this.network
				)
		);
	}

	// =========================================================================
	//  Dynamic Fields
	// =========================================================================

	public async getStakedSuiFrens(
		attributes?: Partial<SuiFrenAttributes>,
		cursor?: ObjectId,
		limit?: number
	): Promise<DynamicFieldObjectsWithCursor<SuiFren>> {
		const suiFrensWithCursor = await this.fetchApi<
			DynamicFieldObjectsWithCursor<SuiFrenObject>,
			ApiDynamicFieldsBody
		>(
			`staked-sui-frens${SuiFrens.createSuiFrenAttributesQueryString(
				attributes
			)}`,
			{
				cursor,
				limit,
			}
		);

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
		return this.fetchApiEvents<BreedSuiFrensEvent>("events/breed", inputs);
	}

	public async getStakeSuiFrenEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<StakeSuiFrenEvent>("events/stake", inputs);
	}

	public async getUnstakeSuiFrenEvents(inputs: EventsInputs) {
		return this.fetchApiEvents<UnstakeSuiFrenEvent>(
			"events/unstake",
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

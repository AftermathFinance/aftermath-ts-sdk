import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	ApiBreedCapyBody,
	ApiDynamicFieldsBody,
	ApiEventsBody,
	BreedCapysEvent,
	CapyAttribute,
	CapyObject,
	CapyStats,
	DynamicFieldObjectsWithCursor,
	EventsWithCursor,
	SerializedTransaction,
	StakeCapyEvent,
	StakedCapyReceiptObject,
	SuiNetwork,
	UnstakeCapyEvent,
} from "../../types";
import { Capy } from "./capy";
import { StakedCapyReceipt } from "./stakedCapyReceipt";
import { Caller } from "../../general/utils/caller";

export class Capys extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

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

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "capys");
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	public async getCapy(capyObjectId: ObjectId) {
		const capys = await this.getCapys([capyObjectId]);
		return capys[0];
	}

	public async getCapys(capyObjectIds: ObjectId[]) {
		const capys = await this.fetchApi<CapyObject[]>(
			`${JSON.stringify(capyObjectIds)}`
		);

		return capys.map((capy) => new Capy(capy, this.network));
	}

	public async getOwnedCapys(walletAddress: SuiAddress) {
		const ownedCapys = await this.fetchApi<CapyObject[]>(
			`owned-capys/${walletAddress}`
		);

		return ownedCapys.map((capy) => new Capy(capy, this.network));
	}

	public async getStakedCapyReceipts(walletAddress: SuiAddress) {
		const stakedCapyReceipts = await this.fetchApi<
			StakedCapyReceiptObject[]
		>(`staked-capy-receipts/${walletAddress}`);

		const stakedCapys = await this.getCapys(
			stakedCapyReceipts.map((receipt) => receipt.capyId)
		);

		return stakedCapyReceipts.map(
			(receipt, index) =>
				new StakedCapyReceipt(
					new Capy(stakedCapys[index].capy, this.network, true),
					receipt,
					this.network
				)
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Dynamic Fields
	/////////////////////////////////////////////////////////////////////

	public async getStakedCapys(
		attributes?: CapyAttribute[],
		cursor?: ObjectId,
		limit?: number
	): Promise<DynamicFieldObjectsWithCursor<Capy>> {
		const capysWithCursor = await this.fetchApi<
			DynamicFieldObjectsWithCursor<CapyObject>,
			ApiDynamicFieldsBody
		>(`staked-capys${Capys.createCapyAttributesQueryString(attributes)}`, {
			cursor,
			limit,
		});

		const capys = capysWithCursor.dynamicFieldObjects.map(
			(capy) => new Capy(capy, this.network, true)
		);

		return {
			dynamicFieldObjects: capys,
			nextCursor: capysWithCursor.nextCursor,
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getBreedCapyEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<BreedCapysEvent>("events/breed-capys", {
			cursor,
			limit,
		});
	}

	public async getStakeCapyEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<StakeCapyEvent>("events/stake-capy", {
			cursor,
			limit,
		});
	}

	public async getUnstakeCapyEvents(cursor?: EventId, limit?: number) {
		return this.fetchApiEvents<UnstakeCapyEvent>("events/unstake-capy", {
			cursor,
			limit,
		});
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	////////////////////////////////////////////////////////////////////

	public async getBreedCapysTransaction(
		walletAddress: SuiAddress,
		capyParentOneId: ObjectId,
		capyParentTwoId: ObjectId
	) {
		return this.fetchApiTransaction<ApiBreedCapyBody>(
			"transactions/breed",
			{
				walletAddress,
				capyParentOneId,
				capyParentTwoId,
			}
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public async getIsPackageOnChain(): Promise<boolean> {
		return this.fetchApi("status");
	}

	public async getStats(): Promise<CapyStats> {
		return this.fetchApi("stats");
	}

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static createCapyAttributesQueryString(
		attributes?: CapyAttribute[]
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

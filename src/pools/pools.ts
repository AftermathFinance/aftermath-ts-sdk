import { EventId, ObjectId, SuiAddress } from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiEventsBody,
	EventsWithCursor,
	PoolDepositEvent,
	PoolDynamicFields,
	PoolObject,
	PoolSwapEvent,
	PoolWithdrawEvent,
} from "../types";
import { Pool } from "./pool";

export class Pools extends AftermathProvider {
	constructor(public readonly network: SuiNetwork) {
		super(network, "pools");
	}

	/////////////////////////////////////////////////////////////////////
	//// Class Objects
	/////////////////////////////////////////////////////////////////////

	public async getPool(poolObjectId: ObjectId): Promise<Pool> {
		const [pool, poolDynamicFields] = await Promise.all([
			this.fetchApi<PoolObject>(`${poolObjectId}`),
			this.fetchApi<PoolDynamicFields>(`${poolObjectId}/dynamicFields`),
		]);
		return new Pool(this.network, pool, poolDynamicFields);
	}

	public async getPools(poolObjectIds: ObjectId[]): Promise<Pool[]> {
		const pools = await Promise.all(poolObjectIds.map(this.getPool));
		return pools;
	}

	public async getAllPools(): Promise<Pool[]> {
		const pools = await this.fetchApi<PoolObject[]>("");
		const poolDynamicFields = await Promise.all(
			pools.map((pool) =>
				this.fetchApi<PoolDynamicFields>(
					`${pool.objectId}/dynamicFields`
				)
			)
		);
		return pools.map(
			(pool, index) =>
				new Pool(this.network, pool, poolDynamicFields[index])
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getDepositEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<PoolDepositEvent>> {
		return this.fetchApi<EventsWithCursor<PoolDepositEvent>, ApiEventsBody>(
			"events/deposit",
			{
				cursor,
				limit,
			}
		);
	}

	public async getWithdrawEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<PoolWithdrawEvent>> {
		return this.fetchApi<
			EventsWithCursor<PoolWithdrawEvent>,
			ApiEventsBody
		>("events/withdraw", {
			cursor,
			limit,
		});
	}

	public async getTradeEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<PoolSwapEvent>> {
		return this.fetchApi<EventsWithCursor<PoolSwapEvent>, ApiEventsBody>(
			"events/trade",
			{
				cursor,
				limit,
			}
		);
	}
}

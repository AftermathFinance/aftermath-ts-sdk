import { EventId, ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathProvider } from "../provider/provider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import { EventsWithCursor, PoolObject, PoolSwapEvent } from "aftermath-sdk";
import { Pool } from "./pool";
import { ApiEventsBody } from "../types/apiTypes";

export class Pools extends AftermathProvider {
	constructor(public readonly network: SuiNetwork) {
		super(network, "/indices/pools/");
	}

	callFetchApi<Output, BodyType = undefined>(
		url: string,
		body?: BodyType | undefined
	): Promise<Output> {
		return this.fetchApi(url, body);
	}

	public async getPool(poolObjectId: ObjectId): Promise<Pool> {
		const pool = await this.fetchApi<PoolObject>(`${poolObjectId}`);
		return new Pool(this.network, pool);
	}

	public async getAllPools(): Promise<Pool[]> {
		const pools = await this.fetchApi<PoolObject[]>("");
		return pools.map((pool) => new Pool(this.network, pool));
	}

	public async getTradeEvents(
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<PoolSwapEvent>> {
		return this.fetchApi<EventsWithCursor<PoolSwapEvent>, ApiEventsBody>(
			"events/swaps",
			{
				cursor,
				limit,
			}
		);
	}
}

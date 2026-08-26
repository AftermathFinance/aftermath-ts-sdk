import { Aftermath, Coin, Farms, FarmsStakingPool, Pools } from "@sdk";
import { Prices } from "@sdk/general/prices/prices";

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const config = { baseUrl: "https://sdk.test" };
const poolFixture = { objectId: "0xpool" };
const farmFixture = { objectId: "0xfarm" };
const metadataFixture = {
	name: "Sui",
	symbol: "SUI",
	description: "Sui",
	decimals: 9,
};
const priceInfoFixture = {
	price: 1.25,
	priceChange24HoursPercentage: 0,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function installJsonFetch(payload: unknown): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(Response.json(payload));
	}) as typeof fetch;
	return calls;
}

function installFailingFetch(): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(new Error("unexpected network request"));
	}) as typeof fetch;
	return calls;
}

function makeSignal(): AbortSignal {
	return new AbortController().signal;
}

function expectSignal(calls: FetchCall[], signal: AbortSignal): void {
	if (calls.length !== 1 || calls[0]?.init?.signal !== signal) {
		throw new Error("fake fetch did not receive the sentinel signal");
	}
}

function expectPostBodyWithoutSignal(calls: FetchCall[]): void {
	const body = calls[0]?.init?.body;
	if (typeof body !== "string") {
		throw new Error("fake fetch did not receive a JSON request body");
	}
	const parsed = JSON.parse(body as string) as Record<string, unknown>;
	if ("signal" in parsed) {
		throw new Error("AbortSignal was serialized into the request body");
	}
}

describe("Aftermath factory signal propagation", () => {
	it("forwards the signal during address discovery", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch({});
		await Aftermath.create({ baseUrl: config.baseUrl }, signal);
		expectSignal(calls, signal);
		expect(calls[0].init?.body).toBeUndefined();
	});

	it("keeps the addresses fast path network-free", async () => {
		const signal = makeSignal();
		const calls = installFailingFetch();
		await Aftermath.create({ addresses: {} }, signal);
		expect(calls).toHaveLength(0);
	});

	it("keeps the API fast path network-free", async () => {
		const signal = makeSignal();
		const calls = installFailingFetch();
		await Aftermath.create({ api: {} as never }, signal);
		expect(calls).toHaveLength(0);
	});
});

describe("Pools signal propagation", () => {
	it("forwards the signal for getPool", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch(poolFixture);
		const pool = await new Pools(config).getPool(
			{ objectId: poolFixture.objectId },
			signal
		);
		expect(pool.pool.objectId).toBe(poolFixture.objectId);
		expectSignal(calls, signal);
	});

	it("forwards the signal for getPools", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([poolFixture]);
		const pools = await new Pools(config).getPools(
			{ objectIds: [poolFixture.objectId] },
			signal
		);
		expect(pools).toHaveLength(1);
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);
	});

	it("forwards the signal for getAllPools", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([poolFixture]);
		const pools = await new Pools(config).getAllPools(signal);
		expect(pools).toHaveLength(1);
		expectSignal(calls, signal);
	});

	it("forwards the signal for pool stats", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([]);
		const stats = await new Pools(config).getPoolsStats(
			{ poolIds: [poolFixture.objectId] },
			signal
		);
		expect(stats).toEqual([]);
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);
	});

	it("forwards the signal for pool summaries", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([
			{
				pool: poolFixture,
				stats: {
					volume: 1,
					tvl: 2,
					supplyPerLps: [],
					lpPrice: 3,
					fees: 4,
					apr: 0.5,
				},
			},
		]);
		const summaries = await new Pools(config).getPoolSummaries(
			{ poolIds: [poolFixture.objectId] },
			signal
		);
		expect(summaries[0]?.pool.objectId).toBe(poolFixture.objectId);
		expect(summaries[0]?.stats.tvl).toBe(2);
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);
	});

	it("forwards the signal through LP object-id wrappers", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([poolFixture.objectId]);
		const ids = await new Pools(config).getPoolObjectIdForLpCoinType(
			{ lpCoinType: "0xlp::pool::LP" },
			signal
		);
		expect(ids).toEqual([poolFixture.objectId]);
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);
	});

	it("forwards the signal through isLpCoinType", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([poolFixture.objectId]);
		const result = await new Pools(config).isLpCoinType(
			{ lpCoinType: "0xlp::pool::LP" },
			signal
		);
		expect(result).toBe(true);
		expectSignal(calls, signal);
	});
});

describe("Farms signal propagation", () => {
	it("forwards the signal for farm lookup and batches", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch(farmFixture);
		const pool = await new Farms(config).getStakingPool(
			{ objectId: farmFixture.objectId },
			signal
		);
		expect(pool.stakingPool.objectId).toBe(farmFixture.objectId);
		expectSignal(calls, signal);

		const batchSignal = makeSignal();
		const batchCalls = installJsonFetch([farmFixture]);
		const pools = await new Farms(config).getStakingPools(
			{ objectIds: [farmFixture.objectId] },
			batchSignal
		);
		expect(pools).toHaveLength(1);
		expectSignal(batchCalls, batchSignal);
		expectPostBodyWithoutSignal(batchCalls);
	});

	it("forwards the signal for farm lists and TVL reads", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([farmFixture]);
		const pools = await new Farms(config).getAllStakingPools(signal);
		expect(pools).toHaveLength(1);
		expectSignal(calls, signal);

		const tvlSignal = makeSignal();
		const tvlCalls = installJsonFetch(12.5);
		expect(await new Farms(config).getTVL(undefined, tvlSignal)).toBe(12.5);
		expectSignal(tvlCalls, tvlSignal);
		expectPostBodyWithoutSignal(tvlCalls);

		const rewardsSignal = makeSignal();
		const rewardsCalls = installJsonFetch(7.5);
		expect(
			await new Farms(config).getRewardsTVL(
				{ farmIds: [farmFixture.objectId] },
				rewardsSignal
			)
		).toBe(7.5);
		expectSignal(rewardsCalls, rewardsSignal);
		expectPostBodyWithoutSignal(rewardsCalls);
	});

	it("forwards the signal for farm summaries", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([
			{ farmId: farmFixture.objectId, tvl: 12.5, rewardsTvl: 7.5 },
		]);
		const summaries = await new Farms(config).getFarmSummaries(
			{ farmIds: [farmFixture.objectId] },
			signal
		);
		expect(summaries).toEqual([
			{ farmId: farmFixture.objectId, tvl: 12.5, rewardsTvl: 7.5 },
		]);
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);
	});

	it("forwards the signal through FarmsStakingPool TVL delegation", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch(12.5);
		const pool = new FarmsStakingPool(farmFixture as never, config);
		expect(await pool.getTVL(signal)).toBe(12.5);
		expectSignal(calls, signal);

		const rewardsSignal = makeSignal();
		const rewardsCalls = installJsonFetch(7.5);
		expect(await pool.getRewardsTVL(rewardsSignal)).toBe(7.5);
		expectSignal(rewardsCalls, rewardsSignal);
	});
});

describe("Prices signal propagation", () => {
	it("forwards the signal through all price wrappers", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch({ SUI: priceInfoFixture });
		expect(
			(
				await new Prices(config).getCoinPriceInfo(
					{ coin: "0x2::sui::SUI" },
					signal
				)
			).price
		).toBe(priceInfoFixture.price);
		expectSignal(calls, signal);

		const infoSignal = makeSignal();
		const infoCalls = installJsonFetch({ SUI: priceInfoFixture });
		expect(
			await new Prices(config).getCoinsToPriceInfo(
				{ coins: ["0x2::sui::SUI"] },
				infoSignal
			)
		).toEqual({ SUI: priceInfoFixture });
		expectSignal(infoCalls, infoSignal);
		expectPostBodyWithoutSignal(infoCalls);

		const priceSignal = makeSignal();
		const priceCalls = installJsonFetch({ SUI: priceInfoFixture });
		expect(
			await new Prices(config).getCoinPrice(
				{ coin: "0x2::sui::SUI" },
				priceSignal
			)
		).toBe(priceInfoFixture.price);
		expectSignal(priceCalls, priceSignal);

		const pricesSignal = makeSignal();
		const pricesCalls = installJsonFetch({ SUI: priceInfoFixture });
		expect(
			await new Prices(config).getCoinsToPrice(
				{ coins: ["0x2::sui::SUI"] },
				pricesSignal
			)
		).toEqual({ SUI: priceInfoFixture.price });
		expectSignal(pricesCalls, pricesSignal);
		expectPostBodyWithoutSignal(pricesCalls);
	});
});

describe("Coin signal propagation and caching", () => {
	it("forwards the signal through metadata and decimal wrappers", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch([metadataFixture]);
		expect(
			await new Coin("0x2::sui::SUI", config).getCoinsToDecimals(
				{ coins: ["0x2::sui::SUI"] },
				signal
			)
		).toEqual({ "0x2::sui::SUI": 9 });
		expectSignal(calls, signal);
		expectPostBodyWithoutSignal(calls);

		const metadataSignal = makeSignal();
		const metadataCalls = installJsonFetch([metadataFixture]);
		expect(
			await new Coin("0x2::sui::SUI", config).getCoinMetadata(
				undefined,
				metadataSignal
			)
		).toEqual(metadataFixture);
		expectSignal(metadataCalls, metadataSignal);
		expectPostBodyWithoutSignal(metadataCalls);

		const metadatasSignal = makeSignal();
		const metadatasCalls = installJsonFetch([metadataFixture]);
		expect(
			await new Coin("0x2::sui::SUI", config).getCoinMetadatas(
				{ coins: ["0x2::sui::SUI"] },
				metadatasSignal
			)
		).toEqual([metadataFixture]);
		expectSignal(metadatasCalls, metadatasSignal);
		expectPostBodyWithoutSignal(metadatasCalls);
	});

	it("forwards the signal through getPrice and does not fetch cached values", async () => {
		const signal = makeSignal();
		const calls = installJsonFetch({ SUI: priceInfoFixture });
		const coin = new Coin("0x2::sui::SUI", config);
		expect(await coin.getPrice(undefined, signal)).toEqual(priceInfoFixture);
		expectSignal(calls, signal);

		const cached = new Coin("0x2::sui::SUI", config);
		cached.setPriceInfo(priceInfoFixture);
		cached.setCoinMetadata(metadataFixture);
		const cachedCalls = installFailingFetch();
		expect(await cached.getPrice(undefined, makeSignal())).toEqual(
			priceInfoFixture
		);
		expect(await cached.getCoinMetadata(undefined, makeSignal())).toEqual(
			metadataFixture
		);
		expect(cachedCalls).toHaveLength(0);
	});

	it("keeps no-signal response behavior and shape compatible", async () => {
		const calls = installJsonFetch({ SUI: priceInfoFixture });
		const result = await new Prices(config).getCoinsToPriceInfo({
			coins: ["0x2::sui::SUI"],
		});
		expect(result).toEqual({ SUI: priceInfoFixture });
		expect(calls).toHaveLength(1);
		expect(calls[0].init?.signal).toBeUndefined();
	});
});

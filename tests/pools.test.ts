import type { Transaction } from "@mysten/sui/transactions";
import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import type { AftermathApi } from "../src/general/providers";
import type { EventOnChain } from "../src/general/types/castingTypes";
import type { SuiObjectView } from "../src/general/utils/grpcCasting";
import type {
	CoinType,
	ConfigAddresses,
	DaoFeePoolOwnerCapObject,
	PoolCoin,
	PoolObject,
	PoolStats,
} from "../src/types";

const registerModuleMock = (
	moduleName: string,
	factory: () => unknown
): void => {
	if (process.versions.bun) {
		jest.mock(moduleName, factory as never);
	} else {
		jest.unstable_mockModule(moduleName, factory as never);
	}
};

const HEX_ADDRESS_REGEX = /^0x[0-9a-f]+$/i;
const HEX_PREFIX_REGEX = /^0x/;

registerModuleMock("@mysten/sui/utils", () => ({
	fromBase64: (value: string) => Uint8Array.from(Buffer.from(value, "base64")),
	isValidSuiAddress: (value: string) => HEX_ADDRESS_REGEX.test(value),
	normalizeSuiObjectId: (value: string) =>
		`0x${value.replace(HEX_PREFIX_REGEX, "").padStart(64, "0")}`,
	toBase64: (value: Uint8Array) => Buffer.from(value).toString("base64"),
}));
registerModuleMock("@mysten/sui/cryptography", () => ({
	decodeSuiPrivateKey: () => ({
		scheme: "ED25519",
		secretKey: new Uint8Array(),
	}),
}));
registerModuleMock("@mysten/sui/keypairs/ed25519", () => ({
	Ed25519Keypair: {
		fromSecretKey: (value: Uint8Array) => ({ scheme: "ED25519", value }),
	},
}));
registerModuleMock("@mysten/sui/keypairs/secp256k1", () => ({
	Secp256k1Keypair: {
		fromSecretKey: (value: Uint8Array) => ({ scheme: "Secp256k1", value }),
	},
}));
registerModuleMock("@mysten/sui/keypairs/secp256r1", () => ({
	Secp256r1Keypair: {
		fromSecretKey: (value: Uint8Array) => ({ scheme: "Secp256r1", value }),
	},
}));
registerModuleMock("@mysten/sui/transactions", () => ({
	Transaction: class {
		moveCalls: Record<string, unknown>[] = [];
		objects: unknown[] = [];
		pures: unknown[] = [];
		transfers: unknown[] = [];
		publishes: unknown[] = [];
		sender: string | undefined;
		pure: ((value: unknown) => unknown) & {
			u64(value: unknown): unknown;
			u128(value: unknown): unknown;
			u16(value: unknown): unknown;
			address(value: unknown): unknown;
			bool(value: unknown): unknown;
		};

		constructor() {
			const pure = ((value: unknown) => {
				const result = { kind: "pure", value };
				this.pures.push(result);
				return result;
			}) as typeof this.pure;
			pure.u64 = (value) => pure({ type: "u64", value });
			pure.u128 = (value) => pure({ type: "u128", value });
			pure.u16 = (value) => pure({ type: "u16", value });
			pure.address = (value) => pure({ type: "address", value });
			pure.bool = (value) => pure({ type: "bool", value });
			this.pure = pure;
		}

		setSender(value: string) {
			this.sender = value;
		}

		object(id: unknown) {
			const value = { kind: "object", id };
			this.objects.push(value);
			return value;
		}

		moveCall(options: Record<string, unknown>) {
			this.moveCalls.push(options);
			return { kind: "result", index: this.moveCalls.length - 1 };
		}

		transferObjects(objects: unknown, address: unknown) {
			this.transfers.push({ objects, address });
		}

		publish(options: unknown) {
			this.publishes.push(options);
			return { kind: "upgrade-cap" };
		}

		static from(value: unknown) {
			return value;
		}
		static fromKind(value: unknown) {
			return value;
		}
	},
}));
registerModuleMock("@mysten/sui/bcs", () => {
	const serialize = (value: unknown): Uint8Array =>
		new TextEncoder().encode(
			JSON.stringify(value, (_key, currentValue) =>
				typeof currentValue === "bigint"
					? currentValue.toString()
					: currentValue
			)
		);
	const scalar = () => ({ serialize });
	return {
		bcs: {
			option: scalar,
			u8: scalar,
			u64: scalar,
			vector: scalar,
		},
	};
});

type CmmmModule = typeof import("../src/packages/pools/utils/cmmmCalculations");
type PoolsApiCastingModule =
	typeof import("../src/packages/pools/api/poolsApiCasting");
type PoolsApiModule = typeof import("../src/packages/pools/api/poolsApi");
type PoolModule = typeof import("../src/packages/pools/pool");
type PoolsModule = typeof import("../src/packages/pools/pools");

let CmmmCalculations: CmmmModule["CmmmCalculations"];
let PoolsApiCasting: PoolsApiCastingModule["PoolsApiCasting"];
let PoolsApi: PoolsApiModule["PoolsApi"];
let Pool: PoolModule["Pool"];
let Pools: PoolsModule["Pools"];

const ONE_FIXED = 1_000_000_000_000_000_000n;
const A = "0x1::coin::A" as CoinType;
const B = "0x2::coin::B" as CoinType;
const LP = "0x3::af_lp::AF_LP_A_B" as CoinType;
const WALLET = "0x4";
const POOL_ID = "0x5";
const AMM = `0x${"a".repeat(64)}`;
const AMM_INTERFACE = `0x${"b".repeat(64)}`;
const EVENTS = `0x${"c".repeat(64)}`;
const EVENTS_V2 = `0x${"d".repeat(64)}`;
const REFERRAL_PACKAGE = `0x${"e".repeat(64)}`;
const DAO_AMM = `0x${"f".repeat(64)}`;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

const originalFetch = globalThis.fetch;

function wireJson(value: unknown): string {
	return JSON.stringify(value, (_key, currentValue) =>
		typeof currentValue === "bigint" ? `${currentValue}n` : currentValue
	);
}

function installFetch(
	payload: unknown,
	status = 200,
	responseText = wireJson(payload)
): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.resolve(
			new Response(responseText, {
				status,
				statusText: status === 200 ? "OK" : "failure",
			})
		);
	}) as typeof fetch;
	return calls;
}

function installNetworkFailure(): FetchCall[] {
	const calls: FetchCall[] = [];
	globalThis.fetch = ((input, init) => {
		calls.push({ input, init });
		return Promise.reject(new Error("offline sentinel"));
	}) as typeof fetch;
	return calls;
}

function requestBody(call: FetchCall): unknown {
	return typeof call.init?.body === "string"
		? JSON.parse(call.init.body)
		: undefined;
}

function requestUrl(call: FetchCall): string {
	return String(call.input);
}

function makeCoin(balance: bigint, options: Partial<PoolCoin> = {}): PoolCoin {
	return {
		weight: 500_000_000_000_000_000n,
		balance,
		tradeFeeIn: 0n,
		tradeFeeOut: 0n,
		depositFee: 0n,
		withdrawFee: 0n,
		decimalsScalar: ONE_FIXED,
		normalizedBalance: balance * ONE_FIXED,
		decimals: 9,
		...options,
	};
}

function makePool(
	options: {
		balanceA?: bigint;
		balanceB?: bigint;
		lpCoinSupply?: bigint;
		flatness?: bigint;
		daoFee?: boolean;
		coinA?: Partial<PoolCoin>;
		coinB?: Partial<PoolCoin>;
	} = {}
): PoolObject {
	return {
		objectId: POOL_ID,
		objectType: "0x5::pool::Pool<0x3::af_lp::AF_LP_A_B>",
		name: "A/B",
		creator: WALLET,
		lpCoinType: LP,
		lpCoinSupply: options.lpCoinSupply ?? 1_000_000n,
		illiquidLpCoinSupply: 0n,
		flatness: options.flatness ?? 0n,
		lpCoinDecimals: 9,
		coins: {
			[A]: makeCoin(options.balanceA ?? 1_000_000n, options.coinA),
			[B]: makeCoin(options.balanceB ?? 1_000_000n, options.coinB),
		},
		...(options.daoFee
			? {
					daoFeePoolObject: {
						objectId: "0x6",
						objectType: "0x6::pool::DaoFeePool",
						feeBps: 100n,
						feeRecipient: "0x7",
					},
				}
			: {}),
	};
}

const statsFixture: PoolStats = {
	volume: 123.45,
	tvl: 9876.5,
	supplyPerLps: [0.25, 0.75],
	lpPrice: 1.23,
	fees: 45.6,
	apr: 0.12,
};

function makeAddresses(withDaoFee = true): ConfigAddresses {
	return {
		pools: {
			packages: {
				amm: AMM,
				ammInterface: AMM_INTERFACE,
				events: EVENTS,
				eventsV2: EVENTS_V2,
			},
			objects: {
				poolRegistry: "0x10",
				protocolFeeVault: "0x11",
				treasury: "0x12",
				insuranceFund: "0x13",
				lpCoinsTable: "0x14",
			},
			other: {
				createLpCoinPackageCompilations: {
					9: JSON.stringify({ modules: ["AA=="], dependencies: ["0x2"] }),
				},
			},
		},
		referralVault: {
			packages: { referralVault: REFERRAL_PACKAGE },
			objects: { referralVault: "0x15" },
		},
		...(withDaoFee
			? {
					daoFeePools: {
						packages: { amm: DAO_AMM, events: EVENTS },
						objects: { version: "0x16" },
					},
				}
			: {}),
	} as ConfigAddresses;
}

function makeProvider(
	addresses: ConfigAddresses,
	extra: Record<string, unknown> = {}
): AftermathApi {
	return { addresses, ...extra } as unknown as AftermathApi;
}

interface FakeTx {
	moveCalls: Record<string, unknown>[];
	objects: unknown[];
	pures: unknown[];
	transfers: unknown[];
	publishes: unknown[];
	sender?: string;
	setSender(address: string): void;
	object(id: unknown): unknown;
	pure: ((value: unknown) => unknown) & {
		u64(value: unknown): unknown;
		u128(value: unknown): unknown;
		u16(value: unknown): unknown;
		address(value: unknown): unknown;
		bool(value: unknown): unknown;
	};
	moveCall(options: Record<string, unknown>): unknown;
	transferObjects(objects: unknown, address: unknown): unknown;
	publish(options: unknown): unknown;
}

function fakeTransaction(): FakeTx {
	const tx = {} as FakeTx;
	tx.moveCalls = [];
	tx.objects = [];
	tx.pures = [];
	tx.transfers = [];
	tx.publishes = [];
	tx.setSender = (address) => {
		tx.sender = address;
	};
	tx.object = (id) => {
		const value = { kind: "object", id };
		tx.objects.push(value);
		return value;
	};
	const pure = ((value: unknown) => {
		const result = { kind: "pure", value };
		tx.pures.push(result);
		return result;
	}) as FakeTx["pure"];
	pure.u64 = (value) => pure({ type: "u64", value });
	pure.u128 = (value) => pure({ type: "u128", value });
	pure.u16 = (value) => pure({ type: "u16", value });
	pure.address = (value) => pure({ type: "address", value });
	pure.bool = (value) => pure({ type: "bool", value });
	tx.pure = pure;
	tx.moveCall = (options) => {
		tx.moveCalls.push(options);
		return { kind: "result", index: tx.moveCalls.length - 1 };
	};
	tx.transferObjects = (objects, address) => {
		tx.transfers.push({ objects, address });
		return undefined;
	};
	tx.publish = (options) => {
		tx.publishes.push(options);
		return { kind: "upgrade-cap" };
	};
	return tx;
}

function asTransaction(tx: FakeTx): Transaction {
	return tx as unknown as Transaction;
}

/**
 * The production Casting module imports the public barrel for historical
 * reasons. Mocking that one boundary keeps this focused suite able to load
 * the source modules in both Bun and Jest without changing SDK code.
 */

const TestCasting = {
	Fixed: {
		fixedOneB: ONE_FIXED,
		fixedOneN: Number(ONE_FIXED),
	},
	pools: undefined as unknown,
	percentageToBps: (percentage: number): bigint =>
		BigInt(Math.round(percentage * 10_000)),
	bpsToPercentage: (bps: bigint): number => Number(bps) / 10_000,
	bigIntToFixedNumber: (value: bigint): number =>
		Number(value) / Number(ONE_FIXED),
	numberToFixedBigInt: (value: number): bigint =>
		BigInt(Math.floor(value * Number(ONE_FIXED))),
	u8VectorFromString: (value: string): number[] =>
		Array.from(new TextEncoder().encode(value)),
};

function installCastingModuleMock(): void {
	const factory = () => ({ Casting: TestCasting });
	registerModuleMock("../src/general/utils/casting", factory);
}

beforeAll(async () => {
	installCastingModuleMock();
	const cmmm = await import("../src/packages/pools/utils/cmmmCalculations");
	const casting = await import("../src/packages/pools/api/poolsApiCasting");
	const poolsApi = await import("../src/packages/pools/api/poolsApi");
	const pools = await import("../src/packages/pools/pools");
	const pool = await import("../src/packages/pools/pool");
	CmmmCalculations = cmmm.CmmmCalculations;
	PoolsApiCasting = casting.PoolsApiCasting;
	PoolsApi = poolsApi.PoolsApi;
	Pools = pools.Pools;
	Pool = pool.Pool;
	TestCasting.pools = PoolsApiCasting;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("Pools pure public helpers", () => {
	it("exposes stable protocol constants and fee arithmetic", () => {
		expect(Pools.constants.bounds.maxCoinsInPool).toBe(8);
		expect(Pools.constants.feePercentages.totalProtocol).toBe(0.00005);
		expect(Pools.getAmountWithProtocolFees({ amount: 1_000_000n })).toBe(
			999_950n
		);
		expect(
			Pools.getAmountWithProtocolFees({
				amount: 1_000_000n,
				withReferral: true,
			})
		).toBe(999_951n);
		expect(Pools.getAmountWithProtocolFees({ amount: 0n })).toBe(0n);
		expect(Pools.getAmountWithoutProtocolFees({ amount: 999_950n })).toBe(
			1_000_000n
		);
		expect(
			Pools.getAmountWithoutProtocolFees({
				amount: 999_951n,
				withReferral: true,
			})
		).toBe(999_999n);
	});

	it("normalizes slippage and formats/checks LP coin types", () => {
		expect(Pools.normalizeInvertSlippage(0.01)).toBe(990_000_000_000_000_000n);
		expect(Pools.normalizeInvertSlippage(0)).toBe(ONE_FIXED);
		expect(Pools.normalizeInvertSlippage(0.5)).toBe(500_000_000_000_000_000n);
		expect(Pools.displayLpCoinType("0x1::af_lp::AF_LP_BTC_ETH")).toBe(
			"Btc Eth LP"
		);
		expect(
			Pools.isPossibleLpCoinType({ lpCoinType: "0x1::af_lp::AF_LP_BTC_ETH" })
		).toBe(true);
		expect(Pools.isPossibleLpCoinType({ lpCoinType: "0x2::sui::SUI" })).toBe(
			false
		);
		expect(Pools.isPossibleLpCoinType({ lpCoinType: "0x1::af_lp" })).toBe(
			false
		);
	});
});

describe("Pools HTTP/API boundary", () => {
	const config = { baseUrl: "https://sdk.test/", accessToken: "token" };

	it("fetches one, many, and all pools with exact request contracts", async () => {
		const pool = makePool();
		const signal = new AbortController().signal;

		let calls = installFetch(pool);
		const one = await new Pools(config).getPool({ objectId: POOL_ID }, signal);
		expect(one.pool).toEqual(pool);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/0x5");
		expect(calls[0]?.init?.method).toBeUndefined();
		expect(calls[0]?.init?.signal).toBe(signal);
		expect(calls[0]?.init?.headers).toEqual({
			"Content-Type": "application/json",
			Authorization: "Bearer token",
		});

		calls = installFetch([pool]);
		const many = await new Pools(config).getPools(
			{ objectIds: [POOL_ID, "0x8"] },
			signal
		);
		expect(many.map((item) => item.pool.objectId)).toEqual([POOL_ID]);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools");
		expect(calls[0]?.init?.method).toBe("POST");
		expect(requestBody(calls[0]!)).toEqual({ poolIds: [POOL_ID, "0x8"] });
		expect(calls[0]?.init?.signal).toBe(signal);

		calls = installFetch([pool]);
		const all = await new Pools(config).getAllPools(signal);
		expect(all).toHaveLength(1);
		expect(requestBody(calls[0]!)).toEqual({});
	});

	it("covers pool list, metadata, TVL, stats, and summary endpoints", async () => {
		const pools = new Pools({ baseUrl: "https://sdk.test" });
		const pool = makePool();
		const lpInfo = { lpCoinType: LP, poolId: POOL_ID, balance: 123n };

		let calls = installFetch([lpInfo]);
		expect(await pools.getOwnedLpCoins({ walletAddress: WALLET })).toEqual([
			lpInfo,
		]);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/owned-lp-coins"
		);
		expect(requestBody(calls[0]!)).toEqual({ walletAddress: WALLET });

		calls = installFetch([POOL_ID, undefined]);
		await expect(
			pools.getPoolObjectIdsForLpCoinTypes({ lpCoinTypes: [LP, "0x9::x::X"] })
		).resolves.toEqual([POOL_ID, undefined]);
		expect(requestBody(calls[0]!)).toEqual({
			lpCoinTypes: [LP, "0x9::x::X"],
		});

		calls = installFetch([POOL_ID]);
		await expect(
			pools.getPoolObjectIdForLpCoinType({ lpCoinType: LP })
		).resolves.toEqual([POOL_ID]);
		expect(requestBody(calls[0]!)).toEqual({ lpCoinTypes: [LP] });

		calls = installFetch([undefined]);
		await expect(pools.isLpCoinType({ lpCoinType: LP })).resolves.toBe(false);

		calls = installFetch(123.45);
		await expect(pools.getTotalVolume24hrs()).resolves.toBe(123.45);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/volume-24hrs"
		);
		expect(calls[0]?.init?.signal).toBeUndefined();

		calls = installFetch(99.5);
		await expect(pools.getTVL()).resolves.toBe(99.5);
		expect(requestBody(calls[0]!)).toEqual({});
		calls = installFetch(99.5);
		await pools.getTVL({ poolIds: [POOL_ID] });
		expect(requestBody(calls[0]!)).toEqual({ poolIds: [POOL_ID] });

		calls = installFetch([statsFixture]);
		await expect(
			pools.getPoolsStats({ poolIds: [POOL_ID] }, new AbortController().signal)
		).resolves.toEqual([statsFixture]);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/stats");

		calls = installFetch([{ pool, stats: statsFixture }]);
		await expect(pools.getPoolSummaries()).resolves.toEqual([
			{ pool, stats: statsFixture },
		]);
		expect(requestBody(calls[0]!)).toEqual({});
	});

	it("preserves bigint request serialization and indexer pagination", async () => {
		const pools = new Pools({ baseUrl: "https://sdk.test" });
		const signal = new AbortController().signal;
		const events = [
			{ poolId: POOL_ID, depositor: WALLET, deposits: [9n] },
			{ poolId: POOL_ID, withdrawer: WALLET, withdrawn: [4n] },
		];
		const calls = installFetch(events);
		await expect(
			pools.getInteractionEvents({ walletAddress: WALLET, cursor: 5, limit: 2 })
		).resolves.toEqual({ events, nextCursor: 7 });
		expect(requestBody(calls[0]!)).toEqual({
			walletAddress: WALLET,
			cursor: 5,
			limit: 2,
		});

		const shortCalls = installFetch([events[0]]);
		await expect(
			pools.getInteractionEvents({ walletAddress: WALLET, cursor: 5, limit: 2 })
		).resolves.toEqual({ events: [events[0]], nextCursor: undefined });
		expect(shortCalls[0]?.init?.signal).toBeUndefined();

		const bodyCalls = installFetch([]);
		await pools.getPoolsStats({ poolIds: [POOL_ID] }, signal);
		const rawBody = bodyCalls[0]?.init?.body;
		expect(typeof rawBody).toBe("string");
		expect(String(rawBody)).not.toContain("signal");
	});

	it("classifies HTTP, decode, network, and missing-base-url failures", async () => {
		installFetch({ message: "nope" }, 503, "service unavailable");
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "http", status: 503 });

		installFetch({}, 200, "not-json");
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "decode" });

		installNetworkFailure();
		await expect(
			new Pools({ baseUrl: "https://sdk.test" }).getTotalVolume24hrs()
		).rejects.toMatchObject({ kind: "network" });

		await expect(new Pools().getTotalVolume24hrs()).rejects.toThrow(
			"no apiBaseUrl: unable to fetch data"
		);
	});
});

describe("Pool HTTP, calculations, getters, and delegation", () => {
	it("fetches scoped analytics/events, caches stats, and paginates", async () => {
		const pool = new Pool(makePool(), { baseUrl: "https://sdk.test" });
		let calls = installFetch(statsFixture);
		const returnedStats = await pool.getStats();
		expect(returnedStats).toEqual(statsFixture);
		expect(pool.stats).toBe(returnedStats);
		expect(requestUrl(calls[0]!)).toBe("https://sdk.test/api/pools/0x5/stats");

		const points = [{ time: 1_700_000_000_000, value: 12.5 }];
		calls = installFetch(points);
		await expect(pool.getVolumeData({ timeframe: "1D" })).resolves.toEqual(
			points
		);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/volume/1D"
		);

		calls = installFetch(points);
		await expect(pool.getFeeData({ timeframe: "1M" })).resolves.toEqual(points);
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/fees/1M"
		);

		calls = installFetch(12.5);
		await expect(pool.getVolume24hrs()).resolves.toBe(12.5);

		const event = { poolId: POOL_ID, depositor: WALLET, lpMinted: 5n };
		calls = installFetch([event, event]);
		await expect(
			pool.getInteractionEvents({ walletAddress: WALLET, cursor: 2, limit: 2 })
		).resolves.toEqual({ events: [event, event], nextCursor: 4 });
		expect(requestUrl(calls[0]!)).toBe(
			"https://sdk.test/api/pools/0x5/interaction-events-by-user"
		);
	});

	it("returns sorted coin views and DAO metadata", () => {
		const noDaoPool = new Pool(makePool());
		expect(noDaoPool.coins()).toEqual([A, B]);
		expect(noDaoPool.poolCoins().map((coin) => coin.balance)).toEqual([
			1_000_000n,
			1_000_000n,
		]);
		expect(noDaoPool.poolCoinEntries().map(([type]) => type)).toEqual([A, B]);
		expect(noDaoPool.daoFeePercentage()).toBeUndefined();
		expect(noDaoPool.daoFeeRecipient()).toBeUndefined();

		const daoPool = new Pool(makePool({ daoFee: true }));
		expect(daoPool.daoFeePercentage()).toBe(0.01);
		expect(daoPool.daoFeeRecipient()).toBe("0x7");
		daoPool.setStats(statsFixture);
		expect(daoPool.stats).toBe(statsFixture);
	});

	it("applies decimal scaling and guards unsafe trade sizes", () => {
		const pool = new Pool(
			makePool({
				coinA: { tradeFeeIn: 10_000_000_000_000_000n },
			})
		);
		expect(pool.getSpotPrice({ coinInType: A, coinOutType: B })).toBeCloseTo(
			1,
			12
		);
		expect(
			pool.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 10_000n,
				coinOutType: B,
			})
		).toBeGreaterThan(0n);
		expect(
			pool.getTradeAmountIn({
				coinInType: A,
				coinOutAmount: 10_000n,
				coinOutType: B,
			})
		).toBeGreaterThan(0n);

		expect(() =>
			pool.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 300_000n,
				coinOutType: B,
			})
		).toThrow("coinInAmountWithFees / coinInPoolBalance");
		expect(() =>
			pool.getTradeAmountIn({
				coinInType: A,
				coinOutAmount: 300_000n,
				coinOutType: B,
			})
		).toThrow("coinOutAmount / coinOutPoolBalance");

		const disabled = new Pool(makePool({ coinA: { tradeFeeIn: ONE_FIXED } }));
		expect(() =>
			disabled.getTradeAmountOut({
				coinInType: A,
				coinInAmount: 1n,
				coinOutType: B,
			})
		).toThrow("coinOutAmount <= 0");
	});

	it("calculates withdrawals, LP ratios, and DAO-fee floors", () => {
		const pool = new Pool(makePool({ daoFee: true }));
		expect(pool.getAllCoinWithdrawLpRatio({ lpCoinAmountIn: 100_000n })).toBe(
			0.1
		);
		expect(pool.getMultiCoinWithdrawLpRatio({ lpCoinAmountIn: 100_000n })).toBe(
			0.9
		);
		expect(pool.getAllCoinWithdrawAmountsOut({ lpRatio: 0.1 })).toEqual({
			[A]: 99_000n,
			[B]: 99_000n,
		});
		expect(() => pool.getAllCoinWithdrawAmountsOut({ lpRatio: 1 })).toThrow(
			"lpRatio >= 1"
		);

		const paddedA = `0x${"0".repeat(63)}1` as CoinType;
		const paddedB = `0x${"0".repeat(63)}2` as CoinType;
		const paddedPool = makePool({ daoFee: true });
		paddedPool.coins = {
			[paddedA]: paddedPool.coins[A]!,
			[paddedB]: paddedPool.coins[B]!,
		};
		const padded = new Pool(paddedPool);
		const simple = padded.getWithdrawAmountsOutSimple({
			lpCoinAmountIn: 10_000n,
			coinTypesOut: [paddedA],
		});
		expect(simple[paddedA]).toBeGreaterThan(0n);
		expect(Object.keys(simple)).toEqual([paddedA, paddedB]);

		const deposit = pool.getDepositLpAmountOut({
			amountsIn: { [A]: 10_000n, [B]: 10_000n },
		});
		expect(deposit.lpRatio).toBeGreaterThan(0);
		expect(deposit.lpRatio).toBeLessThan(1);
		expect(deposit.lpAmountOut).toBeGreaterThan(0n);
	});

	it("delegates transaction requests with the Pool instance and preserves errors", async () => {
		const calls: Array<{ method: string; input: Record<string, unknown> }> = [];
		const mockPoolsApi = {
			fetchBuildDepositTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "deposit", input });
				return "deposit-tx";
			},
			fetchBuildWithdrawTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "withdraw", input });
				return "withdraw-tx";
			},
			fetchBuildAllCoinWithdrawTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "all", input });
				return "all-tx";
			},
			fetchBuildTradeTx: async (input: Record<string, unknown>) => {
				calls.push({ method: "trade", input });
				return "trade-tx";
			},
			buildDaoFeePoolUpdateFeeBpsTx: (input: Record<string, unknown>) => {
				calls.push({ method: "fee-bps", input });
				return "fee-bps-tx";
			},
			buildDaoFeePoolUpdateFeeRecipientTx: (input: Record<string, unknown>) => {
				calls.push({ method: "fee-recipient", input });
				return "fee-recipient-tx";
			},
		};
		const provider = makeProvider(makeAddresses(), {
			Pools: () => mockPoolsApi,
		});
		const pool = new Pool(makePool({ daoFee: true }), {}, provider);

		await pool.getDepositTransaction({
			walletAddress: WALLET,
			amountsIn: { [A]: 1n },
			slippage: 0.01,
		});
		await pool.getWithdrawTransaction({
			walletAddress: WALLET,
			amountsOutDirection: { [A]: 1n },
			lpCoinAmount: 2n,
			slippage: 0.02,
		});
		await pool.getAllCoinWithdrawTransaction({
			walletAddress: WALLET,
			lpCoinAmount: 3n,
		});
		await pool.getTradeTransaction({
			walletAddress: WALLET,
			coinInType: A,
			coinInAmount: 4n,
			coinOutType: B,
			slippage: 0.03,
			referrer: "0x8",
		});
		await pool.getUpdateDaoFeeTransaction({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x9",
			newFeePercentage: 0.01,
		});
		await pool.getUpdateDaoFeeRecipientTransaction({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x9",
			newFeeRecipient: "0x8",
		});

		expect(calls.map(({ method }) => method)).toEqual([
			"deposit",
			"withdraw",
			"all",
			"trade",
			"fee-bps",
			"fee-recipient",
		]);
		expect(calls[0]?.input.pool).toBe(pool);
		expect(calls[4]?.input).toMatchObject({
			daoFeePoolId: "0x6",
			lpCoinType: LP,
			newFeeBps: 100n,
		});
		expect(calls[5]?.input.newFeeRecipient).toBe(`0x${"0".repeat(63)}8`);

		const missingApi = new Pool(makePool());
		await expect(
			missingApi.getTradeTransaction({
				walletAddress: WALLET,
				coinInType: A,
				coinInAmount: 1n,
				coinOutType: B,
				slippage: 0.01,
			})
		).rejects.toThrow("missing AftermathApi instance");
		await expect(
			new Pool(makePool()).getUpdateDaoFeeTransaction({
				walletAddress: WALLET,
				daoFeePoolOwnerCapId: "0x9",
				newFeePercentage: 0.01,
			})
		).rejects.toThrow("this pool has no DAO fee");
	});
});

describe("PoolsApi transaction commands and provider boundary", () => {
	it("constructs regular move calls with type arguments, objects, and fixed values", () => {
		const api = new PoolsApi(makeProvider(makeAddresses()));
		const tx = fakeTransaction();

		api.tradeTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinInId: "0x20",
			coinInType: A,
			expectedCoinOutAmount: 321n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
			withTransfer: true,
		});
		api.multiCoinDepositTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinIds: ["0x21", "0x22"],
			coinTypes: [A, B],
			expectedLpRatio: 123n,
			lpCoinType: LP,
			slippage: 0.02,
		});
		api.multiCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x23",
			lpCoinType: LP,
			expectedAmountsOut: [7n, 8n],
			coinTypes: [A, B],
			slippage: 0.03,
		});
		api.allCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x24",
			lpCoinType: LP,
			coinTypes: [A, B],
			withTransfer: true,
		});

		expect(tx.moveCalls.map((call) => call.target)).toEqual([
			`${AMM_INTERFACE}::amm_interface::swap_exact_in`,
			`${AMM}::deposit::deposit_2_coins`,
			`${AMM}::withdraw::withdraw_2_coins`,
			`${AMM_INTERFACE}::amm_interface::all_coin_withdraw_2_coins`,
		]);
		expect(tx.moveCalls[0]?.typeArguments).toEqual([LP, A, B]);
		expect(tx.pures).toContainEqual({
			kind: "pure",
			value: { type: "u64", value: 990_000_000_000_000_000n },
		});
		expect(tx.moveCalls[2]?.arguments).toHaveLength(9);
	});

	it("constructs publishing, pool creation, registry, and DAO-fee commands", () => {
		const addresses = makeAddresses();
		const api = new PoolsApi(makeProvider(addresses));
		const publishTx = fakeTransaction();
		const upgradeCap = api.publishLpCoinTx({
			tx: asTransaction(publishTx),
			lpCoinDecimals: 9,
		});
		expect(upgradeCap).toEqual({ kind: "upgrade-cap" });
		expect(publishTx.publishes).toEqual([
			{ modules: [[0]], dependencies: [`0x${"0".repeat(63)}2`] },
		]);
		const addressesWithoutCompilations = makeAddresses();
		delete addressesWithoutCompilations.pools?.other;
		const apiWithoutCompilations = new PoolsApi(
			makeProvider(addressesWithoutCompilations)
		);
		expect(() =>
			apiWithoutCompilations.publishLpCoinTx({
				tx: asTransaction(fakeTransaction()),
				lpCoinDecimals: 8,
			})
		).toThrow("requires package compilations");

		const createTx = fakeTransaction();
		api.createPoolTx({
			tx: asTransaction(createTx),
			lpCoinType: LP,
			coinsInfo: [
				{
					coinId: "0x30",
					coinType: A,
					weight: 500_000_000_000_000_000n,
					decimals: 9,
					tradeFeeIn: 1n,
					tradeFeeOut: 2n,
					depositFee: 3n,
					withdrawFee: 4n,
				},
			],
			lpCoinMetadata: { name: "Pool LP", symbol: "plp" },
			lpCoinIconUrl: "https://sdk.test/icon.svg",
			createPoolCapId: "0x31",
			poolName: "My Pool",
			poolFlatness: 0n,
			lpCoinDescription: "description",
			respectDecimals: true,
			forceLpDecimals: 9,
		});
		expect(createTx.moveCalls[0]).toMatchObject({
			target: `${AMM}::pool_factory::create_pool_1_coins`,
			typeArguments: [LP, A],
		});
		expect(createTx.moveCalls[0]?.arguments).toHaveLength(17);

		const registryTx = fakeTransaction();
		api.poolObjectIdForLpCoinTypeTx({
			tx: asTransaction(registryTx),
			lpCoinType: LP,
		});
		expect(registryTx.moveCalls[0]).toMatchObject({
			target: `${AMM}::pool_registry::lp_type_to_pool_id`,
			typeArguments: [LP],
		});

		const daoTx = fakeTransaction();
		api.daoFeePoolNewTx({
			tx: asTransaction(daoTx),
			poolId: POOL_ID,
			feeBps: 100n,
			feeRecipient: WALLET,
			lpCoinType: LP,
		});
		api.daoFeePoolUpdateFeeBpsTx({
			tx: asTransaction(daoTx),
			daoFeePoolOwnerCapId: "0x32",
			daoFeePoolId: "0x33",
			newFeeBps: 250n,
			lpCoinType: LP,
		});
		api.daoFeePoolUpdateFeeRecipientTx({
			tx: asTransaction(daoTx),
			daoFeePoolOwnerCapId: "0x32",
			daoFeePoolId: "0x33",
			newFeeRecipient: WALLET,
			lpCoinType: LP,
		});
		expect(daoTx.moveCalls.map((call) => call.target)).toEqual([
			`${DAO_AMM}::pool::new`,
			`${DAO_AMM}::pool::update_fee_bps`,
			`${DAO_AMM}::pool::update_fee_recipient`,
		]);

		const noDaoApi = new PoolsApi(makeProvider(makeAddresses(false)));
		expect(() =>
			noDaoApi.daoFeePoolNewTx({
				tx: asTransaction(fakeTransaction()),
				poolId: POOL_ID,
				feeBps: 1n,
				feeRecipient: WALLET,
				lpCoinType: LP,
			})
		).toThrow("dao fee pool addresses have not been set");
	});

	it("covers transfer target branches and DAO-fee pool command variants", () => {
		const api = new PoolsApi(makeProvider(makeAddresses()));
		const tx = fakeTransaction();

		api.tradeTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinInId: "0x50",
			coinInType: A,
			expectedCoinOutAmount: 10n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.multiCoinDepositTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			coinIds: ["0x51", "0x52"],
			coinTypes: [A, B],
			expectedLpRatio: 11n,
			lpCoinType: LP,
			slippage: 0.01,
			withTransfer: true,
		});
		api.multiCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x53",
			lpCoinType: LP,
			expectedAmountsOut: [12n, 13n],
			coinTypes: [A, B],
			slippage: 0.01,
			withTransfer: true,
		});
		api.allCoinWithdrawTx({
			tx: asTransaction(tx),
			poolId: POOL_ID,
			lpCoinId: "0x54",
			lpCoinType: LP,
			coinTypes: [A, B],
		});

		api.daoFeePoolTradeTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x55",
			coinInId: "0x56",
			coinInType: A,
			expectedCoinOutAmount: 14n,
			coinOutType: B,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.daoFeePoolMultiCoinDepositTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x57",
			coinIds: ["0x58", "0x59"],
			coinTypes: [A, B],
			expectedLpRatio: 15n,
			lpCoinType: LP,
			slippage: 0.01,
		});
		api.daoFeePoolAllCoinWithdrawTx({
			tx: asTransaction(tx),
			daoFeePoolId: "0x5a",
			lpCoinId: "0x5b",
			lpCoinType: LP,
			coinTypes: [A, B],
		});

		expect(tx.moveCalls.map((call) => call.target)).toEqual([
			`${AMM}::swap::swap_exact_in`,
			`${AMM_INTERFACE}::amm_interface::deposit_2_coins`,
			`${AMM_INTERFACE}::amm_interface::withdraw_2_coins`,
			`${AMM}::withdraw::all_coin_withdraw_2_coins`,
			`${DAO_AMM}::swap::swap_exact_in`,
			`${DAO_AMM}::deposit::deposit_2_coins`,
			`${DAO_AMM}::withdraw::all_coin_withdraw_2_coins`,
		]);
		expect(tx.moveCalls[4]?.arguments).toHaveLength(10);
		expect(tx.moveCalls[5]?.arguments).toHaveLength(11);
		expect(tx.moveCalls[6]?.arguments).toHaveLength(8);

		const noDaoApi = new PoolsApi(makeProvider(makeAddresses(false)));
		expect(() =>
			noDaoApi.daoFeePoolTradeTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				coinInId: "0x5c",
				coinInType: A,
				expectedCoinOutAmount: 1n,
				coinOutType: B,
				lpCoinType: LP,
				slippage: 0.01,
			})
		).toThrow("dao fee pool addresses have not been set");
		expect(() =>
			noDaoApi.daoFeePoolMultiCoinDepositTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				coinIds: ["0x5d", "0x5e"],
				coinTypes: [A, B],
				expectedLpRatio: 1n,
				lpCoinType: LP,
				slippage: 0.01,
			})
		).toThrow("dao fee pool addresses have not been set");
		expect(() =>
			noDaoApi.daoFeePoolAllCoinWithdrawTx({
				tx: asTransaction(fakeTransaction()),
				daoFeePoolId: POOL_ID,
				lpCoinId: "0x5f",
				lpCoinType: LP,
				coinTypes: [A, B],
			})
		).toThrow("dao fee pool addresses have not been set");
	});

	it("exposes normalized object/event types, Move errors, and owned-cap casting", async () => {
		const addresses = makeAddresses();
		const ownedCalls: Record<string, unknown>[] = [];
		const cap: DaoFeePoolOwnerCapObject = {
			objectId: "0x40",
			objectType: `${EVENTS}::pool::OwnerCap`,
			daoFeePoolId: "0x41",
		};
		const api = new PoolsApi(
			makeProvider(addresses, {
				Objects: () => ({
					fetchCastObjectsOwnedByAddressOfType: (
						input: Record<string, unknown>
					) => {
						ownedCalls.push(input);
						return Promise.resolve([cap]);
					},
				}),
			})
		);
		await expect(
			api.fetchOwnedDaoFeePoolOwnerCaps({ walletAddress: WALLET })
		).resolves.toEqual([cap]);
		expect(ownedCalls[0]).toMatchObject({
			walletAddress: WALLET,
			objectType: `${EVENTS}::pool::OwnerCap`,
		});
		expect(api.objectTypes.pool).toBe(`${EVENTS}::pool::Pool`);
		expect(api.eventTypes.trade).toBe(`${EVENTS}::events::SwapEvent`);
		expect(api.eventTypes.tradeV2).toBe(`${EVENTS_V2}::events::SwapEventV2`);
		expect(api.moveErrors[AMM]?.pool?.[3]).toBe("Invalid Weight");
		expect(api.moveErrors[DAO_AMM]?.version?.[1]).toBe(
			"Version Object Already Created"
		);

		const noDaoApi = new PoolsApi(
			makeProvider(makeAddresses(false), { Objects: () => ({}) })
		);
		expect(() =>
			noDaoApi.fetchOwnedDaoFeePoolOwnerCaps({ walletAddress: WALLET })
		).toThrow("dao fee pool addresses have not been set");
	});

	it("builds high-level transactions through mocked Coin and referral providers", async () => {
		const referralCalls: unknown[] = [];
		let coinSequence = 0;
		const api = new PoolsApi(
			makeProvider(makeAddresses(), {
				ReferralVault: () => ({
					updateReferrerTx: (input: unknown) => referralCalls.push(input),
				}),
				Coin: () => ({
					fetchCoinWithAmountTx: async () => ({
						kind: "coin",
						id: `coin-${++coinSequence}`,
					}),
					fetchCoinsWithAmountTx: async (input: { coinTypes: CoinType[] }) =>
						input.coinTypes.map((coinType) => ({
							kind: "coin",
							coinType,
							id: `coin-${++coinSequence}`,
						})),
				}),
			})
		);
		const regularPool = new Pool(makePool());
		const daoPool = new Pool(makePool({ daoFee: true }));

		const builtTrade = (await api.fetchBuildTradeTx({
			walletAddress: WALLET,
			pool: regularPool,
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
			referrer: "0x8",
			isSponsoredTx: true,
		})) as unknown as FakeTx;
		expect(builtTrade.sender).toBe(WALLET);
		expect(builtTrade.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::swap_exact_in`
		);
		expect(builtTrade.transfers).toHaveLength(0);
		expect(referralCalls).toHaveLength(1);

		const builtDaoTrade = (await api.fetchBuildTradeTx({
			walletAddress: WALLET,
			pool: daoPool,
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoTrade.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::swap::swap_exact_in`
		);
		expect(builtDaoTrade.transfers).toHaveLength(1);

		const addTradeTx = fakeTransaction();
		api.fetchAddTradeTx({
			tx: asTransaction(addTradeTx),
			coinInId: "0x60",
			coinInType: A,
			coinInAmount: 100n,
			coinOutType: B,
			slippage: 0.01,
			pool: regularPool,
		});
		expect(addTradeTx.moveCalls[0]?.target).toBe(`${AMM}::swap::swap_exact_in`);

		const builtDeposit = (await api.fetchBuildDepositTx({
			walletAddress: WALLET,
			pool: regularPool,
			amountsIn: { [A]: 100n, [B]: 100n },
			slippage: 0.01,
			referrer: "0x8",
			isSponsoredTx: true,
		})) as unknown as FakeTx;
		expect(builtDeposit.sender).toBe(WALLET);
		expect(builtDeposit.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::deposit_2_coins`
		);

		const builtDaoDeposit = (await api.fetchBuildDepositTx({
			walletAddress: WALLET,
			pool: daoPool,
			amountsIn: { [A]: 100n, [B]: 100n },
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoDeposit.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::deposit::deposit_2_coins`
		);

		const builtWithdraw = (await api.fetchBuildWithdrawTx({
			walletAddress: WALLET,
			pool: regularPool,
			amountsOutDirection: { [A]: 100n, [B]: 100n },
			lpCoinAmount: 100n,
			slippage: 0.01,
			referrer: "0x8",
		})) as unknown as FakeTx;
		expect(builtWithdraw.sender).toBe(WALLET);
		expect(builtWithdraw.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::withdraw_2_coins`
		);

		const builtDaoWithdraw = (await api.fetchBuildWithdrawTx({
			walletAddress: WALLET,
			pool: daoPool,
			amountsOutDirection: { [A]: 100n, [B]: 100n },
			lpCoinAmount: 100n,
			slippage: 0.01,
		})) as unknown as FakeTx;
		expect(builtDaoWithdraw.sender).toBe(WALLET);
		expect(builtDaoWithdraw.moveCalls).toHaveLength(0);

		const builtAllWithdraw = (await api.fetchBuildAllCoinWithdrawTx({
			walletAddress: WALLET,
			pool: regularPool,
			lpCoinAmount: 100n,
			referrer: "0x8",
		})) as unknown as FakeTx;
		expect(builtAllWithdraw.moveCalls[0]?.target).toBe(
			`${AMM_INTERFACE}::amm_interface::all_coin_withdraw_2_coins`
		);

		const published = api.buildPublishLpCoinTx({
			walletAddress: WALLET,
			lpCoinDecimals: 9,
		}) as unknown as FakeTx;
		expect(published.sender).toBe(WALLET);
		expect(published.publishes).toHaveLength(1);
		expect(published.transfers).toHaveLength(1);

		const feeBps = api.buildDaoFeePoolUpdateFeeBpsTx({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x61",
			daoFeePoolId: "0x62",
			newFeeBps: 99n,
			lpCoinType: LP,
		}) as unknown as FakeTx;
		const feeRecipient = api.buildDaoFeePoolUpdateFeeRecipientTx({
			walletAddress: WALLET,
			daoFeePoolOwnerCapId: "0x63",
			daoFeePoolId: "0x64",
			newFeeRecipient: "0x65",
			lpCoinType: LP,
		}) as unknown as FakeTx;
		expect(feeBps.sender).toBe(WALLET);
		expect(feeRecipient.sender).toBe(WALLET);
		expect(feeBps.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::pool::update_fee_bps`
		);
		expect(feeRecipient.moveCalls[0]?.target).toBe(
			`${DAO_AMM}::pool::update_fee_recipient`
		);
	});
});

describe("PoolsApiCasting", () => {
	function event<Fields>(parsedJson: Fields): EventOnChain<Fields> {
		return {
			id: { txDigest: "digest", eventSeq: "0" },
			packageId: EVENTS,
			transactionModule: "events",
			sender: WALLET,
			type: `${EVENTS}::events::Event`,
			parsedJson,
			bcs: "",
			timestampMs: "1700000000000",
		};
	}

	it("casts a gRPC-shaped pool without losing bigint precision or decimals", () => {
		const view = {
			objectId: POOL_ID,
			type: `${AMM}::pool::Pool<${LP.slice(2)}>`,
			json: {
				coin_decimals: "AQI=",
				creator: WALLET,
				decimal_scalars: [ONE_FIXED.toString(), ONE_FIXED.toString()],
				fees_deposit: ["0", "0"],
				fees_swap_in: ["1", "2"],
				fees_swap_out: ["3", "4"],
				fees_withdraw: ["5", "6"],
				flatness: "0",
				id: POOL_ID,
				illiquid_lp_supply: "7",
				lp_decimals: 9,
				lp_supply: { value: "9007199254740993" },
				name: "casted",
				normalized_balances: ["1000000000000000000", "2000000000000000000"],
				type_names: ["1::coin::A", "2::coin::B"],
				weights: ["500000000000000000", "500000000000000000"],
			},
		} as unknown as SuiObjectView;
		const result = PoolsApiCasting.poolObjectFromSuiObject(view);
		expect(result.lpCoinType).toBe(`0x${"0".repeat(63)}3::af_lp::AF_LP_A_B`);
		expect(result.lpCoinSupply).toBe(9007199254740993n);
		expect(result.illiquidLpCoinSupply).toBe(7n);
		expect(Object.values(result.coins).map((coin) => coin.decimals)).toEqual([
			1, 2,
		]);
		expect(Object.values(result.coins).map((coin) => coin.balance)).toEqual([
			1n,
			2n,
		]);
		expect(Object.values(result.coins)[0]?.normalizedBalance).toBe(
			1_000_000_000_000_000_000n
		);
	});

	it("casts owner caps and all pool event variants, including large amounts", () => {
		const cap = PoolsApiCasting.daoFeePoolOwnerCapObjectFromSuiObjectResponse({
			objectId: "0x42",
			type: `${EVENTS}::pool::OwnerCap`,
			json: { dao_fee_pool_id: "0x43" },
		} as unknown as SuiObjectView);
		expect(cap).toEqual({
			objectId: `0x${"0".repeat(62)}42`,
			objectType: `${EVENTS}::pool::OwnerCap`,
			daoFeePoolId: `0x${"0".repeat(62)}43`,
		});

		const trade = PoolsApiCasting.poolTradeEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types_in: ["1::coin::A"],
				amounts_in: ["18446744073709551615"],
				types_out: ["2::coin::B"],
				amounts_out: ["9"],
			}) as never
		);
		expect(trade).toMatchObject({
			poolId: POOL_ID,
			trader: WALLET,
			amountsIn: [18_446_744_073_709_551_615n],
			amountsOut: [9n],
			timestamp: 1_700_000_000_000,
			txnDigest: "digest",
		});
		expect(trade.typesIn[0]).toBe(`0x${"0".repeat(63)}1::coin::A`);

		const deposit = PoolsApiCasting.poolDepositEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types: ["1::coin::A"],
				deposits: ["10"],
				lp_coins_minted: "11",
			}) as never
		);
		expect(deposit).toMatchObject({
			poolId: POOL_ID,
			depositor: WALLET,
			deposits: [10n],
			lpMinted: 11n,
		});

		const withdraw = PoolsApiCasting.poolWithdrawEventFromOnChain(
			event({
				pool_id: POOL_ID,
				issuer: WALLET,
				types: ["2::coin::B"],
				withdrawn: ["12"],
				lp_coins_burned: "13",
			}) as never
		);
		expect(withdraw).toMatchObject({
			poolId: POOL_ID,
			withdrawer: WALLET,
			withdrawn: [12n],
			lpBurned: 13n,
		});
		const created = PoolsApiCasting.poolObjectIdfromPoolCreateEventOnChain(
			event({ pool_id: POOL_ID }) as never
		);
		expect(created).toBe(POOL_ID);
	});

	it("keeps the current undefined timestamp edge explicit", () => {
		const input = event({
			pool_id: POOL_ID,
			issuer: WALLET,
			types_in: [],
			amounts_in: [],
			types_out: [],
			amounts_out: [],
		});
		input.timestampMs = undefined;
		const result = PoolsApiCasting.poolTradeEventFromOnChain(input);
		expect(Number.isNaN(result.timestamp)).toBe(true);
	});
});

describe("CmmmCalculations", () => {
	it("computes invariant primitives and spot prices from literal fixed inputs", () => {
		const pool = makePool({ balanceA: 1n, balanceB: 1n });
		expect(CmmmCalculations.calcInvariantQuadratic(4, 4, 0)).toBe(4);
		expect(CmmmCalculations.calcInvariantQuadratic(4, 4, 1)).toBe(4);
		expect(CmmmCalculations.calcInvariant(pool)).toBeCloseTo(1, 12);
		expect(CmmmCalculations.calcInvariantComponents(pool, A)).toEqual([
			1, 1, 1, 0.5, 1,
		]);
		expect(CmmmCalculations.calcSpotPrice(pool, A, B)).toBeCloseTo(1, 12);
		const feePool = makePool({
			balanceA: 1n,
			balanceB: 1n,
			coinA: { tradeFeeIn: 10_000_000_000_000_000n },
		});
		expect(CmmmCalculations.calcSpotPriceWithFees(feePool, A, B)).toBeCloseTo(
			1.0101010101010102,
			12
		);
		expect(
			CmmmCalculations.calcSpotPriceWithFees(feePool, A, B, true)
		).toBeCloseTo(1, 12);
	});

	it("calculates one-dimensional swaps and rejects disabled/same-coin paths", () => {
		const pool = makePool({ balanceA: 1_000_000n, balanceB: 1_000_000n });
		const amountOut = CmmmCalculations.calcOutGivenIn(pool, A, B, 100_000n);
		expect(amountOut).toBe(90_909n);
		const inversePool = makePool({
			balanceA: 1_000_000n,
			balanceB: 1_000_000n,
			coinA: { tradeFeeIn: 10_000_000_000_000_000n },
		});
		const amountIn = CmmmCalculations.calcInGivenOut(
			inversePool,
			A,
			B,
			10_000n
		);
		expect(amountIn).toBeGreaterThan(0n);
		expect(() => CmmmCalculations.calcOutGivenIn(pool, A, A, 1n)).toThrow(
			"in and out must be different coins"
		);
		expect(() => CmmmCalculations.calcInGivenOut(pool, A, A, 1n)).toThrow(
			"in and out must be different coins"
		);
		const disabled = makePool({ coinA: { tradeFeeIn: ONE_FIXED } });
		expect(CmmmCalculations.calcOutGivenIn(disabled, A, B, 1n)).toBe(0n);
		expect(() => CmmmCalculations.calcInGivenOut(disabled, A, B, 1n)).toThrow(
			"this swap is disabled"
		);
		expect(CmmmCalculations.calcInGivenOut(disabled, A, B, 0n)).toBe(0n);
	});

	it("covers vector swaps, deposits, withdrawals, and direct all-coin helpers", () => {
		const pool = makePool({ balanceA: 1_000_000n, balanceB: 1_000_000n });
		const fixedIn = CmmmCalculations.calcSwapFixedIn(
			pool,
			{ [A]: 100_000n },
			{ [B]: 90_909n }
		);
		expect(fixedIn).toBeGreaterThan(0n);
		const fixedOut = CmmmCalculations.calcSwapFixedOut(
			pool,
			{ [A]: 100_000n },
			{ [B]: 90_000n }
		);
		expect(fixedOut).toBeGreaterThan(0n);

		const deposit = CmmmCalculations.calcDepositFixedAmounts(pool, {
			[A]: 100_000n,
			[B]: 100_000n,
		});
		expect(deposit).toBeGreaterThan(0n);
		expect(deposit).toBeLessThan(ONE_FIXED);
		const withdrawn = CmmmCalculations.calcWithdrawFlpAmountsOut(
			pool,
			{ [A]: 100_000n, [B]: 100_000n },
			0.9
		);
		expect(withdrawn[A]).toBeGreaterThan(0n);
		expect(withdrawn[B]).toBeGreaterThan(0n);

		const allDeposit = CmmmCalculations.calcAllCoinDeposit(pool, {
			[A]: 100_000n,
			[B]: 100_000n,
		});
		expect(allDeposit).toEqual({ [A]: 10_000n, [B]: 10_000n });
		const allWithdraw = CmmmCalculations.calcAllCoinWithdraw(pool, {
			[A]: 100_000n,
			[B]: 200_000n,
		});
		expect(allWithdraw).toEqual({ [A]: 20_000n, [B]: 40_000n });
	});

	it("covers validity checks and spot-based estimates", () => {
		const pool = makePool({ balanceA: 1_000_000n, balanceB: 1_000_000n });
		expect(CmmmCalculations.checkValidSwap(pool, {}, 1, {}, 1)).toBe(true);
		expect(
			CmmmCalculations.checkValidSwap(pool, { [A]: 1n }, 1, { [A]: 1n }, 1)
		).toBe(false);
		expect(
			CmmmCalculations.checkValidSwap(
				pool,
				{ [A]: 100_000n },
				1,
				{ [B]: 90_909n },
				1
			)
		).toBe(true);
		expect(CmmmCalculations.checkValid1dSwap(pool, A, B, 0n, 0n)).toBe(true);
		expect(CmmmCalculations.checkValid1dSwap(pool, A, A, 0n, 0n)).toBe(false);
		expect(CmmmCalculations.checkValidDeposit(pool, {}, ONE_FIXED)).toBe(true);
		expect(CmmmCalculations.checkValidDeposit(pool, {}, ONE_FIXED * 2n)).toBe(
			false
		);
		expect(CmmmCalculations.checkValidWithdraw(pool, {}, 1)).toBe(true);
		expect(CmmmCalculations.checkValidWithdraw(pool, {}, 1.01)).toBe(false);

		expect(CmmmCalculations.getEstimateOutGivenIn(pool, A, B, 100n)).toBe(100n);
		expect(CmmmCalculations.getEstimateInGivenOut(pool, A, B, 100n)).toBe(100n);
		expect(
			CmmmCalculations.getEstimateSwapFixedIn(
				pool,
				{ [A]: 100n },
				{ [B]: 100n }
			)
		).toBeCloseTo(1, 12);
		expect(
			CmmmCalculations.getEstimateSwapFixedOut(
				pool,
				{ [A]: 100n },
				{ [B]: 100n }
			)
		).toBeCloseTo(1, 12);
		expect(
			CmmmCalculations.getEstimateDepositFixedAmounts(pool, {
				[A]: 100n,
				[B]: 100n,
			})
		).toBeCloseTo(0.99990001, 6);
		expect(
			CmmmCalculations.getEstimateWithdrawFlpAmountsOut(
				pool,
				{ [A]: 100n, [B]: 100n },
				0.5
			)
		).toBeCloseTo(0.499950005, 6);
	});

	it("rejects invalid vector swaps and impossible withdrawals", () => {
		const pool = makePool({ balanceA: 1_000n, balanceB: 1_000n });
		expect(() =>
			CmmmCalculations.calcSwapFixedIn(pool, {}, { [B]: 2_000n })
		).toThrow();
		expect(() =>
			CmmmCalculations.calcWithdrawFlpAmountsOut(
				pool,
				{ [A]: 2_000n, [B]: 0n },
				0.5
			)
		).toThrow();
		expect(
			CmmmCalculations.checkValidWithdraw(pool, { [A]: 2_000n }, 0.5)
		).toBe(false);
	});
});

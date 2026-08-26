import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import type { Transaction } from "@mysten/sui/transactions";

import type { AftermathApi } from "@sdk/general/providers";

import type { EventOnChain } from "@sdk/general/types/castingTypes";

import type { SuiObjectView } from "@sdk/general/utils/grpcCasting";

import type {
	CoinType,
	ConfigAddresses,
	DaoFeePoolOwnerCapObject,
	PoolCoin,
	PoolObject,
	PoolStats,
} from "@sdk/types";

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

type CmmmModule = typeof import("@sdk/packages/pools/utils/cmmmCalculations");

type PoolsApiCastingModule =
	typeof import("@sdk/packages/pools/api/poolsApiCasting");

type PoolsApiModule = typeof import("@sdk/packages/pools/api/poolsApi");

type PoolModule = typeof import("@sdk/packages/pools/pool");

type PoolsModule = typeof import("@sdk/packages/pools/pools");

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
	registerModuleMock("@sdk/general/utils/casting", factory);
}

beforeAll(async () => {
	installCastingModuleMock();
	const cmmm = await import("@sdk/packages/pools/utils/cmmmCalculations");
	const casting = await import("@sdk/packages/pools/api/poolsApiCasting");
	const poolsApi = await import("@sdk/packages/pools/api/poolsApi");
	const pools = await import("@sdk/packages/pools/pools");
	const pool = await import("@sdk/packages/pools/pool");
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

export {
	A,
	AMM,
	AMM_INTERFACE,
	B,
	CmmmCalculations,
	DAO_AMM,
	EVENTS,
	EVENTS_V2,
	HEX_ADDRESS_REGEX,
	HEX_PREFIX_REGEX,
	LP,
	ONE_FIXED,
	POOL_ID,
	Pool,
	Pools,
	PoolsApi,
	PoolsApiCasting,
	REFERRAL_PACKAGE,
	TestCasting,
	WALLET,
	afterEach,
	asTransaction,
	beforeAll,
	describe,
	expect,
	fakeTransaction,
	installCastingModuleMock,
	installFetch,
	installNetworkFailure,
	it,
	jest,
	makeAddresses,
	makeCoin,
	makePool,
	makeProvider,
	originalFetch,
	registerModuleMock,
	requestBody,
	requestUrl,
	statsFixture,
	wireJson,
};
export type {
	AftermathApi,
	CmmmModule,
	CoinType,
	ConfigAddresses,
	DaoFeePoolOwnerCapObject,
	EventOnChain,
	FakeTx,
	FetchCall,
	PoolCoin,
	PoolModule,
	PoolObject,
	PoolStats,
	PoolsApiCastingModule,
	PoolsApiModule,
	PoolsModule,
	SuiObjectView,
	Transaction,
};

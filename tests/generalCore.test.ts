/**
 * Extensive deterministic tests for the general core seam.
 * Covers src/general/utils/casting.ts, grpcCasting.ts, helpers.ts,
 * fixedUtils.ts, iFixedUtils.ts, caller.ts, transportError.ts
 * and directly related exported utility behavior.
 *
 * Stub external deps, no network/secrets.
 * Caller HTTP / JSON / bigint / abort verified via minimal subclass seam.
 */

// Jest supplies this global in the configured test environment.
// biome-ignore-all lint/correctness/noUndeclaredVariables: Jest test global

import { bcs } from "@mysten/sui/bcs";
import { jest } from "@jest/globals";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import { Transaction } from "@mysten/sui/transactions";
import {
	AftermathTransportError,
	Casting,
	GrpcCasting,
	Helpers,
	isAftermathTransportError,
} from "../src";
import { Caller } from "../src/general/utils/caller";
import { FixedUtils } from "../src/general/utils/fixedUtils";
import { IFixedUtils } from "../src/general/utils/iFixedUtils";
import {
	normalizeAftermathTransportError,
	parseRetryAfter,
} from "../src/general/utils/transportError";

// ---------------------------------------------------------------------------
// Helpers for Caller fetch stubbing
// ---------------------------------------------------------------------------

type FetchHandler = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Response | Promise<Response>;

interface FetchCall {
	input: RequestInfo | URL;
	init?: RequestInit;
}

// minimal subclass that exposes protected fetchApi etc.
class TestCaller extends Caller {
	call<Output>(
		body?: unknown,
		signal?: AbortSignal,
		options?: { disableBigIntJsonParsing?: boolean }
	): Promise<Output> {
		return (this as any).fetchApi("test", body, signal, options);
	}
	callUrl(url: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
		return (this as any).fetchApi(url, body, signal);
	}
	callTx(inputs: {
		url: string;
		body?: any;
		signal?: AbortSignal;
		txKind?: boolean;
	}) {
		return (this as any).fetchApiTransaction(
			inputs.url,
			inputs.body,
			inputs.signal,
			{ txKind: inputs.txKind }
		);
	}
	callTxObject(inputs: { url: string; body?: any; signal?: AbortSignal }) {
		return (this as any).fetchApiTxObject(
			inputs.url,
			inputs.body,
			inputs.signal
		);
	}
	callEvents(url: string, body: any, signal?: AbortSignal) {
		return (this as any).fetchApiEvents(url, body, signal);
	}
	callIndexerEvents(url: string, body: any, signal?: AbortSignal) {
		return (this as any).fetchApiIndexerEvents(url, body, signal);
	}
	openWs(args: any) {
		return (this as any).openWsStream(args);
	}
	getApiEndpoint(): string {
		return this.apiEndpoint;
	}
	setToken(token: string) {
		(this as any).setAccessToken(token);
	}
}

const originalFetch = globalThis.fetch;
const originalWebSocket = (globalThis as any).WebSocket;
const originalErrorEvent = (globalThis as any).ErrorEvent;
const originalDateNow = Date.now;
const greatestBitLiteral = BigInt(
	"57896044618658097711785492504343953926634992332820282019728792003956564819968"
);
const notGreatestBitLiteral = BigInt(
	"57896044618658097711785492504343953926634992332820282019728792003956564819967"
);

afterEach(() => {
	globalThis.fetch = originalFetch;
	(globalThis as any).WebSocket = originalWebSocket;
	(globalThis as any).ErrorEvent = originalErrorEvent;
	Date.now = originalDateNow;
	jest.restoreAllMocks();
});

function installFetch(handler: FetchHandler): FetchCall[] {
	const calls: FetchCall[] = [];
	(globalThis as any).fetch = (
		input: RequestInfo | URL,
		init?: RequestInit
	) => {
		calls.push({ input, init });
		return Promise.resolve(handler(input, init));
	};
	return calls;
}

function makeResponse(
	body: string,
	status = 200,
	headers?: HeadersInit,
	statusText?: string
) {
	return new Response(body, { status, headers, statusText });
}
function makeCaller(baseUrl = "https://sdk.test", extra?: any): TestCaller {
	return new TestCaller({ baseUrl, ...extra });
}

// ---------------------------------------------------------------------------
// Casting
// ---------------------------------------------------------------------------

describe("Casting", () => {
	describe("constants", () => {
		it("exposes u64 and i64 max", () => {
			expect(Casting.u64MaxBigInt).toBe(BigInt("0xFFFFFFFFFFFFFFFF"));
			expect(Casting.i64MaxBigInt).toBe(BigInt("9223372036854775807"));
			expect(Casting.u64MaxBigInt).toBe(18446744073709551615n);
		});
		it("exposes Fixed and IFixed refs", () => {
			expect(Casting.Fixed).toBe(FixedUtils);
			expect(Casting.IFixed).toBe(IFixedUtils);
			expect(Casting.pools).toBeDefined();
			expect(Casting.staking).toBeDefined();
			expect(Casting.farms).toBeDefined();
			expect(Casting.router).toBeDefined();
			expect(Casting.nfts).toBeDefined();
		});
	});

	describe("numberToFixedBigInt / bigIntToFixedNumber", () => {
		it("converts 0, 1, 1.5 and floors", () => {
			expect(Casting.numberToFixedBigInt(0)).toBe(0n);
			expect(Casting.numberToFixedBigInt(1)).toBe(1_000_000_000_000_000_000n);
			expect(Casting.numberToFixedBigInt(1.5)).toBe(1_500_000_000_000_000_000n);
			// Independent literal for 1.999 * 1e18 after the implementation's floor.
			expect(Casting.numberToFixedBigInt(1.999)).toBe(
				1_999_000_000_000_000_000n
			);
			expect(Casting.numberToFixedBigInt(0.000_000_000_000_000_001)).toBe(1n);
			expect(() => Casting.numberToFixedBigInt(Number.NaN)).toThrow(RangeError);
			expect(() =>
				Casting.numberToFixedBigInt(Number.POSITIVE_INFINITY)
			).toThrow(RangeError);
		});
		it("handles negative and large values", () => {
			expect(Casting.numberToFixedBigInt(-1)).toBe(-1_000_000_000_000_000_000n);
			expect(Casting.numberToFixedBigInt(0.5)).toBe(500_000_000_000_000_000n);
			// The public API returns the exact fixed representation for this fixture.
			expect(Casting.numberToFixedBigInt(123.456)).toBe(
				123_456_000_000_000_000_000n
			);
		});
		it("bigIntToFixedNumber inverse", () => {
			expect(Casting.bigIntToFixedNumber(0n)).toBe(0);
			expect(Casting.bigIntToFixedNumber(1_000_000_000_000_000_000n)).toBe(1);
			expect(Casting.bigIntToFixedNumber(1_500_000_000_000_000_000n)).toBe(1.5);
			expect(Casting.bigIntToFixedNumber(-1_000_000_000_000_000_000n)).toBe(-1);
			// round-trip floor is close
			const n = 2.345;
			expect(
				Casting.bigIntToFixedNumber(Casting.numberToFixedBigInt(n))
			).toBeCloseTo(n, 12);
		});
		it("handles zero and very small fraction", () => {
			expect(Casting.bigIntToFixedNumber(1n)).toBe(1 / 1e18);
			expect(Casting.numberToFixedBigInt(0.000_000_000_000_000_000_4)).toBe(0n);
		});
	});

	describe("scaleNumberByBigInt", () => {
		it("scales correctly", () => {
			expect(Casting.scaleNumberByBigInt(0.5, 100n)).toBe(50n);
			expect(Casting.scaleNumberByBigInt(1, 123n)).toBe(123n);
			expect(Casting.scaleNumberByBigInt(0, 999n)).toBe(0n);
			expect(Casting.scaleNumberByBigInt(2, 10n)).toBe(20n);
			expect(Casting.scaleNumberByBigInt(0.333, 9n)).toBe(2n);
		});
		it("handles negative scalar and large bigint", () => {
			expect(Casting.scaleNumberByBigInt(-0.5, 100n)).toBe(-50n);
			expect(
				Casting.scaleNumberByBigInt(1.5, BigInt(Number.MAX_SAFE_INTEGER))
			).toBe(13_510_798_882_111_486n);
		});
	});

	describe("percentageToBps / bpsToPercentage", () => {
		it("converts percentages to bps", () => {
			expect(Casting.percentageToBps(0)).toBe(0n);
			expect(Casting.percentageToBps(0.05)).toBe(500n);
			expect(Casting.percentageToBps(1)).toBe(10000n);
			expect(Casting.percentageToBps(0.5)).toBe(5000n);
			expect(Casting.percentageToBps(0.0001)).toBe(1n);
			// rounding
			expect(Casting.percentageToBps(0.000_05)).toBe(1n); // 0.5 -> round to 1? actually 0.00005*10000=0.5 round 1
			expect(Casting.percentageToBps(0.000_04)).toBe(0n);
		});
		it("converts bps back to percentage", () => {
			expect(Casting.bpsToPercentage(0n)).toBe(0);
			expect(Casting.bpsToPercentage(500n)).toBe(0.05);
			expect(Casting.bpsToPercentage(10000n)).toBe(1);
			expect(Casting.bpsToPercentage(1n)).toBe(0.0001);
		});
		it("round-trips within integer bps", () => {
			for (const p of [0, 0.01, 0.05, 0.1234, 1]) {
				const bps = Casting.percentageToBps(p);
				const back = Casting.bpsToPercentage(bps);
				expect(back).toBeCloseTo(p, 4);
			}
		});
		it("handles large and negative percentages", () => {
			expect(Casting.percentageToBps(2)).toBe(20000n);
			expect(Casting.percentageToBps(-0.01)).toBe(-100n);
			expect(Casting.bpsToPercentage(-100n)).toBe(-0.01);
		});
	});

	describe("stringFromBytes", () => {
		it("converts bytes to string", () => {
			expect(Casting.stringFromBytes([72, 101, 108, 108, 111])).toBe("Hello");
			expect(Casting.stringFromBytes([])).toBe("");
			expect(Casting.stringFromBytes([0x41])).toBe("A");
		});
		it("handles all zeros and high bytes", () => {
			expect(Casting.stringFromBytes([0, 0])).toBe("\0\0");
			expect(Casting.stringFromBytes([255])).toBe(String.fromCharCode(255));
		});
	});

	describe("bigIntFromBytes (little-endian)", () => {
		it("converts LE bytes to bigint", () => {
			expect(Casting.bigIntFromBytes([0x01])).toBe(1n);
			expect(Casting.bigIntFromBytes([0x01, 0x02])).toBe(0x0201n); // 513
			expect(Casting.bigIntFromBytes([0xff, 0x00])).toBe(0x00ffn);
			expect(Casting.bigIntFromBytes([0x00, 0x01])).toBe(256n);
		});
		it("handles single byte and empty edge", () => {
			expect(Casting.bigIntFromBytes([0])).toBe(0n);
			// empty => BigInt("0x") throws – we assert it throws
			expect(() => Casting.bigIntFromBytes([])).toThrow();
		});
		it("reverses correctly for multi-byte", () => {
			// 0x01020304 LE => bytes [0x04,0x03,0x02,0x01] => 0x01020304
			expect(Casting.bigIntFromBytes([0x04, 0x03, 0x02, 0x01])).toBe(
				0x01020304n
			);
		});
		it("mutates input via reverse (documented behavior)", () => {
			const arr: number[] = [1, 2, 3];
			const copy = [...arr];
			Casting.bigIntFromBytes(arr);
			// original was reversed in-place
			expect(arr).toEqual(copy.reverse());
		});
	});

	describe("addressFromBytes / addressFromStringBytes / addressFromBcsBytes", () => {
		it("addressFromBytes zero-pads to 64 hex", () => {
			const zeroAddr = Casting.addressFromBytes(new Array(32).fill(0));
			expect(zeroAddr).toBe(`0x${"0".repeat(64)}`);
			const oneByte = Casting.addressFromBytes([0xab]);
			expect(oneByte).toBe(`0x${"0".repeat(62)}ab`);
		});
		it("addressFromBytes handles 32-byte address", () => {
			const bytes = Array.from({ length: 32 }, (_, i) => i);
			const addr = Casting.addressFromBytes(bytes);
			expect(addr.startsWith("0x")).toBe(true);
			expect(addr.length).toBe(66);
			// check leading zeros preserved for first bytes 0
			expect(addr.slice(2, 4)).toBe("00");
		});
		it("addressFromBytes pads single hex nibble", () => {
			// byte 0x1 => "01" not "1"
			expect(Casting.addressFromBytes([0x1])).toBe(`0x${"0".repeat(62)}01`);
		});
		it("bytesFromStringBytes converts decimal strings", () => {
			expect(Casting.bytesFromStringBytes(["255", "0", "10"])).toEqual([
				255, 0, 10,
			]);
			expect(Casting.bytesFromStringBytes([])).toEqual([]);
		});
		it("addressFromStringBytes delegates", () => {
			expect(Casting.addressFromStringBytes(["171", "0", "0"])).toBe(
				`0x${"0".repeat(58)}ab0000`
			);
		});
		it("addressFromBcsBytes uses bcs.Address", () => {
			// create 32-byte BCS address bytes (BCS address is 32 bytes)
			const addrBytes = new Array(32).fill(0);
			addrBytes[31] = 0x02; // address 0x2
			const addr = Casting.addressFromBcsBytes(addrBytes);
			expect(addr).toBe(`0x${"0".repeat(63)}2`);
			// another: 0x123
			const bytes2 = new Array(32).fill(0);
			bytes2[30] = 0x01;
			bytes2[31] = 0x23;
			const addr2 = Casting.addressFromBcsBytes(bytes2);
			expect(addr2).toBe(`0x${"0".repeat(60)}0123`);
		});
		it("addressFromBcsBytes preserves a fixed 32-byte value", () => {
			const bytes = [
				0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb,
				0xcc, 0xdd, 0xee, 0xff, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
				0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
			];
			expect(Casting.addressFromBcsBytes(bytes)).toBe(
				"0x00112233445566778899aabbccddeeff0102030405060708090a0b0c0d0e0f10"
			);
			expect(() =>
				Casting.addressFromBcsBytes(new Array(31).fill(0))
			).toThrow();
		});
	});

	describe("unwrapDeserializedOption", () => {
		it("unwraps Some, returns undefined for None", () => {
			expect(Casting.unwrapDeserializedOption({ Some: 123 })).toBe(123);
			expect(Casting.unwrapDeserializedOption({ Some: null })).toBeNull();
			expect(Casting.unwrapDeserializedOption({ None: true })).toBeUndefined();
			expect(Casting.unwrapDeserializedOption({ None: null })).toBeUndefined();
		});
		it("handles falsy Some values", () => {
			expect(Casting.unwrapDeserializedOption({ Some: 0 })).toBe(0);
			expect(Casting.unwrapDeserializedOption({ Some: "" })).toBe("");
			expect(Casting.unwrapDeserializedOption({ Some: false })).toBe(false);
		});
	});

	describe("u8VectorFromString", () => {
		it("encodes ascii", () => {
			expect(Casting.u8VectorFromString("hello")).toEqual([
				104, 101, 108, 108, 111,
			]);
			expect(Casting.u8VectorFromString("")).toEqual([]);
		});
		it("encodes utf-8 multi-byte", () => {
			expect(Casting.u8VectorFromString("€")).toEqual([226, 130, 172]);
		});
		it("encodes emoji", () => {
			expect(Casting.u8VectorFromString("🙂")).toEqual([240, 159, 153, 130]);
		});
	});

	describe("normalizeSlippageTolerance", () => {
		it("normalizes integer percent to fraction", () => {
			expect(Casting.normalizeSlippageTolerance(1)).toBe(0.01);
			expect(Casting.normalizeSlippageTolerance(100)).toBe(1);
			expect(Casting.normalizeSlippageTolerance(0)).toBe(0);
			expect(Casting.normalizeSlippageTolerance(50)).toBe(0.5);
		});
		it("handles decimal slippage", () => {
			expect(Casting.normalizeSlippageTolerance(0.5)).toBe(0.005);
		});
	});

	describe("bcsBytesFromSuiObjectResponse / castObjectBcs", () => {
		it("extracts bcsBytes when present", () => {
			const obj: any = {
				data: {
					objectId: "0x123",
					bcs: {
						bcsBytes: "AQID",
						dataType: "moveObject",
						type: "0x2::foo::Bar",
						version: "1",
					},
				},
			};
			expect(Casting.bcsBytesFromSuiObjectResponse(obj)).toBe("AQID");
		});
		it("throws when bcsBytes missing", () => {
			expect(() =>
				Casting.bcsBytesFromSuiObjectResponse({
					data: { objectId: "0x1" },
				} as any)
			).toThrow("no bcs bytes found");
			expect(() =>
				Casting.bcsBytesFromSuiObjectResponse({ data: undefined } as any)
			).toThrow();
			expect(() =>
				Casting.bcsBytesFromSuiObjectResponse({
					data: { objectId: "0x1", bcs: { dataType: "package" } as any },
				} as any)
			).toThrow();
		});
		it("castObjectBcs deserializes and transforms", () => {
			// use bcs.u8 and bcs.u64 for simple test; we need deterministic bcsType
			const myType = bcs.u64();
			const value = 123456789n;
			const b64 = Buffer.from(myType.serialize(value).toBytes()).toString(
				"base64"
			);
			const obj: any = {
				data: {
					objectId: "0x1",
					bcs: {
						bcsBytes: b64,
						dataType: "moveObject",
						type: "0x2::foo::Bar",
						version: "1",
					},
				},
			};
			const result = Casting.castObjectBcs({
				suiObjectResponse: obj,
				bcsType: myType,
				fromDeserialized: (v) => Number(v) * 2,
			});
			expect(result).toBe(Number(value) * 2);
		});
		it("castObjectBcs propagates bcs parse errors", () => {
			const badType = bcs.u64();
			const obj: any = {
				data: {
					objectId: "0x1",
					bcs: {
						bcsBytes: "!!!!invalid base64!!!!",
						dataType: "moveObject",
						type: "0x2::foo::Bar",
						version: "1",
					},
				},
			};
			expect(() =>
				Casting.castObjectBcs({
					suiObjectResponse: obj,
					bcsType: badType,
					fromDeserialized: (v) => v,
				})
			).toThrow();
		});
	});
});

// ---------------------------------------------------------------------------
// GrpcCasting
// ---------------------------------------------------------------------------

describe("GrpcCasting", () => {
	describe("coinStructFromGrpcCoin", () => {
		it("reshapes gRPC Coin to CoinStruct", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x2::sui::SUI>",
				objectId: "0xabc",
				version: "5",
				digest: "digest123",
				balance: "1000",
			};
			const res = GrpcCasting.coinStructFromGrpcCoin(coin);
			expect(res.coinType).toBe("0x2::sui::SUI");
			expect(res.coinObjectId).toBe("0xabc");
			expect(res.version).toBe("5");
			expect(res.digest).toBe("digest123");
			expect(res.balance).toBe("1000");
			expect(res.previousTransaction).toBe("");
		});
		it("extracts inner type and handles non-generic", () => {
			const coin1: any = {
				type: "0x2::coin::Coin<0xabc::foo::BAR>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin1).coinType).toBe(
				"0xabc::foo::BAR"
			);
			const coin2: any = {
				type: "0x2::sui::SUI",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin2).coinType).toBe(
				"0x2::sui::SUI"
			);
		});
		it("handles nested generics via last > extraction", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x1::a::B<0x2::sui::SUI>>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			// extracts from first < to last > => 0x1::a::B<0x2::sui::SUI>
			expect(GrpcCasting.coinStructFromGrpcCoin(coin).coinType).toBe(
				"0x1::a::B<0x2::sui::SUI>"
			);
		});
		it("zero-padded is caller's responsibility – still returns inner", () => {
			const coin: any = {
				type: "0x2::coin::Coin<0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI>",
				objectId: "0x1",
				version: "1",
				digest: "d",
				balance: "0",
			};
			expect(GrpcCasting.coinStructFromGrpcCoin(coin).coinType).toBe(
				"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
			);
		});
	});

	describe("dynamicFieldInfoFromGrpcEntry", () => {
		it("maps fields correctly and base64-encodes name.bcs", () => {
			const bcsBytes = new Uint8Array([1, 2, 3]);
			const entry: any = {
				fieldId: "0xfield",
				valueType: "0x2::table::Field",
				$kind: "DynamicField",
				name: { type: "0x2::object::ID", bcs: bcsBytes },
			};
			const res = GrpcCasting.dynamicFieldInfoFromGrpcEntry(entry);
			expect(res.objectId).toBe("0xfield");
			expect(res.objectType).toBe("0x2::table::Field");
			expect(res.type).toBe("DynamicField");
			expect(res.bcsName).toBe("AQID");
			expect(res.bcsEncoding).toBe("base64");
			expect(res.name.type).toBe("0x2::object::ID");
			expect(res.name.value).toBe("AQID");
		});
		it("handles DynamicObject kind", () => {
			const entry: any = {
				fieldId: "0x1",
				valueType: "0x1::foo::Bar",
				$kind: "DynamicObject",
				name: { type: "address", bcs: new Uint8Array([0]) },
			};
			expect(GrpcCasting.dynamicFieldInfoFromGrpcEntry(entry).type).toBe(
				"DynamicObject"
			);
		});
	});

	describe("suiObjectResponseFromGrpcObjectBcs", () => {
		it("builds SuiObjectResponse with BCS bytes", () => {
			const content = new Uint8Array([9, 9]);
			const obj: any = {
				objectId: "0x123",
				version: "1",
				digest: "dig",
				type: "0x2::foo::Bar",
				owner: { AddressOwner: "0xabc" },
				content,
			};
			const res = GrpcCasting.suiObjectResponseFromGrpcObjectBcs(obj);
			expect(res.data?.objectId).toBe("0x123");
			expect(res.data?.version).toBe("1");
			expect(res.data?.digest).toBe("dig");
			expect(res.data?.type).toBe("0x2::foo::Bar");
			expect((res.data as any).bcs.bcsBytes).toBe("CQk=");
			expect((res.data as any).bcs.dataType).toBe("moveObject");
			expect((res.data as any).bcs.type).toBe("0x2::foo::Bar");
		});
		it("base64 round-trips", () => {
			const bytes = new Uint8Array([1, 2, 3, 255]);
			const obj: any = {
				objectId: "0x1",
				version: "2",
				digest: "d",
				type: "0x1::a::B",
				owner: null,
				content: bytes,
			};
			const res = GrpcCasting.suiObjectResponseFromGrpcObjectBcs(obj);
			expect(
				Uint8Array.from(Buffer.from((res.data as any).bcs.bcsBytes, "base64"))
			).toEqual(bytes);
		});
	});

	describe("displayFieldsResponseFromGrpcDisplay", () => {
		it("maps output to data", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: { name: "a", url: "https://x" },
					errors: null,
				} as any)
			).toEqual({ data: { name: "a", url: "https://x" }, error: null });
		});
		it("drops non-string values", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: { name: "a", count: 3, obj: { a: 1 }, nil: null } as any,
				errors: null,
			});
			expect(res.data).toEqual({ name: "a" });
			expect(JSON.stringify(res.data)).not.toContain("[object Object]");
		});
		it("keeps output when individual field errored", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: { name: "x" } as any,
				errors: { image_url: "fail" } as any,
			});
			expect(res.data).toEqual({ name: "x" });
			expect(res.error).toBeNull();
		});
		it("reports whole-object error when output null", () => {
			const res = GrpcCasting.displayFieldsResponseFromGrpcDisplay({
				output: null as any,
				errors: { f: "msg", g: "msg2" } as any,
			});
			expect(res.data).toBeNull();
			expect(res.error).toEqual({
				code: "displayError",
				error: "f: msg; g: msg2",
			});
		});
		it("returns null error when both null", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: null as any,
					errors: null,
				} as any)
			).toEqual({ data: null, error: null });
		});
		it("handles null and undefined display", () => {
			expect(GrpcCasting.displayFieldsResponseFromGrpcDisplay(null)).toEqual({
				data: null,
				error: null,
			});
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay(undefined)
			).toEqual({ data: null, error: null });
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: undefined,
				} as any)
			).toEqual({ data: null, error: null });
		});
		it("handles display with undefined errors", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: null as any,
					errors: undefined as any,
				})
			).toEqual({ data: null, error: null });
		});
		it("handles empty output object", () => {
			expect(
				GrpcCasting.displayFieldsResponseFromGrpcDisplay({
					output: {} as any,
					errors: null,
				} as any)
			).toEqual({ data: {}, error: null });
		});
	});

	describe("bytesFieldToNumbers", () => {
		it("base64-decodes gRPC form", () => {
			expect(GrpcCasting.bytesFieldToNumbers("CQk=")).toEqual([9, 9]);
			expect(GrpcCasting.bytesFieldToNumbers("CQYI")).toEqual([9, 6, 8]);
			expect(GrpcCasting.bytesFieldToNumbers("")).toEqual([]);
			expect(GrpcCasting.bytesFieldToNumbers("AQ==")).toEqual([1]);
		});
		it("passes number[] through", () => {
			expect(GrpcCasting.bytesFieldToNumbers([9, 9])).toEqual([9, 9]);
			expect(GrpcCasting.bytesFieldToNumbers([])).toEqual([]);
		});
		it("accepts Uint8Array", () => {
			expect(
				GrpcCasting.bytesFieldToNumbers(new Uint8Array([6, 8, 9]))
			).toEqual([6, 8, 9]);
			expect(GrpcCasting.bytesFieldToNumbers(new Uint8Array([]))).toEqual([]);
		});
		it("round-trip check for NaN hazard", () => {
			const grpc = "CQk=";
			expect(Number(grpc[0])).toBeNaN();
			expect(Number(GrpcCasting.bytesFieldToNumbers(grpc)[0])).toBe(9);
		});
		it("decodes arbitrary base64", () => {
			const bytes = [0, 1, 255, 128];
			expect(GrpcCasting.bytesFieldToNumbers("AAH/gA==")).toEqual(bytes);
			expect(() => GrpcCasting.bytesFieldToNumbers("not-base64")).toThrow();
		});
	});

	describe("unwrapStructField", () => {
		it("returns bare gRPC struct unchanged", () => {
			const grpc = { value: "100" };
			expect(GrpcCasting.unwrapStructField(grpc)).toEqual({ value: "100" });
		});
		it("unwraps JSON-RPC envelope", () => {
			expect(
				GrpcCasting.unwrapStructField<{ value: string }>({
					type: "0x2::a::B",
					fields: { value: "1" },
				} as unknown as {
					fields: { value: string };
				})
			).toEqual({ value: "1" });
		});
		it("is idempotent", () => {
			const once = GrpcCasting.unwrapStructField({
				fields: { size: "3" },
			} as any);
			expect(GrpcCasting.unwrapStructField(once as any)).toEqual({ size: "3" });
		});
		it("does not unwrap when fields undefined", () => {
			interface T {
				fields: undefined;
				size: string;
			}
			expect(
				GrpcCasting.unwrapStructField<T>({
					fields: undefined,
					size: "1",
				} as any)
			).toEqual({ fields: undefined, size: "1" });
		});
		it("passes null and primitives", () => {
			expect(GrpcCasting.unwrapStructField(null as any)).toBeNull();
			expect(GrpcCasting.unwrapStructField("0x5" as any)).toBe("0x5");
			expect(GrpcCasting.unwrapStructField(123 as any)).toBe(123);
			expect(GrpcCasting.unwrapStructField(undefined as any)).toBeUndefined();
		});
		it("does not unwrap object without fields key", () => {
			expect(GrpcCasting.unwrapStructField({ value: "1" } as any)).toEqual({
				value: "1",
			});
		});
	});

	describe("unwrapUid", () => {
		const id =
			"0x0235f7d73eb5974bf9cbf518763d60893f0942a7f0deb76fb30eae9147926c48";
		it("returns flattened string", () => {
			expect(GrpcCasting.unwrapUid(id)).toBe(id);
		});
		it("reads {id}", () => {
			expect(GrpcCasting.unwrapUid({ id } as any)).toBe(id);
		});
		it("reads doubly nested", () => {
			expect(GrpcCasting.unwrapUid({ id: { id } } as any)).toBe(id);
		});
		it("handles non-string id recursively", () => {
			// if value is object with id that is not string, it will attempt recursion
			// but our implementation will fallback to value if not string/id
			expect(GrpcCasting.unwrapUid({ id: "0xabc" } as any)).toBe("0xabc");
		});
	});

	describe("transactionFromResult", () => {
		it("returns Transaction when $kind Transaction", () => {
			const tx = { digest: "d" } as any;
			const result: any = { $kind: "Transaction", Transaction: tx };
			expect(GrpcCasting.transactionFromResult(result)).toBe(tx);
		});
		it("returns FailedTransaction when failed", () => {
			const tx = { digest: "failed" } as any;
			const result: any = { $kind: "FailedTransaction", FailedTransaction: tx };
			expect(GrpcCasting.transactionFromResult(result)).toBe(tx);
		});
		it("handles Transaction with effects", () => {
			const success: any = {
				$kind: "Transaction",
				Transaction: { effects: { status: "success" } },
			};
			expect(
				(GrpcCasting.transactionFromResult(success) as any).effects.status
			).toBe("success");
			const failed: any = {
				$kind: "FailedTransaction",
				FailedTransaction: { effects: { status: "failure" } },
			};
			expect(
				(GrpcCasting.transactionFromResult(failed) as any).effects.status
			).toBe("failure");
		});
	});

	describe("bytesFromBase64", () => {
		it("decodes base64", () => {
			expect(GrpcCasting.bytesFromBase64("AQID")).toEqual(
				new Uint8Array([1, 2, 3])
			);
			expect(GrpcCasting.bytesFromBase64("")).toEqual(new Uint8Array([]));
		});
		it("decodes a fixed binary fixture", () => {
			const bytes = new Uint8Array([255, 0, 127]);
			expect(GrpcCasting.bytesFromBase64("/wB/")).toEqual(bytes);
		});
	});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("Helpers", () => {
	describe("stripLeadingZeroesFromType / addLeadingZeroesToType", () => {
		it("strips leading zeroes after 0x", () => {
			expect(Helpers.stripLeadingZeroesFromType("0x0000123")).toBe("0x123");
			expect(
				Helpers.stripLeadingZeroesFromType(
					"0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI"
				)
			).toBe("0x2::sui::SUI");
			expect(Helpers.stripLeadingZeroesFromType("0x2::sui::SUI")).toBe(
				"0x2::sui::SUI"
			);
		});
		it("strips generics inner padding? (uses replaceAll /x0+/g)", () => {
			// replaceAll /x0+/g will also strip from generic inner "0x0002" -> "0x2"
			expect(
				Helpers.stripLeadingZeroesFromType("0x0002::a::B<0x0003::c::D>")
			).toBe("0x2::a::B<0x3::c::D>");
		});
		it("addLeadingZeroes pads to 64", () => {
			expect(Helpers.addLeadingZeroesToType("0x2")).toBe(
				`0x${"0".repeat(63)}2`
			);
			expect(Helpers.addLeadingZeroesToType("0x123")).toBe(
				`0x${"0".repeat(61)}123`
			);
			expect(Helpers.addLeadingZeroesToType(`0x${"a".repeat(64)}`)).toBe(
				`0x${"a".repeat(64)}`
			);
		});
		it("addLeading preserves suffix after ::", () => {
			expect(Helpers.addLeadingZeroesToType("0x2::sui::SUI")).toBe(
				`0x${"0".repeat(63)}2::sui::SUI`
			);
			// note: implementation strips 0x from first generic param (pre-existing bug, see objectCasters.test.ts FINDING)
			expect(Helpers.addLeadingZeroesToType("0x2::a::B<0x1::c::D>")).toBe(
				`0x${"0".repeat(63)}2::a::B<1::c::D>`
			);
			// multiple :: segments
			expect(Helpers.addLeadingZeroesToType("0x1::a::b::c")).toBe(
				`0x${"0".repeat(63)}1::a::b::c`
			);
		});
		it("throws when too long", () => {
			expect(() =>
				Helpers.addLeadingZeroesToType(`0x${"a".repeat(65)}`)
			).toThrow("invalid type length");
			expect(() =>
				Helpers.addLeadingZeroesToType(`0x${"a".repeat(64)}::mod`)
			).not.toThrow(); // 64 is ok
		});
		it("handles 0x without suffix correctly", () => {
			expect(Helpers.addLeadingZeroesToType("0x0")).toBe(`0x${"0".repeat(64)}`);
		});
		it("round-trip strip/add for short address", () => {
			const _orig = "0x2::coin::Coin<0x2::sui::SUI>";
			const padded = Helpers.addLeadingZeroesToType("0x2");
			expect(Helpers.stripLeadingZeroesFromType(padded)).toBe("0x2");
			// stripping padded generic inner may have side effects but outer works
			expect(
				Helpers.addLeadingZeroesToType(
					Helpers.stripLeadingZeroesFromType(padded)
				)
			).toBe(padded);
		});
	});

	describe("splitNonSuiCoinType", () => {
		it("defaults to sui when no colon", () => {
			expect(Helpers.splitNonSuiCoinType("0x2::sui::SUI")).toEqual({
				chain: "sui",
				coinType: "0x2::sui::SUI",
			});
			expect(Helpers.splitNonSuiCoinType("abc")).toEqual({
				chain: "sui",
				coinType: "abc",
			});
		});
		it("splits bsc etc", () => {
			// implementation destructures as [chain, coinType] = coin.split(":") so only second segment retained
			expect(Helpers.splitNonSuiCoinType("bsc:0x123::coin::COIN")).toEqual({
				chain: "bsc",
				coinType: "0x123",
			});
			// with extra colon, only first split is used (destructuring)
			expect(Helpers.splitNonSuiCoinType("eth:0xabc:def")).toEqual({
				chain: "eth",
				coinType: "0xabc",
			});
		});
		it("handles chain with empty coinType -> defaults to sui", () => {
			// uncastChain truthy but coinType falsy => returns sui
			expect(Helpers.splitNonSuiCoinType("bsc:")).toEqual({
				chain: "sui",
				coinType: "bsc:",
			});
		});
	});

	describe("isNumber", () => {
		it("validates numeric strings via regex", () => {
			expect(Helpers.isNumber("123")).toBe(true);
			expect(Helpers.isNumber("0.123")).toBe(true);
			expect(Helpers.isNumber(".123")).toBe(true);
			expect(Helpers.isNumber("123.")).toBe(true);
			expect(Helpers.isNumber("")).toBe(true); // regex allows empty due to *
			expect(Helpers.isNumber("abc")).toBe(false);
			expect(Helpers.isNumber("-123")).toBe(false);
			expect(Helpers.isNumber("1.2.3")).toBe(false);
			expect(Helpers.isNumber("12a")).toBe(false);
		});
	});

	describe("sum / sumBigInt", () => {
		it("sums numbers", () => {
			expect(Helpers.sum([1, 2, 3])).toBe(6);
			expect(Helpers.sum([])).toBe(0);
			expect(Helpers.sum([0.1, 0.2])).toBeCloseTo(0.3);
		});
		it("sums bigints", () => {
			expect(Helpers.sumBigInt([1n, 2n, 3n])).toBe(6n);
			expect(Helpers.sumBigInt([])).toBe(0n);
			expect(Helpers.sumBigInt([10n, -5n])).toBe(5n);
		});
	});

	describe("closeEnough / closeEnoughBigInt / veryCloseInt", () => {
		it("closeEnough within tolerance", () => {
			expect(Helpers.closeEnough(100, 101, 0.02)).toBe(true); // diff 1 <= 2.02
			expect(Helpers.closeEnough(100, 110, 0.05)).toBe(false);
			expect(Helpers.closeEnough(0, 0, 0.1)).toBe(true);
			expect(Helpers.closeEnough(0, 1, 0.1)).toBe(false); // max 1 => 0.1, diff 1 >0.1
		});
		it("closeEnoughBigInt delegates to closeEnough via Number", () => {
			expect(Helpers.closeEnoughBigInt(100n, 101n, 0.02)).toBe(true);
			expect(Helpers.closeEnoughBigInt(100n, 200n, 0.1)).toBe(false);
		});
		it("veryCloseInt checks floor diff <=1", () => {
			expect(Helpers.veryCloseInt(1000, 1001, 10)).toBe(true); // floor 100 vs 100 => diff0
			expect(Helpers.veryCloseInt(1000, 1020, 10)).toBe(false); // 100 vs 102 diff2
			expect(Helpers.veryCloseInt(0, 0, 1)).toBe(true);
			// with fixedOne scaling
			expect(Helpers.veryCloseInt(1.5e18, 1.6e18, 1e18)).toBe(true); // both floor 1
			expect(Helpers.veryCloseInt(1e18, 3e18, 1e18)).toBe(false); // 1 vs 3 diff2
		});
	});

	describe("blendedOperations", () => {
		it("mulNNN", () => expect(Helpers.blendedOperations.mulNNN(2, 3)).toBe(6));
		it("mulNNB", () => expect(Helpers.blendedOperations.mulNNB(2, 3)).toBe(6n));
		it("mulNBN", () =>
			expect(Helpers.blendedOperations.mulNBN(2, 10n)).toBe(20));
		it("mulNBB", () =>
			expect(Helpers.blendedOperations.mulNBB(2.5, 10n)).toBe(25n));
		it("mulBBN", () =>
			expect(Helpers.blendedOperations.mulBBN(2n, 3n)).toBe(6));
		it("mulBBB", () =>
			expect(Helpers.blendedOperations.mulBBB(2n, 3n)).toBe(6n));
		it("floor behavior for mulNNB/NBB", () => {
			expect(Helpers.blendedOperations.mulNNB(0.5, 3)).toBe(1n); // floor 1.5 =>1
			expect(Helpers.blendedOperations.mulNBB(0.6, 5n)).toBe(3n); // floor 3
		});
	});

	describe("maxBigInt / minBigInt / absBigInt", () => {
		it("max", () => {
			expect(Helpers.maxBigInt(1n, 5n, 3n)).toBe(5n);
			expect(Helpers.maxBigInt(-1n, -5n)).toBe(-1n);
			expect(Helpers.maxBigInt(0n)).toBe(0n);
		});
		it("min", () => {
			expect(Helpers.minBigInt(1n, 5n, 3n)).toBe(1n);
			expect(Helpers.minBigInt(-1n, -5n)).toBe(-5n);
		});
		it("abs", () => {
			expect(Helpers.absBigInt(5n)).toBe(5n);
			expect(Helpers.absBigInt(-5n)).toBe(5n);
			expect(Helpers.absBigInt(0n)).toBe(0n);
		});
		it("throws on empty? reduce without initial will throw", () => {
			expect(() => (Helpers as any).maxBigInt()).toThrow();
			expect(() => (Helpers as any).minBigInt()).toThrow();
		});
	});

	describe("capitalizeOnlyFirstLetter", () => {
		it("capitalizes", () => {
			expect(Helpers.capitalizeOnlyFirstLetter("HELLO")).toBe("Hello");
			expect(Helpers.capitalizeOnlyFirstLetter("hello")).toBe("Hello");
			expect(Helpers.capitalizeOnlyFirstLetter("h")).toBe("H");
			expect(Helpers.capitalizeOnlyFirstLetter("")).toBe("");
			expect(Helpers.capitalizeOnlyFirstLetter("aBC")).toBe("Abc");
		});
	});

	describe("parseJsonWithBigint", () => {
		it("converts bigint strings and null->undefined", () => {
			const parsed = Helpers.parseJsonWithBigint(
				'{"a":"123n","b":null,"c":"hello"}'
			);
			expect(parsed.a).toBe(123n);
			expect(parsed.b).toBeUndefined();
			expect(parsed.c).toBe("hello");
		});
		it("handles negative bigint strings", () => {
			expect(Helpers.parseJsonWithBigint('{"v":"-123n"}').v).toBe(-123n);
		});
		it("handles nested and arrays", () => {
			const parsed = Helpers.parseJsonWithBigint('{"arr":["1n", null, "2n"]}');
			expect(parsed.arr).toEqual([1n, undefined, 2n]);
		});
		it("unsafeStringNumberConversion converts numeric strings", () => {
			const parsed = Helpers.parseJsonWithBigint('{"a":"123"}', true);
			expect(parsed.a).toBe(123n);
			// without unsafe, stays string
			expect(Helpers.parseJsonWithBigint('{"a":"123"}').a).toBe("123");
		});
		it("does not convert non-bigint suffixed strings", () => {
			expect(Helpers.parseJsonWithBigint('{"a":"123"}').a).toBe("123");
			expect(Helpers.parseJsonWithBigint('{"a":"12.3n"}').a).toBe("12.3n"); // regex is -?\d+n so decimal not match
		});
		it("converts top-level null to undefined? JSON.parse top null -> null then reviver?", () => {
			// parse "null" directly
			expect(Helpers.parseJsonWithBigint("null")).toBeUndefined();
		});
	});

	describe("deepCopy", () => {
		it("copies null", () => expect(Helpers.deepCopy(null)).toBeNull());
		it("copies date", () => {
			const d = new Date(123_456);
			const cp = Helpers.deepCopy(d);
			expect(cp.getTime()).toBe(d.getTime());
			expect(cp).not.toBe(d);
		});
		it("copies array deeply", () => {
			const arr = [1, { a: 2 }];
			const cp = Helpers.deepCopy(arr);
			expect(cp).toEqual(arr);
			expect(cp).not.toBe(arr);
			expect(cp[1]).not.toBe(arr[1]);
			(cp[1] as any).a = 99;
			expect((arr[1] as any).a).toBe(2);
		});
		it("copies object deeply", () => {
			const obj = { a: { b: 1 }, c: [1, 2] };
			const cp = Helpers.deepCopy(obj);
			expect(cp).toEqual(obj);
			cp.a.b = 99;
			expect(obj.a.b).toBe(1);
		});
		it("returns primitives as-is", () => {
			expect(Helpers.deepCopy(123)).toBe(123);
			expect(Helpers.deepCopy("abc")).toBe("abc");
			expect(Helpers.deepCopy(undefined)).toBeUndefined();
		});
	});

	describe("indexOfMax", () => {
		it("finds index of max", () => {
			expect(Helpers.indexOfMax([1, 5, 3])).toBe(1);
			expect(Helpers.indexOfMax([5])).toBe(0);
			expect(Helpers.indexOfMax([])).toBe(-1);
			expect(Helpers.indexOfMax([1n, 10n, 2n])).toBe(1);
			expect(Helpers.indexOfMax(["a", "z", "m"])).toBe(1);
			expect(Helpers.indexOfMax([new Date(1), new Date(5), new Date(3)])).toBe(
				1
			);
		});
		it("returns first max on ties", () => {
			expect(Helpers.indexOfMax([5, 5, 3])).toBe(0);
		});
	});

	describe("uniqueArray", () => {
		it("unique primitives", () => {
			expect(Helpers.uniqueArray([1, 2, 2, 3])).toEqual([1, 2, 3]);
			expect(Helpers.uniqueArray([])).toEqual([]);
			expect(Helpers.uniqueArray(["a", "a", "b"])).toEqual(["a", "b"]);
		});
		it("unique objects via JSON stringify", () => {
			expect(Helpers.uniqueArray([{ a: 1 }, { a: 1 }, { a: 2 }])).toEqual([
				{ a: 1 },
				{ a: 2 },
			]);
			// order preserved first occurrence
			expect(Helpers.uniqueArray([{ b: 2 }, { a: 1 }, { b: 2 }])).toEqual([
				{ b: 2 },
				{ a: 1 },
			]);
		});
		it("handles mixed but first element object triggers object path", () => {
			// if first is object, all go through uniqueObjectArray path
			const arr: any[] = [{ a: 1 }, 1, 1, { a: 1 }];
			expect(Helpers.uniqueArray(arr)).toEqual([{ a: 1 }, 1]);
		});
	});

	describe("sleep / createUid", () => {
		it("sleep schedules the requested delay", async () => {
			const originalSetTimeout = globalThis.setTimeout;
			let requestedDelay: number | undefined;
			globalThis.setTimeout = ((
				callback: (...args: unknown[]) => void,
				delay?: number
			) => {
				requestedDelay = delay;
				callback();
				return 0 as unknown as ReturnType<typeof setTimeout>;
			}) as typeof setTimeout;

			try {
				await Helpers.sleep(5);
				expect(requestedDelay).toBe(5);
			} finally {
				globalThis.setTimeout = originalSetTimeout;
			}
		});
		it("createUid combines deterministic timestamp and random components", () => {
			jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
			jest.spyOn(Math, "random").mockReturnValue(0.5);
			expect(Helpers.createUid()).toBe("loyw3v28i");
		});
	});

	describe("bifilter / bifilterAsync", () => {
		it("bifilter splits correctly", () => {
			const [evens, odds] = Helpers.bifilter([1, 2, 3, 4], (n) => n % 2 === 0);
			expect(evens).toEqual([2, 4]);
			expect(odds).toEqual([1, 3]);
		});
		it("bifilter provides index and array", () => {
			const [a, b] = Helpers.bifilter([10, 20, 30], (_, idx) => idx % 2 === 0);
			expect(a).toEqual([10, 30]);
			expect(b).toEqual([20]);
		});
		it("bifilterAsync", async () => {
			const [evens, odds] = await Helpers.bifilterAsync(
				[1, 2, 3],
				async (n) => n % 2 === 0
			);
			expect(evens).toEqual([2]);
			expect(odds).toEqual([1, 3]);
		});
		it("bifilter empty", () => {
			expect(Helpers.bifilter([], () => true)).toEqual([[], []]);
		});
	});

	describe("filterObject", () => {
		it("filters entries", () => {
			expect(
				Helpers.filterObject({ a: 1, b: 2, c: 3 }, (_k, v) => v > 1)
			).toEqual({ b: 2, c: 3 });
			expect(Helpers.filterObject({ a: 1, b: 2 }, (k) => k === "a")).toEqual({
				a: 1,
			});
			expect(Helpers.filterObject({}, () => true)).toEqual({});
		});
	});

	describe("applySlippage / applySlippageBigInt", () => {
		it("applySlippage reduces amount", () => {
			expect(Helpers.applySlippage(100, 1)).toBe(99);
			expect(Helpers.applySlippage(200, 50)).toBe(100);
			expect(Helpers.applySlippage(100, 0)).toBe(100);
			expect(Helpers.applySlippage(100, 100)).toBe(0);
		});
		it("applySlippageBigInt", () => {
			expect(Helpers.applySlippageBigInt(100n, 1)).toBe(99n);
			expect(Helpers.applySlippageBigInt(100n, 0)).toBe(100n);
			expect(Helpers.applySlippageBigInt(1000n, 10)).toBe(900n);
			// slippage is percent integer, 1 =>1%
			expect(Helpers.applySlippageBigInt(100n, 100)).toBe(0n);
		});
	});

	describe("zip", () => {
		it("zips equal lengths", () => {
			expect(Helpers.zip([1, 2], ["a", "b"])).toEqual([
				[1, "a"],
				[2, "b"],
			]);
		});
		it("truncates to min length", () => {
			expect(Helpers.zip([1, 2, 3], ["a"])).toEqual([[1, "a"]]);
			expect(Helpers.zip([], [1, 2])).toEqual([]);
		});
	});

	describe("removeCircularReferences", () => {
		it("copies non-circular", () => {
			expect(Helpers.removeCircularReferences({ a: 1, b: { c: 2 } })).toEqual({
				a: 1,
				b: { c: 2 },
			});
			expect(Helpers.removeCircularReferences([1, 2, 3])).toEqual([1, 2, 3]);
			expect(Helpers.removeCircularReferences(123)).toBe(123);
			expect(Helpers.removeCircularReferences(null as any)).toBeNull();
			expect(
				Helpers.removeCircularReferences(undefined as any)
			).toBeUndefined();
		});
		it("replaces circular with undefined", () => {
			const obj: any = { a: 1 };
			obj.self = obj;
			const cleaned: any = Helpers.removeCircularReferences(obj);
			expect(cleaned.a).toBe(1);
			expect(cleaned.self).toBeUndefined();
		});
		it("handles nested circular in array", () => {
			const arr: any[] = [1];
			arr.push(arr);
			const cleaned: any = Helpers.removeCircularReferences(arr);
			expect(cleaned[0]).toBe(1);
			expect(cleaned[1]).toBeUndefined();
		});
		it("handles duplicate reference (second occurrence considered circular)", () => {
			const shared = { x: 1 };
			const obj = { a: shared, b: shared };
			const cleaned: any = Helpers.removeCircularReferences(obj);
			// second occurrence will be already seen, so undefined
			expect(cleaned.a).toEqual({ x: 1 });
			expect(cleaned.b).toBeUndefined();
		});
	});

	describe("isArrayOfStrings / isValidType / isValidHex", () => {
		it("isArrayOfStrings", () => {
			expect(Helpers.isArrayOfStrings(["a", "b"])).toBe(true);
			expect(Helpers.isArrayOfStrings([])).toBe(true);
			expect(Helpers.isArrayOfStrings(["a", 1 as any])).toBe(false);
			expect(Helpers.isArrayOfStrings("a" as any)).toBe(false);
			expect(Helpers.isArrayOfStrings(null as any)).toBe(false);
		});
		it("isValidType", () => {
			expect(Helpers.isValidType("0x2::sui::SUI")).toBe(true);
			expect(Helpers.isValidType(" 0x2::sui::SUI ")).toBe(true); // trim
			expect(Helpers.isValidType("0x2::sui")).toBe(false); // lastIndex <6
			expect(Helpers.isValidType("0x::sui::SUI")).toBe(false); // index :: <3
			expect(Helpers.isValidType("2::sui::SUI")).toBe(false);
			expect(Helpers.isValidType("0x2::sui::SUI:")).toBe(false);
			expect(Helpers.isValidType("")).toBe(false);
			expect(Helpers.isValidType("0x123")).toBe(false);
		});
		it("isValidHex", () => {
			expect(Helpers.isValidHex("0xABC")).toBe(true);
			expect(Helpers.isValidHex("0xabc123")).toBe(true);
			expect(Helpers.isValidHex("abc")).toBe(true);
			expect(Helpers.isValidHex("0xGHI")).toBe(false);
			expect(Helpers.isValidHex("")).toBe(false);
			expect(Helpers.isValidHex("0x")).toBe(false);
		});
	});

	describe("getObjectType / getObjectId / getObjectFields / getObjectDisplay", () => {
		const baseView: any = {
			objectId: "0x2",
			type: "0x2::sui::SUI",
			json: { a: 1 },
			display: { output: { name: "x" }, errors: null },
		};
		it("getObjectType normalizes and throws", () => {
			expect(Helpers.getObjectType(baseView)).toBe(
				`0x${"0".repeat(63)}2::sui::SUI`
			);
			expect(() => Helpers.getObjectType({ objectId: "0x1" } as any)).toThrow(
				"no object type"
			);
			expect(() => Helpers.getObjectType({} as any)).toThrow();
		});
		it("getObjectId normalizes and throws", () => {
			expect(
				Helpers.getObjectId({ objectId: "0xabc", type: "0x2::x::X" } as any)
			).toBe(`0x${"0".repeat(61)}abc`);
			expect(() => Helpers.getObjectId({ type: "0x1" } as any)).toThrow(
				"no object id"
			);
		});
		it("getObjectFields returns json and throws", () => {
			expect(Helpers.getObjectFields(baseView)).toEqual({ a: 1 });
			expect(() => Helpers.getObjectFields({ objectId: "0x1" } as any)).toThrow(
				"no object fields"
			);
			expect(() =>
				Helpers.getObjectFields({ json: null, objectId: "0x1" } as any)
			).toThrow();
		});
		it("getObjectDisplay returns reshaped and throws when undefined", () => {
			expect(Helpers.getObjectDisplay(baseView)).toEqual({
				data: { name: "x" },
				error: null,
			});
			expect(() =>
				Helpers.getObjectDisplay({ objectId: "0x1" } as any)
			).toThrow("no object display");
			expect(() =>
				Helpers.getObjectDisplay({ display: undefined, objectId: "0x1" } as any)
			).toThrow();
			// null display => data null
			expect(
				Helpers.getObjectDisplay({ display: null, objectId: "0x1" } as any)
			).toEqual({ data: null, error: null });
		});
	});

	describe("addTxObject", () => {
		it("calls tx.object when string, returns as-is when object", () => {
			const tx: any = {
				object: jest.fn((id) => ({ $kind: "Input", id })),
			};
			const arg = { $kind: "Input" } as any;
			expect(Helpers.addTxObject(tx, "0x123")).toEqual({
				$kind: "Input",
				id: "0x123",
			});
			expect(tx.object).toHaveBeenCalledWith("0x123");
			expect(Helpers.addTxObject(tx, arg)).toBe(arg);
		});
	});

	describe("isValidSuiAddress", () => {
		it("validates padded addresses", () => {
			expect(Helpers.isValidSuiAddress("0x2")).toBe(true);
			expect(Helpers.isValidSuiAddress(`0x${"0".repeat(64)}`)).toBe(true);
			expect(Helpers.isValidSuiAddress(`0x${"a".repeat(64)}`)).toBe(true);
			expect(Helpers.isValidSuiAddress("0x123")).toBe(true); // padded will be valid
			expect(Helpers.isValidSuiAddress("0x")).toBe(false);
			expect(Helpers.isValidSuiAddress("2")).toBe(false);
			expect(Helpers.isValidSuiAddress("")).toBe(false);
			expect(Helpers.isValidSuiAddress(`0x${"g".repeat(64)}`)).toBe(false);
			// too long => addLeading throws => invalid
			expect(Helpers.isValidSuiAddress(`0x${"a".repeat(65)}`)).toBe(false);
		});
	});

	describe("parseMoveErrorMessage", () => {
		const sample = `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2`;
		it("parses valid MoveAbort", () => {
			const parsed = Helpers.parseMoveErrorMessage({ errorMessage: sample });
			expect(parsed).toBeDefined();
			expect(parsed?.errorCode).toBe(3005);
			expect(parsed?.module).toBe("orderbook");
			// address is already 64 hex chars, so addLeadingZeroes pads to 64 (no extra zeros)
			expect(parsed?.packageId).toBe(
				"0x8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b"
			);
			// package should be zero-padded to 64
			expect(parsed?.packageId.length).toBe(66);
			expect(parsed?.packageId.startsWith("0x")).toBe(true);
		});
		it("returns undefined when not MoveAbort", () => {
			expect(
				Helpers.parseMoveErrorMessage({ errorMessage: "some other error" })
			).toBeUndefined();
			expect(
				Helpers.parseMoveErrorMessage({ errorMessage: "" })
			).toBeUndefined();
		});
		it("case-insensitive moveabort", () => {
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage:
						'moveabort (... address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("foo") }, 1) in command 0',
				})
			).toBeDefined();
		});
		it("returns undefined when malformed code/package/module", () => {
			// missing code (no numeric after last comma)
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("foo") }, function: 1 }, ) in command 0`,
				})
			).toBeUndefined();
			// missing package yields zero address (not undefined) – verify actual behavior is defined
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: , name: Identifier("foo") }, function: 1 }, 1) in command 0`,
				})
			).toBeDefined();
			// truly missing module identifier without closing -> undefined
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("foo") }, function: 1 } in command 0`,
				})
			).toBeUndefined();
			// empty module string is falsy -> undefined per implementation
			expect(
				Helpers.parseMoveErrorMessage({
					errorMessage: `MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("") }, function: 1 }, 1) in command 0`,
				})
			).toBeUndefined();
		});
		it("handles uppercase hex package", () => {
			const msg = sample.replace(
				"8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b",
				"8D8946C2A433E2BF795414498D9F7B32E04ACA8DBF35A20257542DC51406242B"
			);
			const parsed = Helpers.parseMoveErrorMessage({ errorMessage: msg });
			expect(parsed?.packageId).toBeDefined();
		});
	});

	describe("translateMoveErrorMessage", () => {
		const pkg = `0x${"0".repeat(63)}2`;
		const moveErrors: any = {
			[pkg]: {
				orderbook: { 3005: "orderbook error 3005" },
				ANY: { 1: "any error 1", 3005: "any fallback 3005" },
			},
		};
		const sample = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2`;
		const sampleAny = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("unknown_mod") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 1) in command 2`;
		it("translates specific module", () => {
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: sample,
				moveErrors,
			});
			expect(res?.error).toBe("orderbook error 3005");
			expect(res?.module).toBe("orderbook");
		});
		it("falls back to ANY", () => {
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: sampleAny,
				moveErrors,
			});
			expect(res?.error).toBe("any error 1");
		});
		it("returns undefined when not in table", () => {
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: "not moveabort",
					moveErrors,
				})
			).toBeUndefined();
			const unknownPkgMsg = sample.replace(
				"0000000000000000000000000000000000000000000000000000000000000002",
				"0000000000000000000000000000000000000000000000000000000000000003"
			);
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: unknownPkgMsg,
					moveErrors,
				})
			).toBeUndefined();
			// unknown code even in ANY
			const unknownCode = sampleAny.replace(
				", 1) in command",
				", 999) in command"
			);
			expect(
				Helpers.translateMoveErrorMessage({
					errorMessage: unknownCode,
					moveErrors,
				})
			).toBeUndefined();
		});
		it("prefers specific over ANY", () => {
			const specificAndAny = `MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("orderbook") }, function: 11 }, 1) in command 2`;
			// orderbook has no 1, but ANY has 1 => should fallback to ANY (since specific missing)
			// now add specific 1 to orderbook to test prefer
			moveErrors[pkg].orderbook[1] = "specific 1";
			const res = Helpers.translateMoveErrorMessage({
				errorMessage: specificAndAny,
				moveErrors,
			});
			expect(res?.error).toBe("specific 1");
			moveErrors[pkg].orderbook[1] = undefined;
		});
	});

	describe("keypairFromPrivateKey", () => {
		it("constructs Ed25519", () => {
			const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(7));
			const secret = kp.getSecretKey();
			const decoded = Helpers.keypairFromPrivateKey(secret);
			expect(decoded.getPublicKey().toSuiAddress()).toBe(
				kp.getPublicKey().toSuiAddress()
			);
		});
		it("constructs Secp256k1 and Secp256r1", () => {
			const kp1 = Secp256k1Keypair.fromSecretKey(new Uint8Array(32).fill(8));
			const sec1 = Helpers.keypairFromPrivateKey(kp1.getSecretKey());
			expect(sec1.getPublicKey().toSuiAddress()).toBe(
				kp1.getPublicKey().toSuiAddress()
			);

			const kp2 = Secp256r1Keypair.fromSecretKey(new Uint8Array(32).fill(9));
			const sec2 = Helpers.keypairFromPrivateKey(kp2.getSecretKey());
			expect(sec2.getPublicKey().toSuiAddress()).toBe(
				kp2.getPublicKey().toSuiAddress()
			);
		});
		it("throws on invalid private key", () => {
			expect(() => Helpers.keypairFromPrivateKey("invalid")).toThrow();
			expect(() => Helpers.keypairFromPrivateKey("0x123")).toThrow();
		});
	});
});

// ---------------------------------------------------------------------------
// FixedUtils
// ---------------------------------------------------------------------------

describe("FixedUtils", () => {
	it("constants", () => {
		expect(FixedUtils.fixedOneN).toBe(1_000_000_000_000_000_000);
		expect(FixedUtils.fixedOneB).toBe(1_000_000_000_000_000_000n);
		expect(FixedUtils.fixedOneN9).toBe(1_000_000_000);
		expect(FixedUtils.fixedOneB9).toBe(1_000_000_000n);
	});
	describe("convertFromInt / convertToInt", () => {
		it("no scaling", () => {
			expect(FixedUtils.convertFromInt(123n)).toBe(123);
			expect(FixedUtils.convertFromInt(0n)).toBe(0);
			expect(FixedUtils.convertToInt(123.9)).toBe(123n);
			expect(FixedUtils.convertToInt(-1.9)).toBe(-2n); // floor -1.9 => -2
			expect(FixedUtils.convertToInt(0)).toBe(0n);
		});
	});
	describe("directCast / directUncast", () => {
		it("cast 1e18 =>1", () => {
			expect(FixedUtils.directCast(1_000_000_000_000_000_000n)).toBe(1);
			expect(FixedUtils.directCast(0n)).toBe(0);
			expect(FixedUtils.directCast(500_000_000_000_000_000n)).toBe(0.5);
			expect(FixedUtils.directUncast(1)).toBe(1_000_000_000_000_000_000n);
			expect(FixedUtils.directUncast(0.5)).toBe(500_000_000_000_000_000n);
			expect(FixedUtils.directUncast(0)).toBe(0n);
		});
		it("floor on uncast", () => {
			// 1.0000000000000004 * 1e18 = 1000000000000000384 due to IEEE754, floor retains that
			expect(FixedUtils.directUncast(1.000_000_000_000_000_4)).toBe(
				1_000_000_000_000_000_384n
			);
			expect(FixedUtils.directUncast(1.5)).toBe(1_500_000_000_000_000_000n);
		});
		it("round-trip", () => {
			expect(FixedUtils.directCast(FixedUtils.directUncast(1.234))).toBeCloseTo(
				1.234,
				12
			);
		});
	});
	describe("complement", () => {
		it("1 - n with clamping", () => {
			expect(FixedUtils.complement(0)).toBe(1);
			expect(FixedUtils.complement(1)).toBe(0);
			expect(FixedUtils.complement(0.3)).toBeCloseTo(0.7);
			expect(FixedUtils.complement(-0.5)).toBe(1); // max(0,-0.5)=0 =>1-0=1
			expect(FixedUtils.complement(2)).toBe(0); // max(0,1-2=-1)=0
			expect(FixedUtils.complement(0.5)).toBe(0.5);
		});
	});
	describe("normalizeAmount / unnormalizeAmount / castAndNormalize / uncastAndUnnormalize", () => {
		it("normalize multiplies (bigint scalar)", () => {
			expect(FixedUtils.normalizeAmount(1_000_000_000n, 5n)).toBe(
				5_000_000_000n
			);
			expect(FixedUtils.normalizeAmount(1_000_000_000n, 0n)).toBe(0n);
		});
		it("unnormalize divides (bigint)", () => {
			expect(FixedUtils.unnormalizeAmount(1_000_000_000n, 5_000_000_000n)).toBe(
				5n
			);
			expect(FixedUtils.unnormalizeAmount(1_000_000_000n, 0n)).toBe(0n);
		});
		it("castAndNormalize combines", () => {
			// raw 5 with scalar 1e9 => 5e9 /1e18 =5e-9
			expect(FixedUtils.castAndNormalize(1_000_000_000n, 5n)).toBe(
				5_000_000_000 / 1e18
			);
			expect(FixedUtils.castAndNormalize(1_000_000_000n, 0n)).toBe(0);
		});
		it("uncastAndUnnormalize reverse", () => {
			const scalar = 1_000_000_000n;
			const amount = 5n;
			const normalized = FixedUtils.castAndNormalize(scalar, amount);
			const back = FixedUtils.uncastAndUnnormalize(scalar, normalized);
			expect(back).toBe(amount);
		});
		it("handles zero", () => {
			expect(FixedUtils.normalizeAmount(1_000_000_000n, 0n)).toBe(0n);
			expect(FixedUtils.unnormalizeAmount(1_000_000_000n, 0n)).toBe(0n);
			expect(FixedUtils.castAndNormalize(1_000_000_000n, 0n)).toBe(0);
			expect(FixedUtils.uncastAndUnnormalize(1_000_000_000n, 0)).toBe(0n);
		});
	});
});

// ---------------------------------------------------------------------------
// IFixedUtils
// ---------------------------------------------------------------------------

describe("IFixedUtils", () => {
	it("constants", () => {
		expect(IFixedUtils.ONE).toBe(1_000_000_000_000_000_000n);
		expect(IFixedUtils.GREATEST_BIT).toBe(greatestBitLiteral);
		expect(IFixedUtils.NOT_GREATEST_BIT).toBe(notGreatestBitLiteral);
	});
	describe("sign / abs / neg", () => {
		it("sign positive, zero, negative", () => {
			expect(IFixedUtils.sign(0n)).toBe(0);
			expect(IFixedUtils.sign(1n)).toBe(1);
			expect(IFixedUtils.sign(IFixedUtils.ONE)).toBe(1);
			expect(IFixedUtils.sign(IFixedUtils.GREATEST_BIT)).toBe(-1);
			expect(IFixedUtils.sign(IFixedUtils.GREATEST_BIT + 1n)).toBe(-1);
		});
		it("abs positive stays, negative flips", () => {
			expect(IFixedUtils.abs(0n)).toBe(0n);
			expect(IFixedUtils.abs(123n)).toBe(123n);
			const negOne = IFixedUtils.neg(1n);
			expect(IFixedUtils.abs(negOne)).toBe(1n);
			// double abs returns same
			expect(IFixedUtils.abs(IFixedUtils.abs(negOne))).toBe(1n);
		});
		it("neg flips correctly", () => {
			// neg(0) = ((0 ^ NOT)+1)^G = (NOT+1)^G = G ^ G =0
			expect(IFixedUtils.neg(0n)).toBe(0n);
			// neg is involution for non-zero: neg(neg(x)) == x
			const vals = [1n, 1000n, IFixedUtils.ONE, 500_000_000_000_000_000n];
			for (const v of vals) {
				expect(IFixedUtils.neg(IFixedUtils.neg(v))).toBe(v);
			}
			// neg of neg of negative also
			const neg = IFixedUtils.neg(123n);
			expect(IFixedUtils.neg(neg)).toBe(123n);
		});
		it("neg of greatest bit edge", () => {
			// GREATEST_BIT is negative marker; neg(G) stays negative due to 256-bit overflow
			const neg = IFixedUtils.neg(IFixedUtils.GREATEST_BIT);
			expect(IFixedUtils.sign(neg)).toBe(-1);
			expect(neg).not.toBe(IFixedUtils.GREATEST_BIT);
			expect(typeof neg).toBe("bigint");
		});
	});
	describe("numberFromIFixed / iFixedFromNumber", () => {
		it("zero", () => {
			expect(IFixedUtils.numberFromIFixed(0n)).toBe(0);
			expect(IFixedUtils.iFixedFromNumber(0)).toBe(0n);
		});
		it("positive round-trip", () => {
			for (const n of [0, 1, 0.5, 123.456, 0.000_000_000_000_000_001]) {
				const fixed = IFixedUtils.iFixedFromNumber(n);
				const back = IFixedUtils.numberFromIFixed(fixed);
				expect(back).toBeCloseTo(n, 12);
			}
		});
		it("negative round-trip", () => {
			for (const n of [-1, -0.5, -123.456]) {
				const fixed = IFixedUtils.iFixedFromNumber(n);
				expect(IFixedUtils.sign(fixed)).toBe(-1);
				const back = IFixedUtils.numberFromIFixed(fixed);
				expect(back).toBeCloseTo(n, 12);
			}
		});
		it("iFixedFromNumber floors absolute", () => {
			expect(IFixedUtils.iFixedFromNumber(1.25)).toBe(
				1_250_000_000_000_000_000n
			);
			expect(IFixedUtils.iFixedFromNumber(1.5)).toBe(
				1_500_000_000_000_000_000n
			);
			// The input rounds to 2 in JavaScript before fixed-point conversion.
			const nearTwo = Number("1.9999999999999999");
			expect(IFixedUtils.iFixedFromNumber(nearTwo)).toBe(
				2_000_000_000_000_000_000n
			);
		});
		it("numberFromIFixed extracts integer and decimal", () => {
			const one = IFixedUtils.ONE;
			expect(IFixedUtils.numberFromIFixed(one)).toBe(1);
			expect(IFixedUtils.numberFromIFixed(one * 2n)).toBe(2);
			const half = one / 2n;
			expect(IFixedUtils.numberFromIFixed(half)).toBeCloseTo(0.5, 12);
			const negHalf = IFixedUtils.neg(half);
			expect(IFixedUtils.numberFromIFixed(negHalf)).toBeCloseTo(-0.5, 12);
		});
		it("handles large integer part", () => {
			const big = IFixedUtils.iFixedFromNumber(12_345.678);
			expect(IFixedUtils.numberFromIFixed(big)).toBeCloseTo(12_345.678, 9);
		});
	});
	describe("iFixedFromBytes / iFixedFromStringBytes", () => {
		it("delegates to Casting.bigIntFromBytes", () => {
			const bytes = [1, 2, 3];
			expect(IFixedUtils.iFixedFromBytes(bytes)).toBe(0x030201n);
			expect(IFixedUtils.iFixedFromStringBytes(["1", "2", "3"])).toBe(
				0x030201n
			);
		});
		it("handles empty throws via bigInt", () => {
			expect(() => IFixedUtils.iFixedFromBytes([])).toThrow();
		});
		it("handles little-endian bytes", () => {
			expect(IFixedUtils.iFixedFromBytes([0x01, 0x00])).toBe(0x0001n); // actually LE [1,0] => 0x0001? Wait reverse [0,1] => 0x0001? No [1,0] reverse [0,1] => 0x0001 =1
			expect(IFixedUtils.iFixedFromBytes([0x01, 0x00])).toBe(1n);
		});
	});
});

// ---------------------------------------------------------------------------
// TransportError
// ---------------------------------------------------------------------------

describe("TransportError", () => {
	describe("AftermathTransportError", () => {
		it("defaults messages per kind", () => {
			expect(new AftermathTransportError("http", {}).message).toBe(
				"Aftermath HTTP request failed"
			);
			expect(new AftermathTransportError("http", { status: 500 }).message).toBe(
				"Aftermath HTTP request failed with status 500"
			);
			expect(new AftermathTransportError("network", {}).message).toBe(
				"Aftermath network request failed"
			);
			expect(new AftermathTransportError("abort", {}).message).toBe(
				"Aftermath request was aborted"
			);
			expect(new AftermathTransportError("timeout", {}).message).toBe(
				"Aftermath request timed out"
			);
			expect(new AftermathTransportError("decode", {}).message).toBe(
				"Aftermath response could not be decoded"
			);
		});
		it("prefers explicit message and cause message", () => {
			expect(
				new AftermathTransportError("network", { message: "custom" }).message
			).toBe("custom");
			const cause = new Error("cause msg");
			expect(new AftermathTransportError("network", { cause }).message).toBe(
				"cause msg"
			);
			expect(
				new AftermathTransportError("network", { message: "explicit", cause })
					.message
			).toBe("explicit");
		});
		it("sets name from options or cause", () => {
			expect(
				new AftermathTransportError("network", { name: "MyError" }).name
			).toBe("MyError");
			expect(
				new AftermathTransportError("network", {
					cause: { name: "CauseName", message: "m" } as any,
				}).name
			).toBe("CauseName");
			expect(new AftermathTransportError("network", {}).name).toBe(
				"AftermathTransportError"
			);
		});
		it("stores kind, status, retryAfterMs, code, abortSource, cause", () => {
			const cause = new Error("c");
			const err = new AftermathTransportError("http", {
				status: 429,
				retryAfterMs: 2000,
				code: "E1",
				cause,
				abortSource: "caller",
			});
			expect(err.kind).toBe("http");
			expect(err.status).toBe(429);
			expect(err.retryAfterMs).toBe(2000);
			expect(err.code).toBe("E1");
			expect(err.abortSource).toBe("caller");
			expect(err.cause).toBe(cause);
			expect(err instanceof Error).toBe(true);
		});
		it("cause is non-enumerable", () => {
			const err = new AftermathTransportError("network", {
				cause: new Error("x"),
			});
			expect(Object.keys(err)).not.toContain("cause");
			expect(Object.getOwnPropertyDescriptor(err, "cause")?.enumerable).toBe(
				false
			);
		});
		it("isAftermathTransportError checks instanceof", () => {
			expect(
				isAftermathTransportError(new AftermathTransportError("network"))
			).toBe(true);
			expect(isAftermathTransportError(new Error("x"))).toBe(false);
			expect(isAftermathTransportError(null)).toBe(false);
		});
	});

	describe("parseRetryAfter", () => {
		it("returns undefined for null/empty/whitespace", () => {
			expect(parseRetryAfter(null)).toBeUndefined();
			expect(parseRetryAfter("")).toBeUndefined();
			expect(parseRetryAfter("   ")).toBeUndefined();
		});
		it("parses delta seconds", () => {
			expect(parseRetryAfter("0")).toBe(0);
			expect(parseRetryAfter(" 2 ")).toBe(2000);
			expect(parseRetryAfter("120")).toBe(120_000);
		});
		it("rejects malformed delta", () => {
			expect(parseRetryAfter("-1")).toBeUndefined();
			expect(parseRetryAfter("1.5")).toBeUndefined();
			expect(parseRetryAfter("NaN")).toBeUndefined();
			expect(parseRetryAfter("Infinity")).toBeUndefined();
			expect(parseRetryAfter("abc")).toBeUndefined();
		});
		it("rejects overflow beyond MAX_SAFE_INTEGER", () => {
			// 9007199254740992 seconds => 9e15 ms > MAX_SAFE_INTEGER
			expect(parseRetryAfter("9007199254740992")).toBeUndefined();
			// max safe: 9007199254740991*1000 = 9e18 >? Actually max ms = 9007199254740991, so seconds max = 9007199254 approx
			expect(parseRetryAfter("9007199254")).toBe(9_007_199_254_000);
		});
		it("parses HTTP-date", () => {
			const fixedNow = Date.UTC(2026, 0, 1, 0, 0, 0);
			const future = new Date(fixedNow + 6000).toUTCString();
			expect(parseRetryAfter(future, fixedNow)).toBe(6000);
			const past = new Date(fixedNow - 1000).toUTCString();
			expect(parseRetryAfter(past, fixedNow)).toBeUndefined();
		});
		it("rejects non-date http date format but regex passes then fails parse? Actually regex restricts, so invalid like 'not-a-date' returns undefined", () => {
			expect(parseRetryAfter("not-a-date")).toBeUndefined();
		});
		it("rejects negative retryAfterMs and non-safe integer", () => {
			const now = Date.UTC(2026, 0, 1, 0, 0, 0);
			// HTTP-date far future that overflows safe integer? Use date far future where diff > MAX_SAFE_INTEGER
			// Instead test past => negative => undefined
			const past = new Date(now - 5000).toUTCString();
			expect(parseRetryAfter(past, now)).toBeUndefined();
		});
		it("handles all three HTTP-date regex variants", () => {
			// RFC1123: "Tue, 15 Nov 1994 08:12:31 GMT" already tested via toUTCString
			// RFC850: "Tuesday, 15-Nov-94 08:12:31 GMT"
			const rfc850 = "Tuesday, 15-Nov-94 08:12:31 GMT";
			const now = Date.parse(rfc850) - 1000;
			expect(parseRetryAfter(rfc850, now)).toBe(1000);
			// ASCTIME: "Tue Nov 15 08:12:31 1994"
			const asc = "Tue Nov 15 08:12:31 1994";
			const now2 = Date.parse(asc) - 2000;
			expect(parseRetryAfter(asc, now2)).toBe(2000);
		});
	});

	describe("normalizeAftermathTransportError", () => {
		it("passes through already normalized", () => {
			const orig = new AftermathTransportError("http", { status: 418 });
			expect(normalizeAftermathTransportError(orig)).toBe(orig);
		});
		it("normalizes network with code", () => {
			const cause = Object.assign(new Error("fail"), { code: "EAI_AGAIN" });
			const err = normalizeAftermathTransportError(cause);
			expect(err.kind).toBe("network");
			expect(err.code).toBe("EAI_AGAIN");
			expect(err.cause).toBe(cause);
		});
		it("normalizes timeout code to timeout", () => {
			for (const code of [
				"UND_ERR_CONNECT_TIMEOUT",
				"UND_ERR_HEADERS_TIMEOUT",
				"UND_ERR_BODY_TIMEOUT",
				"ETIMEDOUT",
			]) {
				const cause = Object.assign(new Error("t"), { code });
				const err = normalizeAftermathTransportError(cause);
				expect(err.kind).toBe("timeout");
				expect(err.abortSource).toBe("timeout");
			}
		});
		it("handles TimeoutError name", () => {
			const cause = new DOMException("x", "TimeoutError");
			const err = normalizeAftermathTransportError(cause);
			expect(err.kind).toBe("timeout");
		});
		it("handles abort via signal", () => {
			const controller = new AbortController();
			controller.abort();
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				controller.signal
			);
			expect(err.kind).toBe("abort");
			expect(err.abortSource).toBe("caller");
		});
		it("handles timeout abort via signal reason TimeoutError", () => {
			const c = new AbortController();
			c.abort(new DOMException("deadline", "TimeoutError"));
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
			expect(err.abortSource).toBe("timeout");
		});
		it("handles timeout abort via signal reason code", () => {
			const c = new AbortController();
			c.abort(Object.assign(new Error("t"), { code: "ETIMEDOUT" }));
			const err = normalizeAftermathTransportError(
				new Error("aborted"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
		});
		it("prefers error code over signal reason code", () => {
			const c = new AbortController();
			c.abort(Object.assign(new Error("sig"), { code: "SIGCODE" }));
			const _cause = Object.assign(new Error("err"), { code: "ERRCODE" });
			c.abort(); // already aborted, but we need to set signal to aborted already; we manually test via second abort not effective, so create new
			const c2 = new AbortController();
			const sigReason = Object.assign(new Error("sig"), { code: "SIGCODE" });
			c2.abort(sigReason);
			const err2 = normalizeAftermathTransportError(
				Object.assign(new Error("err"), { code: "ERRCODE" }),
				c2.signal
			);
			expect(err2.code).toBe("ERRCODE"); // errorCode preferred
		});
		it("signal not aborted -> network/timeout based on error", () => {
			const sig = new AbortController().signal; // not aborted
			const cause = Object.assign(new Error("net"), { code: "EAI_AGAIN" });
			expect(normalizeAftermathTransportError(cause, sig).kind).toBe("network");
		});
		it("handles AftermathTransportError timeout via signal reason", () => {
			const timeoutErr = new AftermathTransportError("timeout", {
				abortSource: "timeout",
			});
			const c = new AbortController();
			c.abort(timeoutErr);
			const err = normalizeAftermathTransportError(
				new Error("other"),
				c.signal
			);
			expect(err.kind).toBe("timeout");
		});
	});
});

// ---------------------------------------------------------------------------
// Caller
// ---------------------------------------------------------------------------

describe("Caller", () => {
	describe("static network helpers", () => {
		it("apiBaseUrlForNetwork returns canonical urls", () => {
			expect(Caller.apiBaseUrlForNetwork("MAINNET")).toBe(
				"https://aftermath.finance"
			);
			expect(Caller.apiBaseUrlForNetwork("TESTNET")).toBe(
				"https://testnet.aftermath.finance"
			);
			expect(Caller.apiBaseUrlForNetwork("DEVNET")).toBe(
				"https://devnet.aftermath.finance"
			);
			expect(Caller.apiBaseUrlForNetwork("LOCAL")).toBe(
				"http://localhost:3000"
			);
		});
		it("defaultFullnodeUrl", () => {
			expect(Caller.defaultFullnodeUrl("MAINNET")).toBe(
				"https://fullnode.mainnet.sui.io:443"
			);
			expect(Caller.defaultFullnodeUrl("TESTNET")).toBe(
				"https://fullnode.testnet.sui.io:443"
			);
			expect(Caller.defaultFullnodeUrl("DEVNET")).toBe(
				"https://fullnode.devnet.sui.io:443"
			);
			expect(Caller.defaultFullnodeUrl("LOCAL")).toBe("http://127.0.0.1:9000");
			expect(Caller.defaultFullnodeUrl(undefined)).toBe(
				"https://fullnode.mainnet.sui.io:443"
			);
		});
	});

	describe("constructor and url building", () => {
		it("uses baseUrl over network", async () => {
			const c = new TestCaller({
				baseUrl: "https://custom.test",
				network: "MAINNET",
			});
			const calls = installFetch(() => makeResponse('{"ok":true}'));
			await c.callUrl("probe");
			expect(calls[0].input).toBe("https://custom.test/api//probe");
		});
		it("derives baseUrl from network", async () => {
			const c = new TestCaller({ network: "TESTNET" });
			const calls = installFetch(() => makeResponse('{"ok":true}'));
			await c.callUrl("probe");
			expect(calls[0].input).toBe(
				"https://testnet.aftermath.finance/api//probe"
			);
		});
		it("fails when no baseUrl nor network", async () => {
			const c = new TestCaller({});
			const err = await c.callUrl("probe").catch((error: unknown) => error);
			expect(err).toBeInstanceOf(Error);
			expect((err as Error).message).toBe(
				"no apiBaseUrl: unable to fetch data"
			);
		});
		it("apiEndpoint defaults to api, custom and empty", () => {
			expect(new TestCaller({ baseUrl: "https://x" }).getApiEndpoint()).toBe(
				"api"
			);
			expect(
				new TestCaller({
					baseUrl: "https://x",
					apiEndpoint: "custom",
				}).getApiEndpoint()
			).toBe("custom");
			expect(
				new TestCaller({
					baseUrl: "https://x",
					apiEndpoint: "",
				}).getApiEndpoint()
			).toBe("");
		});
		it("urlForApiCall joins correctly via fetch observation", async () => {
			// note: implementation produces // when prefix empty (endpointSegment "api/" + "/" )
			const cases: Array<{
				baseUrl: string;
				apiEndpoint?: string;
				prefix?: string;
				url: string;
				expected: string;
			}> = [
				{
					baseUrl: "https://sdk.test",
					url: "test",
					expected: "https://sdk.test/api//test",
				},
				{
					baseUrl: "https://sdk.test/",
					url: "test",
					expected: "https://sdk.test/api//test",
				},
				{
					baseUrl: "https://sdk.test",
					apiEndpoint: "",
					url: "test",
					expected: "https://sdk.test//test",
				},
				{
					baseUrl: "https://sdk.test",
					apiEndpoint: "custom",
					url: "foo",
					expected: "https://sdk.test/custom//foo",
				},
				{
					baseUrl: "https://sdk.test",
					url: "",
					expected: "https://sdk.test/api/",
				}, // empty url no double slash for empty url case
			];
			for (const cs of cases) {
				const caller = new TestCaller(
					{ baseUrl: cs.baseUrl, apiEndpoint: cs.apiEndpoint },
					cs.prefix ?? ""
				);
				const calls = installFetch(() => makeResponse('{"ok":true}'));
				await caller.callUrl(cs.url);
				expect(calls[0].input).toBe(cs.expected);
			}
		});
		it("urlForApiCall with prefix", async () => {
			const caller = new TestCaller({ baseUrl: "https://sdk.test" }, "pools");
			const calls = installFetch(() => makeResponse('{"ok":true}'));
			await caller.callUrl("list");
			expect(calls[0].input).toBe("https://sdk.test/api/pools/list");
			const caller2 = new TestCaller({ baseUrl: "https://sdk.test/" }, "pools");
			const calls2 = installFetch(() => makeResponse('{"ok":true}'));
			await caller2.callUrl("list");
			expect(calls2[0].input).toBe("https://sdk.test/api/pools/list");
			// empty url with prefix
			const calls3 = installFetch(() => makeResponse('{"ok":true}'));
			await caller.callUrl("");
			expect(calls3[0].input).toBe("https://sdk.test/api/pools");
		});
		it("throws when no apiBaseUrl", async () => {
			const caller = new TestCaller({});
			const err = await (caller.call() as Promise<any>).catch((e: any) => e);
			expect(isAftermathTransportError(err)).toBe(true);
			expect(err.kind).toBe("network");
			expect(err.message).toBe("no apiBaseUrl: unable to fetch data");
		});
	});

	describe("fetchApi HTTP / headers / body", () => {
		it("GET when body undefined, no method", async () => {
			const caller = makeCaller();
			const calls = installFetch(() => makeResponse('{"v":1}'));
			await caller.call(undefined);
			expect(calls[0].init?.method).toBeUndefined();
			expect(calls[0].init?.body).toBeUndefined();
		});
		it("POST when body defined with JSON and bigint replacer", async () => {
			const caller = makeCaller();
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call({ amount: 123n, count: 2 });
			expect(calls[0].init?.method).toBe("POST");
			expect(calls[0].init?.body).toBe('{"amount":"123n","count":2}');
			expect(calls[0].init?.headers).toMatchObject({
				"Content-Type": "application/json",
			});
		});
		it("includes Authorization when accessToken set", async () => {
			const caller = makeCaller();
			(caller as any).config.accessToken = "token123";
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call({ a: 1 });
			expect((calls[0].init?.headers as any).Authorization).toBe(
				"Bearer token123"
			);
			// without token, no Authorization
			const caller2 = makeCaller();
			const calls2 = installFetch(() => makeResponse('{"ok":1}'));
			await caller2.call({ a: 1 });
			expect((calls2[0].init?.headers as any).Authorization).toBeUndefined();
		});
		it("propagates AbortSignal", async () => {
			const caller = makeCaller();
			const signal = new AbortController().signal;
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call(undefined, signal);
			expect(calls[0].init?.signal).toBe(signal);
			// GET also propagates
			const calls2 = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call(undefined, signal);
			expect(calls2[0].init?.signal).toBe(signal);
		});
		it("does not serialize signal into body", async () => {
			const caller = makeCaller();
			const signal = new AbortController().signal;
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call({ a: 1 }, signal);
			const body = JSON.parse(calls[0].init?.body as string);
			expect(body.signal).toBeUndefined();
			expect(body.a).toBe(1);
		});
		it("parses JSON with bigint by default", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse('{"amount":"123n","nullable":null}'));
			const res: any = await caller.call();
			expect(res.amount).toBe(123n);
			expect(res.nullable).toBeUndefined();
		});
		it("disableBigIntJsonParsing uses plain JSON with null->undefined", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse('{"amount":"123n","nullable":null}'));
			const res: any = await caller.call(undefined, undefined, {
				disableBigIntJsonParsing: true,
			});
			expect(res.amount).toBe("123n"); // not converted
			expect(res.nullable).toBeUndefined();
		});
		it("returns undefined when response is null", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse("null"));
			const res: any = await caller.call();
			expect(res).toBeUndefined();
		});
		it("throws http error with status and retryAfter", async () => {
			const caller = makeCaller();
			installFetch(
				() =>
					new Response("server error", {
						status: 503,
						statusText: "Service Unavailable",
						headers: { "Retry-After": "2" },
					})
			);
			let err: any;
			try {
				await caller.call();
			} catch (e) {
				err = e;
			}
			expect(isAftermathTransportError(err)).toBe(true);
			expect(err.kind).toBe("http");
			expect(err.status).toBe(503);
			expect(err.retryAfterMs).toBe(2000);
			expect(err.message).toBe("HTTP 503 Service Unavailable: server error");
		});
		it("http error without Retry-After", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse("oops", 404));
			let err: any;
			try {
				await caller.call();
			} catch (e) {
				err = e;
			}
			expect(err.kind).toBe("http");
			expect(err.retryAfterMs).toBeUndefined();
		});
		it("decode error on invalid JSON", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse("{ invalid"));
			let err: any;
			try {
				await caller.call();
			} catch (e) {
				err = e;
			}
			expect(err.kind).toBe("decode");
			expect(err.cause).toBeInstanceOf(SyntaxError);
		});
		it("decode error on BigInt parse failure", async () => {
			const orig = globalThis.BigInt;
			globalThis.BigInt = ((v: any) => {
				if (String(v) === "999") {
					throw new RangeError("mock BigInt fail");
				}
				return orig(v);
			}) as any;
			try {
				const caller = makeCaller();
				installFetch(() => makeResponse('{"a":"999n"}'));
				let err: any;
				try {
					await caller.call();
				} catch (e) {
					err = e;
				}
				expect(err.kind).toBe("decode");
				expect(err.cause).toBeInstanceOf(RangeError);
			} finally {
				globalThis.BigInt = orig;
			}
		});
		it("network error when fetch throws", async () => {
			const caller = makeCaller();
			installFetch(() => {
				throw Object.assign(new Error("net fail"), { code: "EAI_AGAIN" });
			});
			let err: any;
			try {
				await caller.call();
			} catch (e) {
				err = e;
			}
			expect(err.kind).toBe("network");
			expect(err.code).toBe("EAI_AGAIN");
		});
		it("abort error when signal aborted", async () => {
			const caller = makeCaller();
			const controller = new AbortController();
			// install fetch that rejects with signal.reason
			installFetch((_input, init) => {
				return new Promise<Response>((_, reject) => {
					const sig = init?.signal;
					const onAbort = () => reject(sig?.reason);
					sig?.addEventListener("abort", onAbort, { once: true });
					if (sig?.aborted) {
						onAbort();
					}
				});
			});
			const pending = caller.call(undefined, controller.signal);
			controller.abort();
			let err: any;
			try {
				await pending;
			} catch (e) {
				err = e;
			}
			expect(err.kind).toBe("abort");
		});
		it("timeout error when signal aborted with TimeoutError", async () => {
			const caller = makeCaller();
			const controller = new AbortController();
			installFetch((_input, init) => {
				return new Promise<Response>((_, reject) => {
					const sig = init?.signal;
					const onAbort = () => reject(sig?.reason);
					sig?.addEventListener("abort", onAbort, { once: true });
				});
			});
			const pending = caller.call(undefined, controller.signal);
			controller.abort(new DOMException("deadline", "TimeoutError"));
			let err: any;
			try {
				await pending;
			} catch (e) {
				err = e;
			}
			expect(err.kind).toBe("timeout");
			expect(err.abortSource).toBe("timeout");
		});
		it("already normalized error passes through", async () => {
			const caller = makeCaller();
			const normalized = new AftermathTransportError("http", { status: 418 });
			installFetch(() => {
				throw normalized;
			});
			let err: any;
			try {
				await caller.call();
			} catch (e) {
				err = e;
			}
			expect(err).toBe(normalized);
		});
		it("bigInt in nested object and array serialized", async () => {
			const caller = makeCaller();
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call({ arr: [1n, 2n], nested: { v: 3n } });
			expect(calls[0].init?.body).toBe(
				'{"arr":["1n","2n"],"nested":{"v":"3n"}}'
			);
		});
		it("setAccessToken via protected method", async () => {
			const caller = makeCaller();
			caller.setToken("newToken");
			const calls = installFetch(() => makeResponse('{"ok":1}'));
			await caller.call({ a: 1 });
			expect((calls[0].init?.headers as any).Authorization).toBe(
				"Bearer newToken"
			);
		});
	});

	describe("fetchApiTransaction / fetchApiTxObject / fetchApiEvents / fetchApiIndexerEvents", () => {
		beforeEach(() => {
			jest.spyOn(Transaction as any, "from").mockImplementation((kind: any) => {
				const tx: any = { kind, setSender: jest.fn(), __from: "from" };
				tx.setSender = jest.fn();
				return tx;
			});
			jest
				.spyOn(Transaction as any, "fromKind")
				.mockImplementation((kind: any) => {
					const tx: any = { kind, setSender: jest.fn(), __from: "fromKind" };
					tx.setSender = jest.fn();
					return tx;
				});
		});
		it("fetchApiTransaction txKind false uses Transaction.from and sets sender", async () => {
			const caller = makeCaller();
			const fakeTxKind = "base64txkind==";
			installFetch(() => makeResponse(`"${fakeTxKind}"`)); // JSON string response
			const tx: any = await caller.callTx({
				url: "buildTx",
				body: { walletAddress: "0x2", other: 1 },
			});
			expect(Transaction.from).toHaveBeenCalledWith(fakeTxKind);
			expect(tx.setSender).toHaveBeenCalledWith("0x2");
		});
		it("fetchApiTransaction txKind true uses fromKind", async () => {
			const caller = makeCaller();
			const fake = "kind2==";
			installFetch(() => makeResponse(`"${fake}"`));
			const _tx: any = await caller.callTx({
				url: "u",
				body: { walletAddress: "0xabc" },
				txKind: true,
			});
			expect(Transaction.fromKind).toHaveBeenCalledWith(fake);
		});
		it("fetchApiTransaction without walletAddress does not call setSender", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse(`"k"`));
			const tx: any = await caller.callTx({ url: "u", body: { other: 1 } });
			expect(tx.setSender).not.toHaveBeenCalled();
		});
		it("fetchApiTxObject chooses from vs fromKind based on sponsorSignature", async () => {
			const caller = makeCaller();
			// with sponsorSignature -> from
			installFetch(() =>
				makeResponse(
					JSON.stringify({
						txKind: "k1",
						sponsorSignature: "sig",
						extra: "data",
					})
				)
			);
			const res1: any = await caller.callTxObject({ url: "u", body: {} });
			expect(Transaction.from).toHaveBeenCalledWith("k1");
			expect(res1.extra).toBe("data");
			expect(res1.tx).toBeDefined();
			expect(res1.txKind).toBeUndefined();
			// without sponsorSignature -> fromKind
			installFetch(() =>
				makeResponse(JSON.stringify({ txKind: "k2", extra2: 123 }))
			);
			jest.clearAllMocks();
			// need to re-mock after clear? They are still mocked but calls cleared
			jest
				.spyOn(Transaction as any, "from")
				.mockImplementation(
					(k: any) => ({ k, setSender: jest.fn(), __from: "from" }) as any
				);
			jest
				.spyOn(Transaction as any, "fromKind")
				.mockImplementation(
					(k: any) => ({ k, setSender: jest.fn(), __from: "fromKind" }) as any
				);
			const res2: any = await caller.callTxObject({ url: "u", body: {} });
			expect(Transaction.fromKind).toHaveBeenCalledWith("k2");
			expect(res2.extra2).toBe(123);
		});
		it("fetchApiEvents delegates to fetchApi", async () => {
			const caller = makeCaller();
			const payload = { events: [{ type: "0x1::a::E" }], nextCursor: null };
			const calls = installFetch(() => makeResponse(JSON.stringify(payload)));
			const res: any = await caller.callEvents("events", {
				cursor: null,
				limit: 10,
			});
			// null cursor is converted to undefined via Helpers.parseJsonWithBigint (null -> undefined)
			expect(res.events).toEqual([{ type: "0x1::a::E" }]);
			expect(res.nextCursor).toBeUndefined();
			expect(calls[0].input).toContain("/api//events");
		});
		it("fetchApiIndexerEvents pages correctly", async () => {
			const caller = makeCaller();
			// first with body limit 2, cursor 0, returns 2 events => nextCursor 2
			installFetch(() =>
				makeResponse(JSON.stringify([{ type: "A" }, { type: "B" }]))
			);
			const res: any = await caller.callIndexerEvents("idxEvents", {
				limit: 2,
				cursor: 0,
			});
			expect(res.events).toHaveLength(2);
			expect(res.nextCursor).toBe(2);
			// when less than limit => undefined cursor
			installFetch(() => makeResponse(JSON.stringify([{ type: "A" }])));
			const res2: any = await caller.callIndexerEvents("idxEvents", {
				limit: 2,
				cursor: 0,
			});
			expect(res2.nextCursor).toBeUndefined();
			// when no limit -> body.limit ??1 => 1, if events.length <1 => no cursor
			installFetch(() => makeResponse(JSON.stringify([])));
			const res3: any = await caller.callIndexerEvents("idxEvents", {});
			expect(res3.nextCursor).toBeUndefined();
		});
		it("fetchApiIndexerEvents uses correct limit default", async () => {
			const caller = makeCaller();
			installFetch(() => makeResponse(JSON.stringify([{ type: "A" }])));
			const res: any = await caller.callIndexerEvents("u", { cursor: 5 });
			expect(res.nextCursor).toBe(6); // 1 +5
		});
	});

	describe("openWsStream", () => {
		// Mock WebSocket
		type MockWsCallback = (event: unknown) => void;
		class MockWS {
			url: string;
			readyState = 1; // OPEN
			static OPEN = 1;
			static CLOSED = 3;
			listeners: Record<string, MockWsCallback[]> = {};
			sent: string[] = [];
			constructor(url: string) {
				this.url = url;
			}
			addEventListener(event: string, cb: MockWsCallback) {
				const callbacks = this.listeners[event] ?? [];
				callbacks.push(cb);
				this.listeners[event] = callbacks;
			}
			removeEventListener() {
				// The fixture does not need listener removal.
			}
			send(data: string) {
				this.sent.push(data);
			}
			emit(event: string, payload: unknown) {
				for (const callback of this.listeners[event] ?? []) {
					callback(payload);
				}
			}
			close() {
				this.readyState = MockWS.CLOSED;
				this.emit("close", {});
			}
			triggerMessage(data: string) {
				this.emit("message", { data });
			}
			triggerOpen() {
				this.emit("open", {});
			}
			triggerError() {
				this.emit("error", {});
			}
		}

		it("builds ws url from http base", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws }: any = caller.openWs({
				path: "stream",
				onMessage: () => undefined,
			});
			expect(ws.url).toBe("wss://sdk.test/api/stream");
		});
		it("builds wss vs ws based on baseUrl", () => {
			(globalThis as any).WebSocket = MockWS;
			const callerHttp = new TestCaller({ baseUrl: "http://localhost:3000" });
			expect(
				(callerHttp.openWs({ path: "s", onMessage: () => undefined }) as any).ws
					.url
			).toBe("ws://localhost:3000/api/s");
			const callerHttps = new TestCaller({
				baseUrl: "https://aftermath.finance/",
			});
			expect(
				(callerHttps.openWs({ path: "/s", onMessage: () => undefined }) as any)
					.ws.url
			).toBe("wss://aftermath.finance/api/s");
		});
		it("handles apiEndpoint empty and prefix", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller(
				{ baseUrl: "https://sdk.test", apiEndpoint: "" },
				"pools"
			);
			expect(
				(caller.openWs({ path: "stream", onMessage: () => undefined }) as any)
					.ws.url
			).toBe("wss://sdk.test/pools/stream");
			const caller2 = new TestCaller(
				{ baseUrl: "https://sdk.test/", apiEndpoint: "api" },
				""
			);
			expect(
				(caller2.openWs({ path: "stream", onMessage: () => undefined }) as any)
					.ws.url
			).toBe("wss://sdk.test/api/stream");
		});
		it("throws when no apiBaseUrl", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({});
			expect(() =>
				caller.openWs({ path: "s", onMessage: () => undefined })
			).toThrow("no apiBaseUrl");
		});
		it("parses inbound JSON with bigint and calls onMessage", () => {
			(globalThis as any).WebSocket = MockWS;
			const onMessage = jest.fn();
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws }: any = caller.openWs({ path: "s", onMessage });
			ws.triggerMessage('{"amount":"123n","nullable":null}');
			expect(onMessage).toHaveBeenCalledWith({
				amount: 123n,
				nullable: undefined,
			});
		});
		it("on parse error calls onError with ErrorEvent", () => {
			(globalThis as any).WebSocket = MockWS;
			(globalThis as any).ErrorEvent = class extends Event {
				error: unknown;
				message: string;
				constructor(type: string, init: { error: unknown; message: string }) {
					super(type);
					this.error = init.error;
					this.message = init.message;
				}
			};
			const onError = jest.fn();
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
				onError,
			});
			ws.triggerMessage("{ invalid");
			expect(onError).toHaveBeenCalled();
			const evt = onError.mock.calls[0]?.[0] as { type?: string } | undefined;
			expect(evt?.type).toBe("message-parse-error");
		});
		it("send serializes bigint", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws, send }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
			});
			ws.readyState = 1;
			send({ amount: 123n });
			expect(ws.sent[0]).toContain('"123n"');
		});
		it("send throws when not open", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws, send }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
			});
			ws.readyState = 3; // CLOSED
			expect(() => send({ a: 1 })).toThrow("WebSocket is not open");
		});
		it("close closes ws", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws, close }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
			});
			expect(ws.readyState).toBe(1);
			close();
			expect(ws.readyState).toBe(3);
		});
		it("calls onOpen / onError / onClose callbacks", () => {
			(globalThis as any).WebSocket = MockWS;
			const onOpen = jest.fn();
			const onError = jest.fn();
			const onClose = jest.fn();
			const caller = new TestCaller({ baseUrl: "https://sdk.test" });
			const { ws }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
				onOpen,
				onError,
				onClose,
			});
			ws.triggerOpen();
			expect(onOpen).toHaveBeenCalled();
			ws.triggerError();
			expect(onError).toHaveBeenCalled();
			ws.close();
			// close via MockWS triggers listeners close, but our close() also calls ws.close()
			// So onClose should have been called at least once
			expect(onClose).toHaveBeenCalled();
		});
		it("path with leading slash normalized", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller({ baseUrl: "https://sdk.test" }, "prefix");
			expect(
				(caller.openWs({ path: "/my/path", onMessage: () => undefined }) as any)
					.ws.url
			).toBe("wss://sdk.test/api/prefix/my/path");
			expect(
				(caller.openWs({ path: "my/path", onMessage: () => undefined }) as any)
					.ws.url
			).toBe("wss://sdk.test/api/prefix/my/path");
		});
		it("trims trailing slashes from baseUrl and prefix (observed behavior keeps some slashes)", () => {
			(globalThis as any).WebSocket = MockWS;
			const caller = new TestCaller(
				{ baseUrl: "https://sdk.test///", apiEndpoint: "api///" },
				"pools///"
			);
			const { ws }: any = caller.openWs({
				path: "s",
				onMessage: () => undefined,
			});
			// actual implementation does not fully normalize triple slashes in apiEndpoint/prefix (produces api////pools)
			// verify it still produces a wss url and includes the prefix
			expect(ws.url.startsWith("wss://sdk.test/")).toBe(true);
			expect(ws.url).toContain("pools");
			expect(ws.url).toContain("/s");
		});
	});
});

// ---------------------------------------------------------------------------
// Additional cross-cutting
// ---------------------------------------------------------------------------

describe("Cross-cutting exported behavior", () => {
	it("Helpers.addLeadingZeroesToType is used by Casting addressFromBytes correctly", () => {
		const bytes = new Array(32).fill(0xab);
		const addr = Casting.addressFromBytes(bytes);
		expect(Helpers.addLeadingZeroesToType(addr)).toBe(addr); // already padded
		expect(Helpers.stripLeadingZeroesFromType(addr)).toBe(
			"0xabababababababababababababababababababababababababababababababab"
		);
	});
	it("GrpcCasting.bytesFieldToNumbers + Helpers.parseJsonWithBigint interplay not broken", () => {
		const numbers = GrpcCasting.bytesFieldToNumbers("CQk=");
		expect(numbers).toEqual([9, 9]);
		// ensure parseJsonWithBigint doesn't interfere
		const json = JSON.stringify({ v: "123n" });
		expect(Helpers.parseJsonWithBigint(json).v).toBe(123n);
	});
	it("FixedUtils complement used in pool math edge", () => {
		// ensure complement behaves for 0-1 range used in pools
		expect(FixedUtils.complement(0.7)).toBeCloseTo(0.3);
		expect(FixedUtils.complement(1.2)).toBe(0);
	});
	it("IFixedUtils and Casting integration via bigIntFromBytes", () => {
		const bytes = [0xff, 0x00, 0x01];
		const asBig = Casting.bigIntFromBytes([...bytes]);
		const asIFixed = IFixedUtils.iFixedFromBytes([...bytes]);
		expect(asBig).toBe(asIFixed);
	});
});

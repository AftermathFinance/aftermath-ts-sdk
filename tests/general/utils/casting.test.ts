import {
	bcs,
	Casting,
	FixedUtils,
	IFixedUtils,
} from "@test/general/fixtures/core.js";

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

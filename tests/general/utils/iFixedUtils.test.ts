import {
	greatestBitLiteral,
	IFixedUtils,
	notGreatestBitLiteral,
} from "@test/general/fixtures/core.js";

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

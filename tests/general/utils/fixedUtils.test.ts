import { FixedUtils } from "@test/general/fixtures/core.js";

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

import {
	A,
	B,
	CmmmCalculations,
	describe,
	expect,
	it,
	makePool,
	ONE_FIXED,
} from "@test/packages/pools/fixtures.js";

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
			1.010_101_010_101_010_2,
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
		).toBeCloseTo(0.999_900_01, 6);
		expect(
			CmmmCalculations.getEstimateWithdrawFlpAmountsOut(
				pool,
				{ [A]: 100n, [B]: 100n },
				0.5
			)
		).toBeCloseTo(0.499_950_005, 6);
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

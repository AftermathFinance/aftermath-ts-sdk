import { Fixed } from "../../../dist/general/utils/fixed.js";
import { Helpers } from "../../../dist/general/utils/helpers.js";
import { CmmmCalculations } from "../../../dist/packages/pools/utils/cmmmCalculations.js";

// Intended execution: npm run build && node tests/legacy/manual/stableUnitTests.mjs

const FixedOne = 1_000_000_000_000_000_000n;
const Tolerance = 0.000_000_000_000_1;

const tests = {
	testGetTokenBalanceGivenInvariantAndAllOtherBalances: () => {
		let flatness = 3 / 7;

		const coins = {
			coin0: {
				weight: 280_000_000_000_000_000n,
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin1: {
				weight: 448_000_000_000_000_000n,
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				weight: 272_000_000_000_000_000n,
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const index = "coin1";

		const w = Fixed.directCast(coins[index].weight);
		let [prod, sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			index
		);
		const bi = Fixed.directCast(coins[index].normalizedBalance);

		let bi0 = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
			flatness,
			w,
			h,
			bi / 2,
			p0,
			s0
		);

		let relErr = Math.abs(bi - bi0) / Math.max(bi, bi0);
		if (relErr > 0.000_000_001) {
			return false;
		}

		flatness = 1 - flatness;
		h = CmmmCalculations.calcInvariantQuadratic(prod, sum, flatness);

		bi0 = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
			flatness,
			w,
			h,
			bi * 2,
			p0,
			s0
		);

		relErr = Math.abs(bi - bi0) / Math.max(bi, bi0);
		if (relErr > 0.000_000_001) {
			return false;
		}
		return true;
	},
	testCalcSpotPrice() {
		const flatness = 0.712;

		const coins = {
			coin0: {
				weight: 280_000_000_000_000_000n,
				normalizedBalance: 700000_000_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin1: {
				weight: 448_000_000_000_000_000n,
				normalizedBalance: 400000_000_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				weight: 272_000_000_000_000_000n,
				normalizedBalance: 500000_000_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const indexIn = "coin0";
		const indexOut = "coin2";

		const expectedSpotPrice = 1.289_263_269_312_546_8;

		const calculatedSpotPrice = CmmmCalculations.calcSpotPriceWithFees(
			pool,
			indexIn,
			indexOut
		);

		if (
			!Helpers.closeEnough(expectedSpotPrice, calculatedSpotPrice, Tolerance)
		) {
			return false;
		}

		// Suppose we want to trade 1000 coin 1 for coin 2.
		const amountIn = 1000n;

		// We naively expect the amount out to be amount in / spot price.
		const spotOut = BigInt(Math.floor(Number(amountIn) / calculatedSpotPrice));

		// Let's see how wrong that was.
		const amountOut = CmmmCalculations.calcOutGivenIn(
			pool,
			indexIn,
			indexOut,
			amountIn
		);

		// It should be essentially the same. We allow +- 1 to account for rounding.
		if (Math.abs(Number(spotOut - amountOut)) > 1) {
			return false;
		}
		return true;
	},
	testCalcOutGivenIn: () => {
		const flatness = 3 / 7;

		const coins = {
			coin0: {
				weight: 280_000_000_000_000_000n,
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin1: {
				weight: 448_000_000_000_000_000n,
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				weight: 272_000_000_000_000_000n,
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const indexIn = "coin1";
		const indexOut = "coin2";

		const coinIn = coins[indexIn];
		const coinOut = coins[indexOut];

		const invariant = CmmmCalculations.calcInvariant(pool);

		const swapFeeIn = coinIn.tradeFeeIn;
		const swapFeeOut = coinOut.tradeFeeOut;
		const amountIn = Fixed.unnormalizeAmount(
			coinIn.decimalsScalar,
			coinIn.normalizedBalance / 10n
		);
		const amountOut = CmmmCalculations.calcOutGivenIn(
			pool,
			indexIn,
			indexOut,
			amountIn
		);

		coinIn.normalizedBalance += Fixed.normalizeAmount(
			coinIn.decimalsScalar,
			((FixedOne - swapFeeIn) * amountIn) / FixedOne
		);
		coinOut.normalizedBalance -= Fixed.normalizeAmount(
			coinOut.decimalsScalar,
			(amountOut * FixedOne) / (FixedOne - swapFeeOut)
		);

		const postInvariant = CmmmCalculations.calcInvariant(pool);

		if (
			!Helpers.closeEnough(
				invariant,
				postInvariant,
				Number(FixedOne / amountOut) / Number(FixedOne)
			)
		) {
			return false;
		}
		return true;
	},
	testCalcInGivenOut: () => {
		const flatness = 3 / 7;

		const coins = {
			coin0: {
				weight: 280_000_000_000_000_000n,
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin1: {
				weight: 448_000_000_000_000_000n,
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				weight: 272_000_000_000_000_000n,
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const indexIn = "coin1";
		const indexOut = "coin2";

		const coinIn = coins[indexIn];
		const coinOut = coins[indexOut];

		const invariant = CmmmCalculations.calcInvariant(pool);

		const swapFeeIn = coinIn.tradeFeeIn;
		const swapFeeOut = coinOut.tradeFeeOut;

		const amountOut = Fixed.unnormalizeAmount(
			coinOut.decimalsScalar,
			coinOut.normalizedBalance / 10n
		);
		const amountIn = CmmmCalculations.calcInGivenOut(
			pool,
			indexIn,
			indexOut,
			amountOut
		);

		coinIn.normalizedBalance += Fixed.normalizeAmount(
			coinIn.decimalsScalar,
			((FixedOne - swapFeeIn) * amountIn) / FixedOne
		);
		coinOut.normalizedBalance -= Fixed.normalizeAmount(
			coinOut.decimalsScalar,
			(amountOut * FixedOne) / (FixedOne - swapFeeOut)
		);

		const postInvariant = CmmmCalculations.calcInvariant(pool);

		if (
			!Helpers.closeEnough(
				invariant,
				postInvariant,
				Number(FixedOne / amountOut) / Number(FixedOne)
			)
		) {
			return false;
		}
		return true;
	},
	testCalcDepositFixedAmounts: () => {
		const coins = {
			coin1: {
				normalizedBalance: 700000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 500000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const flatness = 712_000_000_000_000_000n;

		const pool = {
			flatness,
			coins,
		};

		const amountsIn = {
			coin1: 200n,
			coin2: 300n,
			coin3: 0n,
		};

		const expectedLpRatio = 999_642_153_369_341_210n;

		const calculated_ratio = CmmmCalculations.calcDepositFixedAmounts(
			pool,
			amountsIn
		);

		if (
			!Helpers.closeEnoughBigInt(expectedLpRatio, calculated_ratio, Tolerance)
		) {
			return false;
		}
		return true;
	},
	// testCalcWithdrawFlpAmountsOut: () => {
	//     return testWithdraw(
	//     //     [700000000, 400000000, 500000000],
	//     //     [0.28, 0.448, 0.272],
	//     //     [0.1, 0.2, 0.3],
	//     //     [0.04, 0.02, 0.03],
	//     //     0.712,
	//     //     [3000000, 50000000, 10000000],
	//     //     0.729,
	//     // ) && testWithdraw(
	//         [700000000, 400000000, 500000000],
	//         [0.28, 0.448, 0.272],
	//         [0.1, 0.2, 0.3],
	//         [0.04, 0.02, 0.03],
	//         0.712,
	//         [3000000, 50000000, 10000000],
	//         0.99,
	//     )
	// },
	testDepositEstimate: () => {
		const flatness = 650_000_000_000_000_000n;

		const coins = {
			coin1: {
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			coins,
			flatness,
		};

		const amountsIn = {
			coin1: 1000n,
			coin2: 1230n,
			coin3: 0n,
		};

		const lpEstimate = CmmmCalculations.getEstimateDepositFixedAmounts(
			pool,
			amountsIn
		);

		if (
			!CmmmCalculations.checkValidDeposit(
				pool,
				amountsIn,
				Fixed.directUncast(lpEstimate)
			)
		) {
			return false;
		}
		return true;
	},
	testWithdrawEstimate: () => {
		const flatness = 650_000_000_000_000_000n;

		const coins = {
			coin1: {
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			coins,
			flatness,
		};

		const amountsOutDirection = {
			coin1: 100n,
			coin2: 1200n,
			coin3: 0n,
		};

		const lpRatio = 0.999_999;

		const scalarEstimate = CmmmCalculations.getEstimateWithdrawFlpAmountsOut(
			pool,
			amountsOutDirection,
			lpRatio
		);

		const amountsOut = {
			coin1: Helpers.blendedOperations.mulNBB(
				scalarEstimate,
				amountsOutDirection.coin1
			),
			coin2: Helpers.blendedOperations.mulNBB(
				scalarEstimate,
				amountsOutDirection.coin2
			),
			coin3: Helpers.blendedOperations.mulNBB(
				scalarEstimate,
				amountsOutDirection.coin3
			),
		};

		// the amounts are small so the estimate should be acceptable
		if (!CmmmCalculations.checkValidWithdraw(pool, amountsOut, lpRatio)) {
			return false;
		}
		return true;
	},
	testSwapEstimate: () => {
		const flatness = 650_000_000_000_000_000n;

		const coins = {
			coin1: {
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			coins,
			flatness,
		};

		const amountsIn = {
			coin1: 100_000n,
			coin2: 123_456n,
			coin3: 0n,
		};

		const amountsOutDirection = {
			coin1: 0n,
			coin2: 0n,
			coin3: 987_654n,
		};

		const outScalar = CmmmCalculations.getEstimateSwapFixedIn(
			pool,
			amountsIn,
			amountsOutDirection
		);

		const amountsOut = {
			coin1: Helpers.blendedOperations.mulNBB(
				outScalar,
				amountsOutDirection.coin1
			),
			coin2: Helpers.blendedOperations.mulNBB(
				outScalar,
				amountsOutDirection.coin2
			),
			coin3: Helpers.blendedOperations.mulNBB(
				outScalar,
				amountsOutDirection.coin3
			),
		};

		const estimatePrecision = CmmmCalculations.calcSwapFixedIn(
			pool,
			amountsIn,
			amountsOut
		);

		if (
			!Helpers.closeEnoughBigInt(
				estimatePrecision,
				Fixed.fixedOneB,
				0.01 // estimate accurate to within 1%
			)
		) {
			return false;
		}
		return true;
	},
	testCalcInvariantFull() {
		const flatness = 650_000_000_000_000_000n;

		const coins = {
			coin1: {
				normalizedBalance: 717_000_000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400_000_000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 556_000_000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness,
			coins,
		};

		const index = "coin1";

		const [prod, sum, p0, s0, t] = CmmmCalculations.calcInvariantComponents(
			pool,
			index
		);

		const test = (a, b) => {
			if (!Helpers.closeEnough(a, b, Tolerance)) {
				return false;
			}
		};

		test(prod, 515_143_925.447_469_251_864_559_616);
		test(sum, 531_192_000.0);
		test(p0, 1_707_588.492_537_516_776_164_208);
		test(s0, 330_432_000.0);
		test(t, 522_971_680.916_556_698_095_690_258);
		return true;
	},
	testCalcSwapFixedIn: () => {
		const flatness = 0.712;

		const coins = {
			coin1: {
				normalizedBalance: 700000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 500000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const amountsIn = {
			coin1: 200n,
			coin2: 300n,
			coin3: 0n,
		};

		const expectedAmountsOut = {
			coin1: 0n,
			coin2: 0n,
			coin3: 100n,
		};

		const computedScalar = CmmmCalculations.calcSwapFixedIn(
			pool,
			amountsIn,
			expectedAmountsOut
		);

		const expectedScalar = 5.842_518_797_119_088_8;

		// for some reason this expected value is not as close to the true value as expected
		// (expected came from desmos)
		if (
			!Helpers.closeEnough(
				Fixed.directCast(computedScalar),
				expectedScalar,
				0.000_000_01
			)
		) {
			return false;
		}
		return true;
	},
	testCalcSwapFixedOut: () => {
		const flatness = 0.712;

		const coins = {
			coin1: {
				normalizedBalance: 700000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 500000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const expectedAmountsIn = {
			coin1: 200n,
			coin2: 300n,
			coin3: 0n,
		};

		const amountsOut = {
			coin1: 0n,
			coin2: 0n,
			coin3: 100n,
		};

		const computedScalar = Fixed.directCast(
			CmmmCalculations.calcSwapFixedOut(pool, expectedAmountsIn, amountsOut)
		);

		if (
			!CmmmCalculations.checkValidSwap(
				pool,
				expectedAmountsIn,
				computedScalar,
				amountsOut,
				1
			)
		) {
			return false;
		}
		return true;
	},
	swapTestTest: () => {
		const flatness = 0.712;

		const coins = {
			coin1: {
				normalizedBalance: 700000_000_000_000_000_000_000n,
				weight: 280_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 400000_000_000_000_000_000_000n,
				weight: 448_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin3: {
				normalizedBalance: 500000_000_000_000_000_000_000n,
				weight: 272_000_000_000_000_000n,
				tradeFeeIn: 300_000_000_000_000_000n,
				tradeFeeOut: 30_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const indexIn = "coin1";
		const indexOut = "coin2";

		const amountIn = Fixed.unnormalizeAmount(
			coins[indexIn].decimalsScalar,
			coins[indexIn].normalizedBalance / 90n
		);
		const expectedOut = 3290n;
		const scalar = Fixed.directCast(
			CmmmCalculations.calcOutGivenIn(pool, indexIn, indexOut, amountIn)
		);
		const amountOut = Helpers.blendedOperations.mulNBB(scalar, expectedOut);

		const amountsIn = {
			coin1: amountIn,
			coin2: 0n,
			coin3: 0n,
		};
		const amountsOut = {
			coin1: 0n,
			coin2: amountOut,
			coin3: 0n,
		};

		if (!CmmmCalculations.checkValidSwap(pool, amountsIn, 1, amountsOut, 1)) {
			return false;
		}
		return true;
	},
	testCalcInGivenOut2: () => {
		const normalizedBalances = [
			1487123450145012_000_000_000_000_000_000n,
			246157078638440_000_000_000_000_000_000n,
			15794327124701562_000_000_000_000_000_000n,
			15794400012548011_000_000_000_000_000_000n,
			15794394488445449_000_000_000_000_000_000n,
			15794324994215621_000_000_000_000_000_000n,
			15794323487364081_000_000_000_000_000_000n,
			15794331542101821_000_000_000_000_000_000n,
			15794323475015293_000_000_000_000_000_000n,
		];

		const weights = [
			111_111_111_111_111_112n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
			111_111_111_111_111_111n,
		];

		const swapFeesIn = [
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
			100_000_000_000_000n,
		];

		const swapFeesOut = [0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n];

		const coins = {};
		for (let i = 0; i < 9; ++i) {
			coins["coin" + (i + 1)] = {
				normalizedBalance: normalizedBalances[i],
				weight: weights[i],
				tradeFeeIn: swapFeesIn[i],
				tradeFeeOut: swapFeesOut[i],
				decimalsScalar: 1_000_000_000_000_000_000n,
			};
		}

		const flatness = Fixed.fixedOneB;

		const pool = {
			flatness,
			coins,
		};

		const amountIn = 1727838591n;
		const indexIn = 2;
		const indexOut = 3;

		// this call would abort in a previous version
		CmmmCalculations.calcOutGivenIn(
			pool,
			"coin" + (indexIn + 1),
			"coin" + (indexOut + 1),
			amountIn
		);
		return true;
	},
	testDoublePool: () => {
		const flatness = 0.712;

		const coins = {
			coin1: {
				normalizedBalance: 10_000_000_000_000_000_000_000_000_000n,
				weight: 500_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 40_000_000_000_000_000_000_000_000_000n,
				weight: 500_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const amountsIn = {
			coin0: 10_000_000_000n,
			coin1: 40_000_000_000n,
		};

		CmmmCalculations.calcDepositFixedAmounts(pool, amountsIn);
		return true;
	},
	testDoublePool2: () => {
		const flatness = 1;

		const coins = {
			coin1: {
				normalizedBalance: 10_000_000_000_000_000_000_000_000_000n,
				weight: 500_000_000_000_000_000n,
				tradeFeeIn: 100_000_000_000_000_000n,
				tradeFeeOut: 40_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
			coin2: {
				normalizedBalance: 10_000_000_000_000_000_000_000_000_000n,
				weight: 500_000_000_000_000_000n,
				tradeFeeIn: 200_000_000_000_000_000n,
				tradeFeeOut: 20_000_000_000_000_000n,
				decimalsScalar: 1_000_000_000_000_000_000n,
			},
		};

		const pool = {
			flatness: Fixed.directUncast(flatness),
			coins,
		};

		const amountsIn = {
			coin0: 10_000_000_000n,
			coin1: 10_000_000_000n,
		};

		CmmmCalculations.calcDepositFixedAmounts(pool, amountsIn);
		return true;
	},
	testLargeDeposit: () => {
		const balances = [
			199_350_000_000, 200_410_000_000, 199_680_000_000, 201_010_000_000,
			199_990_000_000,
		];
		const weights = [0.2, 0.2, 0.2, 0.2, 0.2];
		const feesIn = weights.map(() => 0.0001);
		const feesOut = [0, 0, 0, 0, 0];
		const flatness = 1;
		const allAmountsIn = [
			[
				199_350_000_000, 200_410_000_000, 199_680_000_000, 201_010_000_000,
				199_990_000_000,
			],
			[
				500_000_000_000, 500_000_000_000, 500_000_000_000, 500_000_000_000,
				500_000_000_000,
			],
			[
				100_000_000_000, 120_000_000_000, 123_000_000_000, 123_400_000_000,
				123_450_000_000,
			],
			[
				100_090_600_009_001, 120_006_001_009_060, 123_010_091_600_000,
				123_460_060_090_001, 123_450_000_000_061,
			],
		];
		for (const amountsIn of allAmountsIn) {
			if (
				!testDeposit(balances, weights, feesIn, feesOut, flatness, amountsIn)
			) {
				return false;
			}
		}
		return true;
	},
	testWithdraw1: () => {
		return testWithdraw(
			[35_000_000_000, 35_000_000_000],
			[0.5, 0.5],
			[0.1, 0.1],
			[0, 0],
			1,
			[1, 1],
			18.28 / 35
		);
	},
	testDeposit: () => {
		const balances = [35_000_000_000_000, 35_000_000_000_000];
		const weights = [0.5, 0.5];
		const feesIn = [0.1, 0.1];
		const feesOut = [0, 0];
		const amountsIn = [100_000_000_000, 100_000_000_000];
		const flatness = 1;
		const expected_ratio = 997150997150997150n;
		const pool = makePool(balances, weights, feesIn, feesOut, flatness);
		const amountsInO = {
			coin0: Fixed.convertToInt(amountsIn[0]),
			coin1: Fixed.convertToInt(amountsIn[1]),
		};
		const ratio = CmmmCalculations.calcDepositFixedAmounts(pool, amountsInO);
		if (!Helpers.closeEnoughBigInt(expected_ratio, ratio, 0.000_000_000_1)) {
			return false;
		}
		return true;
	},
};

function testAll() {
	for (const testName in tests) {
		if (tests[testName]()) {
			console.log(testName + " passed");
		} else {
			throw Error(testName + " failed");
		}
	}
}

testAll();

function testWithdraw(
	balances,
	weights,
	feesIn,
	feesOut,
	flatness,
	amountsOutDirection,
	lpRatio
) {
	const pool = makePool(balances, weights, feesIn, feesOut, flatness);

	const bigAmountsOut = {};
	for (let i = 0; i < balances.length; ++i) {
		bigAmountsOut["coin" + i] = Fixed.convertToInt(amountsOutDirection[i]);
	}

	try {
		CmmmCalculations.calcWithdrawFlpAmountsOut(pool, bigAmountsOut, lpRatio);
	} catch (e) {
		return false;
	}
	return true;
}

function testDeposit(balances, weights, feesIn, feesOut, flatness, amountsIn) {
	const pool = makePool(balances, weights, feesIn, feesOut, flatness);

	const bigAmountsIn = {};
	for (let i = 0; i < balances.length; ++i) {
		bigAmountsIn["coin" + i] = Fixed.convertToInt(amountsIn[i]);
	}

	try {
		CmmmCalculations.calcDepositFixedAmounts(pool, bigAmountsIn);
	} catch (e) {
		return false;
	}
	return true;
}

function fixWeights(weights) {
	let sum = 0n;
	weights.map((x) => (sum += x));
	sum = Fixed.fixedOneB - sum;
	weights[0] += sum;
	if (weights[0] <= 0) {
		throw Error("bad weights");
	}
}

function makePool(balances, weights, feesIn, feesOut, flatness) {
	const bigBalances = balances.map(Fixed.convertToInt);
	const bigWeights = weights.map(Fixed.directUncast);
	fixWeights(bigWeights);
	const bigFeesIn = feesIn.map(Fixed.directUncast);
	const bigFeesOut = feesOut.map(Fixed.directUncast);
	const bigFlatness = Fixed.directUncast(flatness);
	const coins = {};
	for (let i = 0; i < balances.length; ++i) {
		coins["coin" + i] = {
			normalizedBalance: Fixed.normalizeAmount(
				1_000_000_000_000_000_000n,
				bigBalances[i]
			),
			weight: bigWeights[i],
			tradeFeeIn: bigFeesIn[i],
			tradeFeeOut: bigFeesOut[i],
			decimalsScalar: 1_000_000_000_000_000_000n,
		};
	}

	const pool = {
		flatness: bigFlatness,
		coins,
	};

	return pool;
}

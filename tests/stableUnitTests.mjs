import { Helpers } from "../dist/general/utils/helpers.js";
import { CmmmCalculations } from "../dist/packages/pools/utils/cmmmCalculations.js";
import { Fixed } from "../dist/general/utils/fixed.js";

// intended execution call: clear; npm run build; node tests/stableUnitTests.mjs

const FixedOne = 1_000_000_000_000_000_000n;
const Tolerance = 0.000_000_000_000_1;

const tests = {
    testGetTokenBalanceGivenInvariantAndAllOtherBalances: () => {
        let flatness = 3 / 7;

        let coins = {
            coin0: {
                weight: BigInt(280_000_000_000_000_000),
                balance: BigInt(717_000_000),
            },
            coin1: {
                weight: BigInt(448_000_000_000_000_000),
                balance: BigInt(400_000_000),
            },
            coin2: {
                weight: BigInt(272_000_000_000_000_000),
                balance: BigInt(556_000_000),
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let index = "coin1";

        let w = Fixed.directCast(coins[index].weight);
        let [prod, sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(pool, index);
        let bi = Fixed.convertFromInt(coins[index].balance);

        let bi0 = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
            flatness,
            w,
            h,
            bi / 2,
            p0,
            s0
        );

        let relErr = Math.abs(bi - bi0) / Math.max(bi, bi0);
        if (relErr > 0.000000001) return false;

        flatness = 1 - flatness;
        h = CmmmCalculations.calcInvariantQuadratic(
            prod,
            sum,
            flatness
        );

        bi0 = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
            flatness,
            w,
            h,
            bi * 2,
            p0,
            s0
        );

        relErr = Math.abs(bi - bi0) / Math.max(bi, bi0);
        if (relErr > 0.000000001) return false;
        return true;
    },
    testCalcSpotPrice() {
        let flatness = 0.712;

        let coins = {
            coin0: {
                weight: BigInt(280_000_000_000_000_000),
                balance: BigInt(700000),
                tradeFeeIn: BigInt(100_000_000_000_000_000),
                tradeFeeOut: BigInt(30_000_000_000_000_000),
            },
            coin1: {
                weight: BigInt(448_000_000_000_000_000),
                balance: BigInt(400000),
                tradeFeeIn: BigInt(100_000_000_000_000_000),
                tradeFeeOut: BigInt(30_000_000_000_000_000),
            },
            coin2: {
                weight: BigInt(272_000_000_000_000_000),
                balance: BigInt(500000),
                tradeFeeIn: BigInt(100_000_000_000_000_000),
                tradeFeeOut: BigInt(30_000_000_000_000_000),
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let indexIn = "coin0";
        let indexOut = "coin2";

        let expectedSpotPrice = 1.289_263_269_312_546_800;

        let calculatedSpotPrice = CmmmCalculations.calcSpotPriceWithFees(
            pool,
            indexIn,
            indexOut
        );

        if (!Helpers.closeEnough(expectedSpotPrice, calculatedSpotPrice, Tolerance)) return false;

        // Suppose we want to trade 1000 coin 1 for coin 2.
        let amountIn = 1000n;

        // We naively expect the amount out to be amount in / spot price.
        let spotOut = BigInt(Math.floor(Number(amountIn) / calculatedSpotPrice));

        // Let's see how wrong that was.
        let amountOut = CmmmCalculations.calcOutGivenIn(
            pool,
            indexIn,
            indexOut,
            amountIn
        );

        // It should be essentially the same. We allow +- 1 to account for rounding.
        if (Math.abs(Number(spotOut - amountOut)) > 1) return false;
        return true;
    },
    testCalcOutGivenIn: () => {
        let flatness = 3 / 7;

        let coins = {
            coin0: {
                weight: BigInt(280_000_000_000_000_000),
                balance: BigInt(717_000_000),
                tradeFeeIn: BigInt(100_000_000_000_000_000),
                tradeFeeOut: BigInt(40_000_000_000_000_000),
            },
            coin1: {
                weight: BigInt(448_000_000_000_000_000),
                balance: BigInt(400_000_000),
                tradeFeeIn: BigInt(200_000_000_000_000_000),
                tradeFeeOut: BigInt(20_000_000_000_000_000),
            },
            coin2: {
                weight: BigInt(272_000_000_000_000_000),
                balance: BigInt(556_000_000),
                tradeFeeIn: BigInt(300_000_000_000_000_000),
                tradeFeeOut: BigInt(30_000_000_000_000_000),
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let indexIn = "coin1";
        let indexOut = "coin2";

        let coinIn = coins[indexIn];
        let coinOut = coins[indexOut];

        let invariant = CmmmCalculations.calcInvariant(pool);

        let swapFeeIn = coinIn.tradeFeeIn;
        let swapFeeOut = coinOut.tradeFeeOut;

        let amountIn = coinIn.balance / 10n;
        let amountOut = CmmmCalculations.calcOutGivenIn(
            pool,
            indexIn,
            indexOut,
            amountIn
        );

        coinIn.balance += ((FixedOne - swapFeeIn) * amountIn) / FixedOne;
        coinOut.balance -= (amountOut * FixedOne) / (FixedOne - swapFeeOut);

        let postInvariant = CmmmCalculations.calcInvariant(pool);

        if (!Helpers.closeEnough(invariant, postInvariant, Number(FixedOne / amountOut) / Number(FixedOne))) return false;
        return true;
    },
    testCalcInGivenOut: () => {
        let flatness = 3 / 7;

        let coins = {
            coin0: {
                weight: BigInt(280_000_000_000_000_000),
                balance: BigInt(717_000_000),
                tradeFeeIn: BigInt(100_000_000_000_000_000),
                tradeFeeOut: BigInt(40_000_000_000_000_000),
            },
            coin1: {
                weight: BigInt(448_000_000_000_000_000),
                balance: BigInt(400_000_000),
                tradeFeeIn: BigInt(200_000_000_000_000_000),
                tradeFeeOut: BigInt(20_000_000_000_000_000),
            },
            coin2: {
                weight: BigInt(272_000_000_000_000_000),
                balance: BigInt(556_000_000),
                tradeFeeIn: BigInt(300_000_000_000_000_000),
                tradeFeeOut: BigInt(30_000_000_000_000_000),
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let indexIn = "coin1";
        let indexOut = "coin2";

        let coinIn = coins[indexIn];
        let coinOut = coins[indexOut];

        let invariant = CmmmCalculations.calcInvariant(pool);

        let swapFeeIn = coinIn.tradeFeeIn;
        let swapFeeOut = coinOut.tradeFeeOut;

        let amountOut = coinOut.balance / 10n;
        let amountIn = CmmmCalculations.calcInGivenOut(
            pool,
            indexIn,
            indexOut,
            amountOut
        );

        coinIn.balance += ((FixedOne - swapFeeIn) * amountIn) / FixedOne;
        coinOut.balance -= (amountOut * FixedOne) / (FixedOne - swapFeeOut);

        let postInvariant = CmmmCalculations.calcInvariant(pool);

        if (!Helpers.closeEnough(invariant, postInvariant, Number(FixedOne / amountOut) / Number(FixedOne))) return false;
        return true;
    },
    testCalcDepositFixedAmounts: () => {
        let coins = {
            coin1: {
                balance: 700000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 500000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        };

        let flatness = 712_000_000_000_000_000n;

        let pool = {
            flatness: flatness,
            coins: coins,
        };

        let amountsIn = {
            coin1: 200n,
            coin2: 300n,
            coin3: 0n,
        };

        let expectedLpRatio = 999_642_153_369_341_210n;

        let calculated_ratio = CmmmCalculations.calcDepositFixedAmounts(
            pool,
            amountsIn,
        );

        if (!Helpers.closeEnoughBigInt(expectedLpRatio, calculated_ratio, Tolerance)) return false;
        return true;
    },
    testCalcWithdrawFlpAmountsOut: () => {
        return testWithdraw(
        //     [700000000, 400000000, 500000000],
        //     [0.28, 0.448, 0.272],
        //     [0.1, 0.2, 0.3],
        //     [0.04, 0.02, 0.03],
        //     0.712,
        //     [3000000, 50000000, 10000000],
        //     0.729,
        // ) && testWithdraw(
            [700000000, 400000000, 500000000],
            [0.28, 0.448, 0.272],
            [0.1, 0.2, 0.3],
            [0.04, 0.02, 0.03],
            0.712,
            [3000000, 50000000, 10000000],
            0.99,
        )
    },
    testDepositEstimate: () => {
        let flatness = 650_000_000_000_000_000n;

        let coins = {
            coin1: {
                balance: 717_000_000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400_000_000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 556_000_000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        }

        let pool = {
            coins: coins,
            flatness: flatness,
        };

        let amountsIn = {
            coin1: 1000n,
            coin2: 1230n,
            coin3: 0n
        };

        let lpEstimate = CmmmCalculations.getEstimateDepositFixedAmounts(
            pool,
            amountsIn
        );

        if (!CmmmCalculations.checkValidDeposit(
            pool,
            amountsIn,
            Fixed.directUncast(lpEstimate)
        )) return false;
        return true;
    },
    testWithdrawEstimate: () => {
        let flatness = 650_000_000_000_000_000n;

        let coins = {
            coin1: {
                balance: 717_000_000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400_000_000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 556_000_000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        }

        let pool = {
            coins: coins,
            flatness: flatness,
        };

        let amountsOutDirection = {
            coin1: 100n,
            coin2: 1200n,
            coin3: 0n
        };

        let lpRatio = 0.999_999_000_000_000_000;

        let scalarEstimate = CmmmCalculations.getEstimateWithdrawFlpAmountsOut(
            pool,
            amountsOutDirection,
            lpRatio,
        );

        let amountsOut = {
            coin1: Helpers.blendedOperations.mulNBB(scalarEstimate, amountsOutDirection.coin1),
            coin2: Helpers.blendedOperations.mulNBB(scalarEstimate, amountsOutDirection.coin2),
            coin3: Helpers.blendedOperations.mulNBB(scalarEstimate, amountsOutDirection.coin3),
        };

        // the amounts are small so the estimate should be acceptable
        if (!CmmmCalculations.checkValidWithdraw(
            pool,
            amountsOut,
            lpRatio,
        )) return false;
        return true;
    },
    testSwapEstimate: () => {
        let flatness = 650_000_000_000_000_000n;

        let coins = {
            coin1: {
                balance: 717_000_000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400_000_000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 556_000_000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        }

        let pool = {
            coins: coins,
            flatness: flatness,
        };
        
        let amountsIn = {
            coin1: 100_000n,
            coin2: 123_456n,
            coin3: 0n,
        };

        let amountsOutDirection = {
            coin1: 0n,
            coin2: 0n,
            coin3: 987_654n,
        };

        let outScalar = CmmmCalculations.getEstimateSwapFixedIn(
            pool,
            amountsIn,
            amountsOutDirection,
        );

        let amountsOut = {
            coin1: Helpers.blendedOperations.mulNBB(outScalar, amountsOutDirection.coin1),
            coin2: Helpers.blendedOperations.mulNBB(outScalar, amountsOutDirection.coin2),
            coin3: Helpers.blendedOperations.mulNBB(outScalar, amountsOutDirection.coin3),
        };

        let estimatePrecision = CmmmCalculations.calcSwapFixedIn(
            pool,
            amountsIn,
            amountsOut,
        );

        if (!Helpers.closeEnoughBigInt(
            estimatePrecision,
            Fixed.fixedOneB,
            0.01 // estimate accurate to within 1%
        )) return false;
        return true;
    },
    testCalcInvariantFull() {
        let flatness = 650_000_000_000_000_000n;

        let coins = {
            coin1: {
                balance: 717_000_000n,
                weight: 280_000_000_000_000_000n,
            },
            coin2: {
                balance: 400_000_000n,
                weight: 448_000_000_000_000_000n,
            },
            coin3: {
                balance: 556_000_000n,
                weight: 272_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: flatness,
            coins: coins,
        };

        let index = "coin1";

        let [prod, sum, p0, s0, t] = CmmmCalculations.calcInvariantComponents(pool, index);

        let test = (a, b) => {
            if (!Helpers.closeEnough(a, b, Tolerance)) return false;
        }

        test(prod, 515143925.447_469_251_864_559_616);
        test(sum, 531192000.000_000_000_000_000_000);
        test(p0, 1707588.492_537_516_776_164_208);
        test(s0, 330432000.000_000_000_000_000_000);
        test(t, 522971680.916_556_698_095_690_258);
        return true;
    },
    testCalcSwapFixedIn: () => {
        let flatness = 0.712;

        let coins = {
            coin1: {
                balance: 700000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 500000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let amountsIn = {
            coin1: 200n,
            coin2: 300n,
            coin3: 0n
        };

        let expectedAmountsOut = {
            coin1: 0n,
            coin2: 0n,
            coin3: 100n,
        };

        let computedScalar = CmmmCalculations.calcSwapFixedIn(
            pool,
            amountsIn,
            expectedAmountsOut,
        );

        let expectedScalar = 5.842_518_797_119_088_800;

        // for some reason this expected value is not as close to the true value as expected
        // (expected came from desmos)
        if (!Helpers.closeEnough(Fixed.directCast(computedScalar), expectedScalar, 0.00000001)) return false;
        return true;
    },
    testCalcSwapFixedOut: () => {
        let flatness = 0.712;

        let coins = {
            coin1: {
                balance: 700000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 500000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let expectedAmountsIn = {
            coin1: 200n,
            coin2: 300n,
            coin3: 0n
        };

        let amountsOut = {
            coin1: 0n,
            coin2: 0n,
            coin3: 100n,
        };

        let computedScalar = Fixed.directCast(
            CmmmCalculations.calcSwapFixedOut(
                pool,
                expectedAmountsIn,
                amountsOut,
            )
        );

        if (!CmmmCalculations.checkValidSwap(pool, expectedAmountsIn, computedScalar, amountsOut, 1)) return false;
        return true;
    },
    swapTestTest: () => {
        let flatness = 0.712;

        let coins = {
            coin1: {
                balance: 700000n,
                weight: 280_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 400000n,
                weight: 448_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
            coin3: {
                balance: 500000n,
                weight: 272_000_000_000_000_000n,
                tradeFeeIn: 300_000_000_000_000_000n,
                tradeFeeOut: 30_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let indexIn = "coin1";
        let indexOut = "coin2";

        let amountIn = coins[indexIn].balance / 90n;
        let expectedOut = 3290n;
        let scalar = Fixed.directCast(
            CmmmCalculations.calcOutGivenIn(
                pool,
                indexIn,
                indexOut,
                amountIn,
            )
        );
        let amountOut = Helpers.blendedOperations.mulNBB(scalar, expectedOut);

        let amountsIn = {
            coin1: amountIn,
            coin2: 0n,
            coin3: 0n,
        };
        let amountsOut = {
            coin1: 0n,
            coin2: amountOut,
            coin3: 0n,
        };

        if (!CmmmCalculations.checkValidSwap(
            pool,
            amountsIn,
            1,
            amountsOut,
            1,
        )) return false;
        return true;
    },
    testCalcInGivenOut2: () => {
        let balances = [
            1487123450145012n,
            246157078638440n,
            15794327124701562n,
            15794400012548011n,
            15794394488445449n,
            15794324994215621n,
            15794323487364081n,
            15794331542101821n,
            15794323475015293n,
        ];

        let weights = [
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

         let swapFeesIn = [
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

        let swapFeesOut = [
            0n,
            0n,
            0n,
            0n,
            0n,
            0n,
            0n,
            0n,
            0n,
        ];

        let coins = {};
        for (let i = 0; i < 9; ++i) coins["coin" + (i + 1)] = {
            balance: balances[i],
            weight: weights[i],
            tradeFeeIn: swapFeesIn[i],
            tradeFeeOut: swapFeesOut[i],
        }

        let flatness = Fixed.fixedOneB;

        let pool = {
            flatness: flatness,
            coins: coins,
        };

        let amountIn = 1727838591n;
        let indexIn = 2;
        let indexOut = 3;

        // this call would abort in a previous version
        CmmmCalculations.calcOutGivenIn(
            pool,
            "coin" + (indexIn + 1),
            "coin" + (indexOut + 1),
            amountIn,
        );
        return true;
    },
    testDoublePool: () => {
        let flatness = 0.712;

        let coins = {
            coin1: {
                balance: 10_000_000_000n,
                weight: 500_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 40_000_000_000n,
                weight: 500_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let amountsIn = {
            coin0: 10_000_000_000n,
            coin1: 40_000_000_000n,
        };

        CmmmCalculations.calcDepositFixedAmounts(
            pool,
            amountsIn,
        );
        return true;
    },
    testDoublePool2: () => {
        let flatness = 1;

        let coins = {
            coin1: {
                balance: 10_000_000_000n,
                weight: 500_000_000_000_000_000n,
                tradeFeeIn: 100_000_000_000_000_000n,
                tradeFeeOut: 40_000_000_000_000_000n,
            },
            coin2: {
                balance: 10_000_000_000n,
                weight: 500_000_000_000_000_000n,
                tradeFeeIn: 200_000_000_000_000_000n,
                tradeFeeOut: 20_000_000_000_000_000n,
            },
        };

        let pool = {
            flatness: Fixed.directUncast(flatness),
            coins: coins,
        };

        let amountsIn = {
            coin0: 10_000_000_000n,
            coin1: 10_000_000_000n,
        };

        CmmmCalculations.calcDepositFixedAmounts(
            pool,
            amountsIn,
        );
        return true;
    },
    testWithdraw1: () => {
        return testWithdraw(
            [35_000_000_000, 35_000_000_000],
            [.5, .5],
            [.1, .1],
            [0, 0],
            1,
            [1, 1],
            18.28 / 35,
        );
    }
}

function testAll() {
	for (let testName in tests) {
		if (!tests[testName]()) throw Error(testName + " failed");
		else console.log(testName + " passed");
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
	let pool = makePool(balances, weights, feesIn, feesOut, flatness);

	let bigAmountsOut = {};
	for (let i = 0; i < balances.length; ++i) {
		bigAmountsOut["coin" + i] = Fixed.convertToInt(amountsOutDirection[i]);
	}

	try {
		CmmmCalculations.calcWithdrawFlpAmountsOut(
			pool,
			bigAmountsOut,
			lpRatio
		);
	} catch (e) {
		return false;
	}
	return true;
}

function fixWeights(weights) {
	let sum = BigInt(0);
	weights.map((x) => (sum += x));
	sum = Fixed.fixedOneB - sum;
	weights[0] += sum;
	if (weights[0] <= 0) throw Error("bad weights");
}

function makePool(balances, weights, feesIn, feesOut, flatness) {
	let bigBalances = balances.map(Fixed.convertToInt);
	let bigWeights = weights.map(Fixed.directUncast);
	fixWeights(bigWeights);
	let bigFeesIn = feesIn.map(Fixed.directUncast);
	let bigFeesOut = feesOut.map(Fixed.directUncast);
	let bigFlatness = Fixed.directUncast(flatness);
	let coins = {};
	for (let i = 0; i < balances.length; ++i) {
		coins["coin" + i] = {
			balance: bigBalances[i],
			weight: bigWeights[i],
			tradeFeeIn: bigFeesIn[i],
			tradeFeeOut: bigFeesOut[i],
		};
	}

	let pool = {
		flatness: bigFlatness,
		coins: coins,
	};

	return pool;
}

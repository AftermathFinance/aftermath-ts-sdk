import { Helpers } from "../dist/general/utils/helpers.js";
import { CmmmCalculations } from "../dist/packages/pools/utils/cmmmCalculations.js";

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
            flatness: CmmmCalculations.directUncast(flatness),
            coins: coins,
        };

        let index = "coin1";

        let w = CmmmCalculations.directCast(coins[index].weight);
        let [prod, sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(pool, index);
        let bi = CmmmCalculations.convertFromInt(coins[index].balance);

        let bi0 = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
            flatness,
            w,
            h,
            bi / 2,
            p0,
            s0
        );

        let relErr = Math.abs(bi - bi0) / Math.max(bi, bi0);
        if (relErr > 0.000000001) throw Error("did not find correct balance");

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
        if (relErr > 0.000000001) throw Error("did not find correct balance");

        console.log("testGetTokenBalanceGivenInvariantAndAllOtherBalances passed");
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
            flatness: CmmmCalculations.directUncast(flatness),
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

        if (!Helpers.closeEnough(expectedSpotPrice, calculatedSpotPrice, Tolerance)) {
            throw Error("testCalcSpotPrice failed");
        }

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
        if (Math.abs(Number(spotOut - amountOut)) > 1) throw Error("testCalcSpotPrice failed");
        console.log("testCalcSpotPrice passed");
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
            flatness: CmmmCalculations.directUncast(flatness),
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

        if (!Helpers.closeEnough(invariant, postInvariant, Number(FixedOne / amountOut) / Number(FixedOne))) {
            throw Error("testCalcOutGivenIn failed");
        };
        console.log("testCalcOutGivenIn passed");
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
            flatness: CmmmCalculations.directUncast(flatness),
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

        if (!Helpers.closeEnough(invariant, postInvariant, Number(FixedOne / amountOut) / Number(FixedOne))) {
            throw Error("testCalcInGivenOut failed");
        };
        console.log("testCalcInGivenOut passed");
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

        if (!Helpers.closeEnoughn(expectedLpRatio, calculated_ratio, Tolerance)) throw Error("testCalcDepositFixedAmounts failed");
        console.log("testCalcDepositFixedAmounts passed");
    }
}

function testAll() {
    for (let testName in tests) tests[testName]();
}

testAll();

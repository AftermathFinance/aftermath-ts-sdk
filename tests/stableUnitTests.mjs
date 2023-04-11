import { Helpers } from "../dist/general/utils/helpers.js";
import { Pool } from "../dist/packages/pools/pool.js";
import { CmmmCalculations } from "../dist/packages/pools/utils/cmmmCalculations.js";

// to run this file: clear; npm run build; node tests/stableUnitTests.mjs

const FixedOne = 1_000_000_000_000_000_000n;

const pool = new Pool(
    Helpers.parseJsonWithBigint(
        `{"objectId":"0x75cb1461bea5429cb18cfe234389528533578921f534884f0311e1c9ecb51d9e","lpCoinType":"0x87be783f3093915f10dc23a01e9ca6e0dee24beecb00741c1fc5b4596e1f80a3::af_lp_stable::AF_LP_STABLE","name":"Stable Pool","creator":"0x4b02b9b45f2a9597363fbaacb2fd6e7fb8ed9329bb6f716631b5717048908ace","lpCoinSupply":"308116554360n","illiquidLpCoinSupply":"1000n","flatness":"1000000000000000000n","coins":{"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::af::AF":{"weight":"111111111111111112n","balance":"5456897134685n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::afsui::AFSUI":{"weight":"111111111111111111n","balance":"192676784512n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::axldai::AXLDAI":{"weight":"111111111111111111n","balance":"46127894512n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::axlusdc::AXLUSDC":{"weight":"111111111111111111n","balance":"46135795247n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdc::LZUSDC":{"weight":"111111111111111111n","balance":"168435780741441n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdt::LZUSDT":{"weight":"111111111111111111n","balance":"47251239515n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::usdc::USDC":{"weight":"111111111111111111n","balance":"0n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whusdc::WHUSDC":{"weight":"111111111111111111n","balance":"47075486207n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"},"0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whusdt::WHUSDT":{"weight":"111111111111111111n","balance":"47116487516n","tradeFeeIn":"100000000000000n","tradeFeeOut":"0n","depositFee":"0n","withdrawFee":"0n"}}}`
    )
);

// const amountOut = pool.getTradeAmountOut({
//     coinInType:
//         "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdc::LZUSDC",
//     coinOutType:
//         "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::afsui::AFSUI",
//     coinInAmount: BigInt(47157255648),
// });

//console.log(amountOut);

// --------------------------------------------------------------------------------------
// ----------------------------------------   tests   -----------------------------------
// --------------------------------------------------------------------------------------

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
}

function testAll() {
    for (let testName in tests) tests[testName]();
}

testAll();

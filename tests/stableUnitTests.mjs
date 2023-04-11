import { Helpers } from "../dist/general/utils/helpers.js";
import { CmmmCalculations } from "../dist/packages/pools/utils/cmmmCalculations.js";

// intended execution call: clear; npm run build; node tests/stableUnitTests.mjs

const FixedOne = 1_000_000_000_000_000_000n;
const Tolerance = 0.000_000_000_000_1;

let pool = {
    objectId: "0xbc145d0a10a1e8561d23b6e45b70397dca129e8cc2e18a741ce203edb928e722",
    lpCoinType: "0x87be783f3093915f10dc23a01e9ca6e0dee24beecb00741c1fc5b4596e1f80a3::af_lp_btc::AF_LP_BTC",
    name: "BTC Pool",
    creator: "0x4b02b9b45f2a9597363fbaacb2fd6e7fb8ed9329bb6f716631b5717048908ace",
    lpCoinSupply: 5889559772396n,
    illiquidLpCoinSupply: 1000n,
    flatness: 0n,
    coins: {
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::afsui::AFSUI": {
            weight: 100000000000000000n,
            balance: 741470912333n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::btcb::BTCB": {
            weight: 300000000000000000n,
            balance: 41757437841n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdc::LZUSDC": {
            weight: 100000000000000000n,
            balance: 234512478645789124n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::usdc::USDC": {
            weight: 100000000000000000n,
            balance: 234511741265487521n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whbtc::WHBTC": {
            weight: 300000000000000000n,
            balance: 4475124n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
        "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whusdc::WHUSDC": {
            weight: 100000000000000000n,
            balance: 234523914571651720n,
            tradeFeeIn: 100000000000000n,
            tradeFeeOut: 0n,
            depositFee: 0n,
            withdrawFee: 0n,
        },
    },
};

function shortName(line) {
    let lines = line.split("::");
    return lines[lines.length - 1];
}

function checkVsSpotPrice(pool, indexIn, indexOut) {
    let coinOut = pool.coins[indexOut];
    let spotPrice = BigInt(Math.floor((10 ** 18) * CmmmCalculations.calcSpotPriceWithFees(pool, indexIn, indexOut)));
    let amountOut = coinOut.balance >> 20n;
    let spotIn;
    let amountIn;
    do {
        amountOut = amountOut >> 1n;
        spotIn = (amountOut * spotPrice) / FixedOne;
        amountIn = CmmmCalculations.calcInGivenOut(
            pool,
            indexIn,
            indexOut,
            amountOut
        );
    } while (amountOut > 0n && Math.abs(Number(spotIn - amountIn)) <= 1);
    console.log(shortName(indexIn) + " " + shortName(indexOut) + ": " + amountOut);
    console.log(Number(amountOut) / Number(coinOut.balance));
}

for (let indexIn of Object.keys(pool.coins)) {
    for (let indexOut of Object.keys(pool.coins)) {
        if (indexIn == indexOut) continue;
        checkVsSpotPrice(pool, indexIn, indexOut);
    }
}


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
}

function testAll() {
    for (let testName in tests) tests[testName]();
}

testAll();

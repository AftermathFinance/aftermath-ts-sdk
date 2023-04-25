//import { Helpers } from "../dist/general/utils/helpers.js";
import { CmmmCalculations } from "../dist/packages/pools/utils/cmmmCalculations.js";

// This file is for random one-off tests. Don't pay attention to its contents. If anything good comes out of here the good stuff will be moved to a more permanent home.

let pool = poolFromExplorer(
    ["3655823273833","1270965518620","81152257508","46135795247","40732952118","47251239515","56564380562","48646593903","25467386079"],
    ["111111111111111112","111111111111111111","111111111111111111","111111111111111111","111111111111111111","111111111111111111","111111111111111111","111111111111111111","111111111111111111"],
    ["100000000000000","100000000000000","100000000000000","100000000000000","100000000000000","100000000000000","100000000000000","100000000000000","100000000000000"],
    ["0","0","0","0","0","0","0","0","0"],
    ["0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::af::AF","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::afsui::AFSUI","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::axldai::AXLDAI","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::axlusdc::AXLUSDC","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdc::LZUSDC","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdt::LZUSDT","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::usdc::USDC","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whusdc::WHUSDC","0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::whusdt::WHUSDT"],
    "1000000000000000000"
);

//console.log(pool);

let indexIn = "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::lzusdc::LZUSDC";
let indexOut = "0xa8ea7b79c307136b0159502ae4c188660707d2a6d4345a04ae03a8093aa49928::usdc::USDC";
let amountIn = 1789795866998400n;
let expectedOut = 16369483755n;
let actualOut = CmmmCalculations.calcOutGivenIn(
    pool,
    indexIn,
    indexOut,
    amountIn
);

console.log(expectedOut);
console.log(actualOut);
console.log(actualOut / expectedOut);

function poolFromExplorer(balances, weights, feesIn, feesOut, typeNames, flatness) {
    let coins = {};
    for (let i = 0; i < balances.length; ++i) {
        coins[typeNames[i]] = {
            balance: BigInt(balances[i]),
            weight: BigInt(weights[i]),
            tradeFeeIn: BigInt(feesIn[i]),
            tradeFeeOut: BigInt(feesOut[i]),
        };
    }
    return {
        flatness: BigInt(flatness),
        coins: coins,
    }
}

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
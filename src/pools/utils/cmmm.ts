import {
	poolBalanceForCoin,
	poolWeightForCoin,
	CoinType,
	CoinWithBalance,
	CoinsToBalance,
	PoolDynamicFields,
	PoolObject,
} from "aftermath-sdk";

import { CmmmCalculations } from "./cmmmCalculations";

export class Cmmm extends CmmmCalculations {
	public static swapAmountOutGivenIn = (
		pool: PoolObject,
		poolDynamicFields: PoolDynamicFields,
		coinInWithBalance: CoinWithBalance,
		coinOut: CoinType
	) => {
		const coinIn = coinInWithBalance.coin;
		const coinInPoolBalance = poolBalanceForCoin(coinIn, poolDynamicFields);
		const coinOutPoolBalance = poolBalanceForCoin(
			coinOut,
			poolDynamicFields
		);
		const coinInWeight = poolWeightForCoin(coinIn, pool);
		const coinOutWeight = poolWeightForCoin(coinOut, pool);

		return CmmmCalculations.calcOutGivenIn(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight,
			coinInWithBalance.balance,
			pool.fields.swapFee
		);
	};

	public static swapAmountInGivenOut = (
		pool: PoolObject,
		poolDynamicFields: PoolDynamicFields,
		coinOutWithBalance: CoinWithBalance,
		coinIn: CoinType
	) => {
		const coinOut = coinOutWithBalance.coin;
		const coinOutPoolBalance = poolBalanceForCoin(
			coinOut,
			poolDynamicFields
		);
		const coinInPoolBalance = poolBalanceForCoin(coinIn, poolDynamicFields);
		const coinOutWeight = poolWeightForCoin(coinOut, pool);
		const coinInWeight = poolWeightForCoin(coinIn, pool);

		return CmmmCalculations.calcInGivenOut(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight,
			coinOutWithBalance.balance,
			pool.fields.swapFee
		);
	};

	public static spotPrice = (
		pool: PoolObject,
		poolDynamicFields: PoolDynamicFields,
		coinIn: CoinType,
		coinOut: CoinType
	) => {
		const coinInPoolBalance = poolBalanceForCoin(coinIn, poolDynamicFields);
		const coinOutPoolBalance = poolBalanceForCoin(
			coinOut,
			poolDynamicFields
		);
		const coinInWeight = poolWeightForCoin(coinIn, pool);
		const coinOutWeight = poolWeightForCoin(coinOut, pool);

		return CmmmCalculations.calcSpotPrice(
			coinInPoolBalance,
			coinInWeight,
			coinOutPoolBalance,
			coinOutWeight
		);
	};

	public static depositLpMintAmount = (
		pool: PoolObject,
		poolDynamicFields: PoolDynamicFields,
		coinsToBalance: CoinsToBalance
	) => {
		const lpTotalSupply = poolDynamicFields.lpFields[0].value;
		const poolCoinBalances = poolDynamicFields.amountFields.map(
			(field) => field.value
		);
		const depositCoinBalances = pool.fields.coins.map((coin) => {
			const foundBalance = Object.entries(coinsToBalance).find(
				(coinAndBalance) => coinAndBalance[0] === coin
			)?.[1];
			return foundBalance ?? BigInt(0);
		});

		return CmmmCalculations.calcLpOutGivenExactTokensIn(
			poolCoinBalances,
			pool.fields.weights,
			depositCoinBalances,
			lpTotalSupply,
			pool.fields.swapFee
		);
	};
}

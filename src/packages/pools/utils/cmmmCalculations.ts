import { Coin } from "../../coin/coin";
import {
	ApproximateBalance,
	Balance,
	CoinType,
	PoolObject,
	PoolTradeFee,
	PoolWeight,
} from "../../../types";
import { Pools } from "../pools";
import { Helpers } from "../../../general/utils";

// This file is the typescript version of on-chain calculations. See the .move file for license info.
// These calculations are useful for estimating values on-chain but the JS number format is LESS PRECISE!
// Do not expect these values to be identical to their on-chain counterparts.

export class CmmmCalculations {
	private static minWeight: number = 0.01;
	// Having a minimum normalized weight imposes a limit on the maximum number of tokens;
	// i.e., the largest possible pool is one where all tokens have exactly the minimum weight.
	private static maxWeightedTokens: number = 100;

	// Pool limits that arise from limitations in the fixed point power function (and the imposed 1:100 maximum weight
	// ratio).

	// Swap limits: amounts swapped may not be larger than this percentage of total balance.
	private static maxInRatio: number = 0.3;
	private static maxOutRatio: number = 0.3;

	// Invariant shrink limit: non-proportional exits cannot cause the invariant to decrease by less than this ratio.
	private static minInvariantRatio: number = 0.7;
	// Invariant growth limit: non-proportional joins cannot cause the invariant to increase by more than this ratio.
	private static maxInvariantRatio: number = 3;

	private static maxNewtonAttempts: number = 255;
	private static convergenceBound: number = 0.000_000_001;

	// pools assume coins are stored in raw integer format
	// every other fixed point nubmer is in 18 point format
	// these terms come from their on chain equivalents where direct cast means (x: u64 as u256)
	private static convertFromInt = (n: bigint): number => Number(n);
	private static convertToInt = (n: number): ApproximateBalance => BigInt(Math.floor(n));
	private static directCast = (n: bigint): number =>
		Coin.balanceWithDecimals(n, 18);
	private static directUncast = (n: number): ApproximateBalance =>
		Coin.normalizeBalance(n, 18);
	
	// Invariant is used to govern pool behavior. Swaps are operations which change the pool balances without changing
	// the invariant (ignoring fees) and investments change the invariant without changing the distribution of balances.
	// Invariant and pool lp are almost in 1:1 correspondence -- e.g. burning lp in a withdraw proportionally lowers the pool invariant.
	// The difference is as swap fees are absorbed they increase the invariant without incrasing total lp, increasing lp worth.
	// Every pool operation either explicitly or implicity calls this function.
	public static calcInvariant = (pool: PoolObject): number => {
		let flatness = CmmmCalculations.directCast(pool.flatness);

		// The value for h which we want is the one for which the balances vector B lies on the curve through T.
		// That is, C(T) = C(B). This turns out to be a quadratic equation which can be solved with
		// h = [sqrt[P(B) * (P(B) * (A*A + 4*(1-A)) + 8*A*S(B))] - A*P(B)] / 2.
		let sum = 0;
		let prod = 0;
		let balance;
		let weight;
		for (let coin of Object.values(pool.coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance);
			weight = CmmmCalculations.directCast(coin.weight);
			sum += weight * balance;
			prod += weight * Math.log(balance);
		}
		prod = Math.exp(prod);

		return this.calcInvariantQuadratic(prod, sum, flatness);
	};

	// The invariant for stables comes from a quadratic equation coming from the reference point T = (h,h,...,h).
	// h = [sqrt[p * (p * (A*A + 4*(1-A)) + 8*A*s)] - A*p] / 2.
	public static calcInvariantQuadratic = (
		prod: number,
		sum: number,
		flatness: number
	): number =>
		(Math.sqrt(
			prod *
				(prod * (flatness * flatness + (1 - flatness) * 4) +
					flatness * sum * 8)
		) -
			flatness * prod) /
		2;

	// This function is used for 1d optimization. It computes the full invariant components and their
	// portions which omit contribution from the balance in the `index` coordinate.
	// It returns (prod, sum, p0, s0, h) where:
	// prod = b1^w1 * ... * bn^wn
	// sum = w1*b1 + ... + wn*bn
	// p0 = b1^w1 * ... * [bi^w1] * ... * bn^wn (remove bi from prod)
	// s0 = w1*b1 + ... + [wi*bi] + ... + wn*bn (remove bi from sum)
	// h is the invariant
	public static calcInvariantComponents = (
		pool: PoolObject,
		index: CoinType
	): [prod: number, sum: number, p0: number, s0: number, h: number] => {
		let flatness = CmmmCalculations.directCast(pool.flatness);
		let prod = 0;
		let sum = 0;
		let p0 = 0;
		let s0 = 0;

		let balance;
		let weight;
		let p;
		let s;
		for (let [coinType, coin] of Object.entries(pool.coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance);
			weight = CmmmCalculations.directCast(coin.weight);

			p = weight * Math.log(balance);
			s = weight * balance;

			prod = prod + p;
			sum = sum + s;

			if (coinType != index) {
				p0 = p0 + p;
				s0 = s0 + s;
			}
		}
		prod = Math.exp(prod);
		p0 = Math.exp(p0);

		return [
			prod,
			sum,
			p0,
			s0,
			CmmmCalculations.calcInvariantQuadratic(prod, sum, flatness),
		];
	};

	// This function calculates the balance of a given token (index) given all the other balances (combined in p0, s0)
	// and the invariant along with an initial estimate. It is useful for 1d optimization.
	private static getTokenBalanceGivenInvariantAndAllOtherBalances = (
		flatness: number,
		w: number,
		h: number,
		xi: number, // initial estimate -- default can be (P(X) / p0)^n
		p0: number, // P(B) / xi^(1/n) (everything but the missing part)
		s0: number // S(B) - xi / n (everything but the missing part)
	): number => {
		// Standard Newton method used here

		// ---------------- setting constants ----------------

		// c1 = 2*A*w*w
		// c2 = 2*(1-A)*w*p0
		// c3 = A*(2*w*s0+t)
		// c4 = t*t/p0
		// c5 = (1-A)*p0
		// c6 = A*(2*s0+w*t)
		// c7 = 2*A*w*(w+1)
		// c8 = 2*(1-A)*p0
		// c9 = 2*A*w*s0
		// c10= A*w*t

		let ac = 1 - flatness;
		let aw = flatness * w;
		let acw = ac * w;
		let as0 = flatness * s0;
		let ah = flatness * h;

		let c1 = 2 * aw * w;
		let c2 = 2 * acw * p0;
		let c3 = 2 * w * as0 + ah;
		let c4 = (h * h) / p0;
		let c5 = ac * p0;
		let c6 = 2 * as0 + w * ah;
		let c7 = 2 * aw * (w + 1);
		let c8 = 2 * acw * p0;
		let c9 = 2 * aw * s0;
		let c10 = aw * h;

		// ---------------- iterating ----------------

		//x = (
		//    x * (
		//        (
		//            x^w * (
		//                c1 * x + c2 * x^w + c3
		//            ) + c4
		//        ) - x^w * (
		//            c5 * x^w + c6
		//        )
		//    )
		//) / (
		//    x^w * (
		//        (
		//            c7 * x + c8 * x^w + c9
		//        ) - c10
		//    )
		//)

		let x = xi;
		let xw; // x^w

		let top_pos;
		let top_neg;
		let bottom_pos;
		//let bottom_neg;

		let prev_x = x;

		let i = 0;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			xw = Math.pow(x, w);

			top_pos = x * (xw * (c1 * x + c2 * xw + c3) + c4);
			top_neg = x * (xw * (c5 * xw + c6));
			bottom_pos = c7 * x + c8 * xw + c9;
			//bottom_neg = c10;

			// If x jumps too much (bad initial estimate) then g(x) might overshoot into a negative number.
			// This only happens if x is supposed to be small. In this case, replace x with a small number and try again.
			// Once x is close enough to the true value g(x) won't overshoot anymore and this test will be skipped from then on.
			if (top_pos < top_neg || bottom_pos < c10) {
				x = 1 / 2 ** i;
				i = i + 1;
				continue;
			}

			x = (top_pos - top_neg) / (xw * (bottom_pos - c10));

			// using relative error here (easier to pass) because js numbers are less precise
			if (Helpers.closeEnough(x, prev_x, CmmmCalculations.convergenceBound)) {
				return x;
			}

			prev_x = x;
			i = i + 1;
		}
		throw Error("Newton diverged");
	};

	// 1d optimized swap function for finding out given in. Returns the amount out.
	public static calcOutGivenIn = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountIn: Balance
	): ApproximateBalance => {
		if (coinTypeIn == coinTypeOut)
			throw Error("in and out must be different coins");
		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let swapFeeIn = CmmmCalculations.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = CmmmCalculations.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			return BigInt(0);
		}

		let flatness = CmmmCalculations.directCast(pool.flatness);
		let oldIn = CmmmCalculations.convertFromInt(coinIn.balance);
		let oldOut = CmmmCalculations.convertFromInt(coinOut.balance);

		let wIn = CmmmCalculations.directCast(coinIn.weight);
		let [prod, _sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeOut
		);

		let feedAmountIn =
			(1 - swapFeeIn) * CmmmCalculations.convertFromInt(amountIn);
		let newIn = oldIn + feedAmountIn;
		let prodRatio = Math.pow(newIn / oldIn, wIn);

		let newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		let xi = Math.pow(prod / newP0, 1 / wIn);
		let newS0 = s0 + wIn * feedAmountIn;

		let wOut = CmmmCalculations.directCast(coinOut.weight);

		let tokenAmountOut =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wOut,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		let amountOut = (oldOut - tokenAmountOut) * (1 - swapFeeOut);
		return CmmmCalculations.convertToInt(amountOut);
	};

	// 1d optimized swap function for finding in given out. Returns the amount in.
	public static calcInGivenOut = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountOut: Balance
	): ApproximateBalance => {
		if (coinTypeIn == coinTypeOut)
			throw Error("in and out must be different coins");
		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let swapFeeIn = CmmmCalculations.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = CmmmCalculations.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			if (amountOut == BigInt(0)) return BigInt(0);
			throw Error("this swap is disabled");
		}

		let flatness = CmmmCalculations.directCast(pool.flatness);
		let oldIn = CmmmCalculations.convertFromInt(coinIn.balance);
		let oldOut = CmmmCalculations.convertFromInt(coinOut.balance);

		let wOut = CmmmCalculations.directCast(coinOut.weight);
		let [prod, _sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeIn
		);

		let feedAmountOut =
			CmmmCalculations.convertFromInt(amountOut) / (1 - swapFeeOut);
		let newOut = oldOut - feedAmountOut;
		let prodRatio = Math.pow(newOut / oldOut, wOut);

		let newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		let xi = Math.pow(prod / newP0, 1 / wOut);
		let newS0 = s0 - wOut * feedAmountOut;

		let wIn = CmmmCalculations.directCast(coinIn.weight);

		let tokenAmountIn =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wIn,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		let amountIn = (tokenAmountIn - oldIn) / (1 - swapFeeIn);
		return CmmmCalculations.convertToInt(amountIn);
	};
}

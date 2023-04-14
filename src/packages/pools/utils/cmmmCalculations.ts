import { Coin } from "../../coin/coin";
import {
	ApproximateBalance,
	Balance,
	CoinAmounts,
	CoinType,
	F18Ratio,
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
	private static convertToInt = (n: number): ApproximateBalance =>
		BigInt(Math.floor(n));
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

		let topPos;
		let topNeg;
		let bottomPos;
		//let bottom_neg;

		let prevX = x;

		let i = 0;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			xw = Math.pow(x, w);

			topPos = x * (xw * (c1 * x + c2 * xw + c3) + c4);
			topNeg = x * (xw * (c5 * xw + c6));
			bottomPos = c7 * x + c8 * xw + c9;
			//bottom_neg = c10;

			// If x jumps too much (bad initial estimate) then g(x) might overshoot into a negative number.
			// This only happens if x is supposed to be small. In this case, replace x with a small number and try again.
			// Once x is close enough to the true value g(x) won't overshoot anymore and this test will be skipped from then on.
			if (topPos < topNeg || bottomPos < c10) {
				x = 1 / 2 ** i;
				i = i + 1;
				continue;
			}

			x = (topPos - topNeg) / (xw * (bottomPos - c10));

			// using relative error here (easier to pass) because js numbers are less precise
			if (
				Helpers.closeEnough(
					x,
					prev_x,
					CmmmCalculations.convergenceBound
				)
			) {
				return x;
			}

			prevX = x;
			i = i + 1;
		}
		throw Error("Newton diverged");
	};

	public static calcSpotPrice = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType
	): number =>
		CmmmCalculations.calcSpotPriceWithFees(
			pool,
			coinTypeIn,
			coinTypeOut,
			true
		);

	// spot price is given in units of Bin / Bout
	public static calcSpotPriceWithFees = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		ignoreFees?: boolean
	): number => {
		let a = CmmmCalculations.directCast(pool.flatness);
		let part1 = CmmmCalculations.calcSpotPriceBody(pool);

		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let balanceIn = CmmmCalculations.convertFromInt(coinIn.balance);
		let balanceOut = CmmmCalculations.convertFromInt(coinOut.balance);
		let weightIn = CmmmCalculations.directCast(coinIn.weight);
		let weightOut = CmmmCalculations.directCast(coinOut.weight);
		let swapFeeIn = ignoreFees
			? 0
			: CmmmCalculations.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = ignoreFees
			? 0
			: CmmmCalculations.directCast(coinIn.tradeFeeOut);

		let sbi = weightOut * balanceIn;
		// this is the only place where fee values are used
		let sbo = (1 - swapFeeIn) * (1 - swapFeeOut) * weightIn * balanceOut;

		return (
			(sbi * (part1 + 2 * a * balanceOut)) /
			(sbo * (part1 + 2 * a * balanceIn))
		);
	};

	// The spot price formula contains a factor of C0^2 / P(B0) + (1-A)P(B0), this returns that
	private static calcSpotPriceBody = (pool: PoolObject): number => {
		// The spot price formula comes from the partial derivatives of Cf, specifically -(dCf / dx_out) / (dCf / dx_in)
		let a: number = CmmmCalculations.directCast(pool.flatness);
		let ac: number = 1 - a;

		let prod: number = 0;
		let sum: number = 0;
		let balance: number;
		let weight: number;

		// The spot price formula requires knowing the value of the invariant. We need the prod and sum parts
		// also later on so no need to compute them twice by calling calc_invariant, just evaluate here.
		for (let coin of Object.values(pool.coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance);
			weight = CmmmCalculations.directCast(coin.weight);

			prod += weight * Math.log(balance);
			sum += weight * balance;
		}
		prod = Math.exp(prod);

		let invarnt = CmmmCalculations.calcInvariantQuadratic(prod, sum, a);

		return (invarnt * invarnt) / prod + ac * prod;
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

	// Return the expected lp ratio for this deposit
	public static calcDepositFixedAmounts = (
		pool: PoolObject,
		amountsIn: CoinAmounts,
	): F18Ratio => {
		let invariant = CmmmCalculations.calcInvariant(pool);
		let coins = pool.coins;
		let a = CmmmCalculations.directCast(pool.flatness);
		let ac = 1 - a;
		let balance;
		let weight;
		let prod = 0;
		let sum = 0;
		let n = Object.keys(coins).length;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance + amountsIn[coinType]);
			weight = CmmmCalculations.directCast(coin.weight);
			prod += weight * Math.log(balance);
			sum += weight * balance;
		}
		prod = Math.exp(prod);
		let cfMax = 2 * a * prod * sum / (prod + invariant) + ac * prod;

		let r;
		let rMin = 0;
		let rMax = 1;
		let amount;
		let part1;
		let cf;
		let cfMin = 0;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance);
			weight = CmmmCalculations.directCast(coin.weight);
			amount = CmmmCalculations.convertFromInt(amountsIn[coinType]);
			r = balance / (balance + amount);

			prod = 0;
			sum = 0;
			for (let [coinType2, coin2] of Object.entries(coins)) {
				balance = CmmmCalculations.convertFromInt(coin2.balance);
				weight = CmmmCalculations.directCast(coin2.weight);
				amount = CmmmCalculations.convertFromInt(amountsIn[coinType2]);
				part1 = r * (balance + amount);
				if (part1 >= balance) {
					// r * (B0 + Din) >= B0 so use fees in
					part1 = balance + (1 - CmmmCalculations.directCast(coin2.tradeFeeIn)) * (part1 - balance);
				} else {
					// r * (B0 + Din) < B0 so use fees out
					part1 = balance - (balance - part1) / (1 - CmmmCalculations.directCast(coin2.tradeFeeOut));
				}
				prod += weight * Math.log(part1);
				sum += weight * part1;
			}
			prod = Math.exp(prod);

			cf = 2 * a * prod * sum / (prod + invariant) + ac * prod;
			if (cf <= invariant) {
				// is a lower bound, check min
				if (cf >= cfMin) {
					rMin = r;
					cfMin = cf;
				}
			}
			if (cf >= invariant) {
				// is an upper bound, check max
				if (cf <= cfMax) {
					rMax = r;
					cfMax = cf;
				}
			}
		}

		r = (cfMin == cfMax)? rMin: (rMin * cfMax + (rMax - rMin) * invariant - rMax * cfMin) / (cfMax - cfMin);
		let prevR = r;

		let fees: Record<CoinType, number> = {};
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = CmmmCalculations.convertFromInt(coin.balance);
			amount = CmmmCalculations.convertFromInt(amountsIn[coinType]);
			fees[coinType] = (r * (balance + amount) >= balance)?
				1 - CmmmCalculations.directCast(coin.tradeFeeIn):
				1 / (1 - CmmmCalculations.directCast(coin.tradeFeeOut));
		}

		let i = 0;
		let prod1;
		let sum1;
		let fee;
		let part2;
		let part3;
		let part4;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = CmmmCalculations.convertFromInt(coin.balance);
				weight = CmmmCalculations.directCast(coin.weight);
				amount = CmmmCalculations.convertFromInt(amountsIn[coinType]);
				fee = fees[coinType];
				part1 = balance + amount;
				part2 = fee * r * part1 + balance - fee * balance;
				part3 = weight * fee * part1;

				prod += weight * Math.log(part2);
				prod1 += part3 / part2;
				sum += weight * part2;
				sum1 += part3;
			}
			prod = Math.exp(prod);

			part3 = a * invariant * prod1;
			part4 = 2 * prod1 * (a * sum + ac * prod) + 2 * a * sum1;
			r = (r * part4 + invariant * (1 + invariant / prod) - (r * part3 + 2 * a * sum + ac * (prod + invariant)))
			/ (part4 - part3);

			if (Helpers.closeEnough(r, prevR, CmmmCalculations.convergenceBound)) {
				return Helpers.numberToF18(r);
			}

			prevR = r;
			i += 1;
		}
		throw Error("Newton diverged");
	}
}

import { Balance, CoinType, CoinsToBalance, PoolObject } from "../../../types";
import { Helpers } from "../../../general/utils";
import {
	Fixed,
	LocalNumber,
	OnChainScalar,
} from "../../../general/utils/fixed";

// This file is the typescript version of on-chain calculations. See the .move file for license info.
// These calculations are useful for estimating values on-chain but the JS number format is LESS PRECISE!
// Do not expect these values to be identical to their on-chain counterparts.

// The formula used here differs from that of Curve/Balancer. Our stables allow custom price pegs as opposed to
// the constant 1:1 equal-weight peg. Also our pools do not have an upper coin type limit (practically).

// Here is our construction:

// Start with a pool with balances b1,...,bn > 0. Call the tuple B = (b1,...,bn).
// Take weights w1,...,wn with 0 < wi < 1 and w1 + ... + wn = 1.
// Let X stand for the tuple (x1,...,xn) in Rn.
// For normalization we need the tuple T = (h,h,...,h) for some h > 0, solved for later.
// The invariant is defined as the value of this h.
// -- TODO: generalize this reference point T to lie on a chosen ray like (w1*h, w2*h, ..., wn*h).
// -- This would allow setting the swap price to be centered at a chosen balance distribution instead
// -- of the 1:1:...:1 diagonal balance distribution currently in use.

// Define the sum function S: Rn -> R as S(X) = w1*x1 + ... + wn*xn.
// Define the product function P: Rn -> R as P(X) = x1^w1 * ... * xn^wn.
// Note P(T) = S(T) = h.

// We want the sum to vanish on the coordinate hyperplanes too so instead use L where
// L(X) = [2P(X) / (P(X) + P(T))] * S(X)
// Then 0 <= L(X) < 2S(X) and L(T) = h.

// The constant price surface is defined by the equation L(X) = L(B) and the product curve by
// P(X) = P(B). Equivilantly by L(X) - L(B) = 0, P(X) - P(B) = 0.
// Take a flatness parameter A, 0 <= A <= 1. Then (1-A) is the dual parameter:
// 0 <= (1-A) <= 1 and A + (1-A) = 1. Take the linear combination of the defining functions
// C(X) = A * L(X) + (1-A) * P(X). The stable curve is defined as the solution to C(X) = C(B).

// Moreover we can solve for T from the equation C(T) = C(B), making all the following equal:
// C(B) = L(T) = S(T) = P(T) = h.

// The defining equation C(X) = C(B) can be rewritten in a computationally simpler form as
// P(X) * (2A * S(X) + (1-A) * P(X)) = h * (A * P(X) + h).

// To see these functions/equations in action check out https://www.desmos.com/calculator/eu5mfckuk9

export class CmmmCalculations {
	private static minWeight: LocalNumber = 0.01;
	// Having a minimum normalized weight imposes a limit on the maximum number of tokens;
	// i.e., the largest possible pool is one where all tokens have exactly the minimum weight.
	private static maxWeightedTokens: LocalNumber = 100;

	// Pool limits that arise from limitations in the fixed point power function (and the imposed 1:100 maximum weight
	// ratio).

	// Swap limits: amounts swapped may not be larger than this percentage of total balance.
	private static maxInRatio: LocalNumber = 0.3;
	private static maxOutRatio: LocalNumber = 0.3;

	// Invariant shrink limit: non-proportional exits cannot cause the invariant to decrease by less than this ratio.
	private static minInvariantRatio: LocalNumber = 0.7;
	// Invariant growth limit: non-proportional joins cannot cause the invariant to increase by more than this ratio.
	private static maxInvariantRatio: LocalNumber = 3;

	private static maxNewtonAttempts: LocalNumber = 255;
	private static convergenceBound: LocalNumber = 0.000_000_001;
	private static tolerance: LocalNumber = 0.000_000_000_000_1;
	private static validityTolerance: LocalNumber = 0.000_001;

	// Invariant is used to govern pool behavior. Swaps are operations which change the pool balances without changing
	// the invariant (ignoring fees) and investments change the invariant without changing the distribution of balances.
	// Invariant and pool lp are almost in 1:1 correspondence -- e.g. burning lp in a withdraw proportionally lowers the pool invariant.
	// The difference is as swap fees are absorbed they increase the invariant without incrasing total lp, increasing lp worth.
	// Every pool operation either explicitly or implicity calls this function.
	public static calcInvariant = (pool: PoolObject): number => {
		let flatness = Fixed.directCast(pool.flatness);

		// The value for h which we want is the one for which the balances vector B lies on the curve through T.
		// That is, C(T) = C(B). This turns out to be a quadratic equation which can be solved with
		// h = [sqrt[P(B) * (P(B) * (A*A + 4*(1-A)) + 8*A*S(B))] - A*P(B)] / 2.
		let sum = 0;
		let prod = 0;
		let balance;
		let weight;
		for (let coin of Object.values(pool.coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
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
		let flatness = Fixed.directCast(pool.flatness);
		let prod = 0;
		let sum = 0;
		let p0 = 0;
		let s0 = 0;

		let balance;
		let weight;
		let p;
		let s;
		for (let [coinType, coin] of Object.entries(pool.coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);

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

	// spot price is given in units of Bin / Bout
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
		let a = Fixed.directCast(pool.flatness);
		let part1 = CmmmCalculations.calcSpotPriceBody(pool);

		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let balanceIn = Fixed.convertFromInt(coinIn.balance);
		let balanceOut = Fixed.convertFromInt(coinOut.balance);
		let weightIn = Fixed.directCast(coinIn.weight);
		let weightOut = Fixed.directCast(coinOut.weight);
		let swapFeeIn = ignoreFees ? 0 : Fixed.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = ignoreFees ? 0 : Fixed.directCast(coinIn.tradeFeeOut);

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
		// The spot price formula comes from the partial derivatives of Cf, specifically -(dCf / dxOut) / (dCf / dxIn)
		let a: number = Fixed.directCast(pool.flatness);
		let ac: number = 1 - a;

		let prod: number = 0;
		let sum: number = 0;
		let balance: number;
		let weight: number;

		// The spot price formula requires knowing the value of the invariant. We need the prod and sum parts
		// also later on so no need to compute them twice by calling calcInvariant, just evaluate here.
		for (let coin of Object.values(pool.coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);

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
	): Balance => {
		if (coinTypeIn == coinTypeOut)
			throw Error("in and out must be different coins");
		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let swapFeeIn = Fixed.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = Fixed.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			return BigInt(0);
		}

		let flatness = Fixed.directCast(pool.flatness);
		let oldIn = Fixed.convertFromInt(coinIn.balance);
		let oldOut = Fixed.convertFromInt(coinOut.balance);

		let wIn = Fixed.directCast(coinIn.weight);
		let [prod, _sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeOut
		);

		let feedAmountIn = (1 - swapFeeIn) * Fixed.convertFromInt(amountIn);
		let newIn = oldIn + feedAmountIn;
		let prodRatio = Math.pow(newIn / oldIn, wIn);

		let newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		let xi = Math.pow(prod / newP0, 1 / wIn);
		let newS0 = s0 + wIn * feedAmountIn;

		let wOut = Fixed.directCast(coinOut.weight);

		let tokenAmountOut =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wOut,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		let amountOut = Fixed.convertToInt(
			(oldOut - tokenAmountOut) * (1 - swapFeeOut)
		);
		if (
			!CmmmCalculations.checkValid1dSwap(
				pool,
				coinTypeIn,
				coinTypeOut,
				amountIn,
				amountOut
			)
		)
			throw Error("invalid 1d swap");
		return amountOut;
	};

    // 1d optimized swap function for finding in given out. Returns the amount in.
	public static calcInGivenOut = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountOut: Balance
	): Balance => {
		if (coinTypeIn == coinTypeOut)
			throw Error("in and out must be different coins");
		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
		let swapFeeIn = Fixed.directCast(coinIn.tradeFeeIn);
		let swapFeeOut = Fixed.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			if (amountOut == BigInt(0)) return BigInt(0);
			throw Error("this swap is disabled");
		}

		let flatness = Fixed.directCast(pool.flatness);
		let oldIn = Fixed.convertFromInt(coinIn.balance);
		let oldOut = Fixed.convertFromInt(coinOut.balance);

		let wOut = Fixed.directCast(coinOut.weight);
		let [prod, _sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeIn
		);

		let feedAmountOut = Fixed.convertFromInt(amountOut) / (1 - swapFeeOut);
		let newOut = oldOut - feedAmountOut;
		let prodRatio = Math.pow(newOut / oldOut, wOut);

		let newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		let xi = Math.pow(prod / newP0, 1 / wOut);
		let newS0 = s0 - wOut * feedAmountOut;

		let wIn = Fixed.directCast(coinIn.weight);

		let tokenAmountIn =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wIn,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		let amountIn = Fixed.convertToInt(
			(tokenAmountIn - oldIn) / (1 - swapFeeIn)
		);
		if (
			!CmmmCalculations.checkValid1dSwap(
				pool,
				coinTypeIn,
				coinTypeOut,
				amountIn,
				amountOut
			)
		)
			throw Error("invalid 1d swap");
		return amountIn;
	};

	// For computing swap amounts. Given the current balances (and any other parameters) and an amounts in vector,
	// and a expected amounts out vector, determine the value of t > 0 such that t*expected_amounts_out
	// is a valid swap from balances corresponding to adding amounts_in to the pool. The correct value of t is the one for which
	// calc_swap_invariant(balances, ...parameters, amounts_in, t*expected_amounts_out) == calc_invariant_full(balances, ...parameters).
	public static calcSwapFixedIn = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		amountsOutDirection: CoinsToBalance
	): OnChainScalar => {
		let coins = pool.coins;
		let invariant = CmmmCalculations.calcInvariant(pool);
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let t = 1; // assume that the expected amounts out are close to the true amounts out
		// this allows faster convergence if the caller chooses expected_amounts_out well
		let prevT = t;
		let balance;
		let weight;
		let amountIn;
		let amountOut;
		let feeIn;
		let feeOut;
		let prod;
		let prod1;
		let sum;
		let sum1;
		let part1;
		let part2;
		let part3;
		let part4;
		let skip;
		let drainT = Number.POSITIVE_INFINITY;
		let shifter = 1;

		// make sure no disabled coin type is expected
		for (let [coinType, coin] of Object.entries(coins)) {
			amountOut = Fixed.convertFromInt(
				amountsOutDirection[coinType] || BigInt(0)
			);
			feeOut = Fixed.complement(Fixed.directCast(coin.tradeFeeOut));
			if (amountOut > 0) {
				if (feeOut == 0) {
					throw Error("this trade is disabled");
				} else {
					// pool is drained when b + Ain * (1 - Sin) - t * Aout / (1 - Sout) = 0, or t = (b + Ain * (1 - Sin)) * (1 - So) / Aout
					t =
						((Fixed.convertFromInt(coin.balance) +
							Fixed.convertFromInt(
								amountsIn[coinType] || BigInt(0)
							) *
								Fixed.complement(
									Fixed.directCast(coin.tradeFeeIn)
								)) /
							amountOut) *
						feeOut;
					drainT = Math.min(drainT, t);
				}
			}
		}
		// drain_t is the maximum t can possibly be. It will be 0 if expected amounts out is way too high.
		if (drainT == 0) return BigInt(0);
		while (shifter >= drainT) shifter /= 2;

		t = 1;

		for (let i = 0; i < CmmmCalculations.maxNewtonAttempts; ++i) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			skip = false;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin.balance);
				weight = Fixed.directCast(coin.weight);
				amountIn = Fixed.convertFromInt(
					amountsIn[coinType] || BigInt(0)
				);
				amountOut = Fixed.convertFromInt(
					amountsOutDirection[coinType] || BigInt(0)
				);
				feeIn = Fixed.complement(Fixed.directCast(coin.tradeFeeIn));
				feeOut = Fixed.complement(Fixed.directCast(coin.tradeFeeOut));

				// pseudoin
				part1 = feeIn * amountIn;
				// pseudoout
				part2 = (t * amountOut) / feeOut;
				// pseudobalance
				if (part2 >= balance + part1 + 1) {
					skip = true;
					break;
				}
				part3 = balance + part1 - part2;
				// for derivatives: weight * expected_amounts_out / fee_out
				part4 = (weight * amountOut) / feeOut;

				prod += weight * Math.log(part3);
				prod1 += part4 / part3;
				sum += weight * part3;
				sum1 += part4;
			}
			prod = Math.exp(prod);

			part1 = a * sum;
			part2 = ac * prod;
			part3 = part1 + part2;
			part4 = a * invariant * prod1;

			t =
				(a * (sum + 2 * t * sum1) +
					part3 +
					2 * prod1 * t * part3 -
					(t * part4 + invariant * (a + invariant / prod))) /
				(2 * (prod1 * part3 + a * sum1) - part4);

			if (
				Helpers.closeEnough(t, prevT, CmmmCalculations.convergenceBound)
			) {
				if (
					!CmmmCalculations.checkValidSwap(
						pool,
						amountsIn,
						1,
						amountsOutDirection,
						t
					)
				)
					throw Error("invalid swap");
				return Fixed.directUncast(t);
			}

			prevT = t;
		}
		throw Error("Newton diverged");
	};

	// Swaps but fixed amounts out. Given the pool's current state and a guaranteed out vector, and a expected in vector,
	// scale expected_amounts_in by t > 0 so that this swap is valid and return the correct value for t
	public static calcSwapFixedOut = (
		pool: PoolObject,
		amountsInDirection: CoinsToBalance,
		amountsOut: CoinsToBalance
	): OnChainScalar => {
		let coins = pool.coins;
		let invariant = CmmmCalculations.calcInvariant(pool);
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let t = 1; // assume that the expected amounts out are close to the true amounts out
		// this allows faster convergence if the caller chooses expected_amounts_out well
		let prevT = 0;
		let balance;
		let weight;
		let amountIn;
		let amountOut;
		let feeIn;
		let feeOut;
		let prod;
		let prod1;
		let sum;
		let sum1;
		let part1;
		let part2;
		let part3;
		let part4;

		// make sure no disabled coin type is expected
		for (let [coinType, coin] of Object.entries(coins)) {
			if (
				coin.tradeFeeOut >= Fixed.fixedOneB &&
				(amountsOut[coinType] || BigInt(0)) > BigInt(0)
			)
				throw Error("this trade is disabled");
		}

		for (let i = 0; i < CmmmCalculations.maxNewtonAttempts; ++i) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin.balance);
				weight = Fixed.directCast(coin.weight);
				amountIn = Fixed.convertFromInt(
					amountsInDirection[coinType] || BigInt(0)
				);
				amountOut = Fixed.convertFromInt(
					amountsOut[coinType] || BigInt(0)
				);
				feeIn = 1 - Fixed.directCast(coin.tradeFeeIn);
				feeOut = 1 - Fixed.directCast(coin.tradeFeeOut);

				// pseudoin expected
				part1 = feeIn * amountIn;
				// pseudoout
				part2 = amountOut == 0 ? 0 : amountOut / feeOut;
				// pseudobalance
				part3 = balance + t * part1 - part2;
				// for derivatives: weight * fee_in * expected_amounts_in
				part4 = weight * part1;

				prod += weight * Math.log(part3);
				prod1 += part4 / part3;
				sum += weight * part3;
				sum1 += part4;
			}
			prod = Math.exp(prod);

			part1 = 2 * a * sum;
			part2 = ac * prod;
			part3 = part1 + part2;
			part4 =
				(part3 + part2) * prod1 + 2 * a * sum1 - a * invariant * prod1;

			t =
				(t * part4 + invariant * (a + invariant / prod) - part3) /
				part4;

			if (
				Helpers.closeEnough(t, prevT, CmmmCalculations.convergenceBound)
			) {
				if (
					!CmmmCalculations.checkValidSwap(
						pool,
						amountsInDirection,
						1,
						amountsOut,
						t
					)
				)
					throw Error("invalid swap");
				return Fixed.directUncast(t);
			}

			prevT = t;
		}
		throw Error("Newton diverged");
	};

	// Return the expected lp ratio for this deposit
	public static calcDepositFixedAmounts = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): OnChainScalar => {
		let invariant = CmmmCalculations.calcInvariant(pool);
		let coins = pool.coins;
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let balance;
		let weight;
		let amount;
		let prod = 0;
		let sum = 0;
		let r = CmmmCalculations.calcDepositFixedAmountsInitialEstimate(
			pool,
			amountsIn
		);
		let prevR = r;

		let fees: Record<CoinType, number> = {};
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amount = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
			fees[coinType] =
				r * (balance + amount) >= balance
					? 1 - Fixed.directCast(coin.tradeFeeIn)
					: 1 / (1 - Fixed.directCast(coin.tradeFeeOut));
		}

		let i = 0;
		let prod1;
		let sum1;
		let fee;
		let part1;
		let part2;
		let part3;
		let part4;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin.balance);
				weight = Fixed.directCast(coin.weight);
				amount = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
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
			r =
				(r * part4 +
					invariant * (1 + invariant / prod) -
					(r * part3 + 2 * a * sum + ac * (prod + invariant))) /
				(part4 - part3);

			if (
				Helpers.closeEnough(r, prevR, CmmmCalculations.convergenceBound)
			) {
				let scalar = Fixed.directUncast(r);
				if (
					!CmmmCalculations.checkValidDeposit(pool, amountsIn, scalar)
				)
					throw Error("invalid deposit");
				return scalar;
			}

			prevR = r;
			i += 1;
		}
		throw Error("Newton diverged");
	};

	private static calcDepositFixedAmountsInitialEstimate = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): LocalNumber => {
		let invariant = CmmmCalculations.calcInvariant(pool);
		let coins = pool.coins;
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let balance;
		let weight;
		let prod = 0;
		let sum = 0;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(
				coin.balance + (amountsIn[coinType] || BigInt(0))
			);
			weight = Fixed.directCast(coin.weight);
			prod += weight * Math.log(balance);
			sum += weight * balance;
		}
		prod = Math.exp(prod);
		let cfMax = (2 * a * prod * sum) / (prod + invariant) + ac * prod;

		let r: number;
		let rMin = 0;
		let rMax = 1;
		let amount: number;
		let part1: number;
		let cf: number;
		let cfMin = 0;
		let skip: boolean;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			amount = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
			r = balance / (balance + amount);

			prod = 0;
			sum = 0;
			skip = false;
			for (let [coinType2, coin2] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin2.balance);
				weight = Fixed.directCast(coin2.weight);
				amount = Fixed.convertFromInt(amountsIn[coinType2]);
				part1 = r * (balance + amount);
				if (part1 >= balance) {
					// r * (B0 + Din) >= B0 so use fees in
					part1 =
						balance +
						(1 - Fixed.directCast(coin2.tradeFeeIn)) *
							(part1 - balance);
				} else {
					// r * (B0 + Din) < B0 so use fees out
					part1 =
						(balance - part1) /
						Fixed.complement(Fixed.directCast(coin.tradeFeeOut));
					if (part1 + 1 >= balance) {
						skip = true;
						break;
					} else {
						part1 = balance - part1;
					}
				}
				prod += weight * Math.log(part1);
				sum += weight * part1;
			}
			if (skip) {
				// this discontinuity occurs beyond draining the pool
				continue;
			}
			prod = Math.exp(prod);

			cf = (2 * a * prod * sum) / (prod + invariant) + ac * prod;
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

		r =
			cfMin == cfMax
				? rMin
				: (rMin * cfMax + (rMax - rMin) * invariant - rMax * cfMin) /
				  (cfMax - cfMin);
		return r;
	};

	// Return the expected amounts out for this withdrawal
	public static calcWithdrawFlpAmountsOut = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): CoinsToBalance => {
		let invariant = CmmmCalculations.calcInvariant(pool);
		let coins = pool.coins;
		let lpr = lpRatio;
		let lpc = 1 - lpr;
		let scaledInvariant = invariant * lpr;
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let i;
		let prevR = 0;
		let balance;
		let weight;
		let amountOut;
		let fee;
		let prod;
		let prod1;
		let sum;
		let sum1;
		let part1;
		let part2;
		let part3;
		let part4;
		let skip;
		let shrinker = 1;

		let [r, rDrain] =
			CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate(
				pool,
				amountsOutDirection,
				lpRatio
			);
		while (shrinker >= rDrain) shrinker /= 2;

		let fees: Record<CoinType, number> = {};
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amountOut = Fixed.convertFromInt(
				amountsOutDirection[coinType] || BigInt(0)
			);
			fees[coinType] =
				balance * lpc >= r * amountOut
					? 1 - Fixed.directCast(coin.tradeFeeIn)
					: 1 / (1 - Fixed.directCast(coin.tradeFeeOut));
		}

		i = 0;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			skip = false;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin.balance);
				weight = Fixed.directCast(coin.weight);
				amountOut = Fixed.convertFromInt(
					amountsOutDirection[coinType] || BigInt(0)
				);
				fee = fees[coinType];

				part1 = balance * (lpr + lpc * fee);
				part2 = fee * r * amountOut;
				if (part2 + 1 >= part1) {
					// Overshot and drained pool. Set t to be closer to t_max and try again.
					skip = true;
					break;
				} else {
					part1 -= part2;
				}

				part2 = weight * fee * amountOut;

				prod += weight * Math.log(part1);
				prod1 += part2 / part1;
				sum += weight * part1;
				sum1 += part2;
			}
			if (skip) {
				r = rDrain - shrinker / 2 ** i;
				i += 1;
				continue;
			}
			prod = Math.exp(prod);

			part1 = prod / scaledInvariant;
			part2 = 2 * a * sum;
			part3 = ac * (prod * part1 + 2 * prod + scaledInvariant) + part2;
			part4 = part3 * prod1 + 2 * a * (part1 + 1) * sum1;

			r =
				(r * part4 +
					part3 +
					part1 * part2 -
					prod -
					scaledInvariant * (2 + scaledInvariant / prod)) /
				part4;

			if (
				Helpers.closeEnough(r, prevR, CmmmCalculations.convergenceBound)
			) {
				let returner: CoinsToBalance = {};
				for (let coinType of Object.keys(coins)) {
					returner[coinType] = Fixed.convertToInt(
						r *
							Fixed.convertFromInt(
								amountsOutDirection[coinType] || BigInt(0)
							)
					);
				}
				if (
					!CmmmCalculations.checkValidWithdraw(
						pool,
						returner,
						lpRatio
					)
				)
					throw Error("invalid withdraw");
				return returner;
			}

			prevR = r;
			i += 1;
		}
		throw Error("Newton diverged");
	};

	private static calcWithdrawFlpAmountsOutInitialEstimate = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): [LocalNumber, LocalNumber] => {
		let invariant = CmmmCalculations.calcInvariant(pool);
		let coins = pool.coins;
		let lpr = lpRatio;
		let lpc = 1 - lpr;
		let scaledInvariant = invariant * lpr;
		let a = Fixed.directCast(pool.flatness);
		let ac = 1 - a;
		let keepT: boolean;
		let tDrain;
		let t;
		let cf;
		let tMin;
		let cfMin;
		let tMax;
		let cfMax;
		let balance;
		let weight;
		let amountOut;
		let fee;
		let prod;
		let sum;
		let part1;
		let part2;
		let part3;

		// the biggest cfMax can possibly be is f(0) which is this:
		tMax = 0;
		prod = 0;
		sum = 0;
		for (let coin of Object.values(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			fee = Fixed.directCast(coin.tradeFeeIn);
			part1 = balance * (1 + lpr * fee - fee);
			prod += weight * Math.log(part1);
			sum += weight * part1;
		}
		prod = Math.exp(prod);
		cfMax = (2 * a * prod * sum) / (prod + scaledInvariant) + ac * prod;

		// the smallest cfMin can be is 0 which occurs when the pool is drained
		cfMin = 0;
		tMin = Number.POSITIVE_INFINITY;
		for (let [coinType, coin] of Object.entries(coins)) {
			amountOut = Fixed.convertFromInt(
				amountsOutDirection[coinType] || BigInt(0)
			);
			if (amountOut == 0) continue;
			t =
				(Fixed.convertFromInt(coin.balance) *
					Fixed.complement(
						Fixed.directCast(coin.tradeFeeOut) * lpRatio
					)) /
				amountOut;
			if (t < tMin) tMin = t;
		}
		tDrain = tMin;

		// remaining test points are the CF discontinuities: where B0 - t*D = R*B0
		for (let [coinTypeT, coinT] of Object.entries(coins)) {
			amountOut = Fixed.convertFromInt(
				amountsOutDirection[coinTypeT] || BigInt(0)
			);
			if (amountOut == 0) continue;
			balance = Fixed.convertFromInt(coinT.balance);
			t = (balance * lpc) / amountOut;
			prod = 0;
			sum = 0;
			keepT = true;
			for (let [coinType, coin] of Object.entries(coins)) {
				balance = Fixed.convertFromInt(coin.balance);
				weight = Fixed.directCast(coin.weight);
				amountOut = Fixed.convertFromInt(
					amountsOutDirection[coinType] || BigInt(0)
				);
				part1 = t * amountOut;
				if (part1 >= balance) {
					// this t is too large to be a bound because B0 - t*D overdraws the pool
					keepT = false;
					break;
				}
				part1 = balance - part1;
				part2 = lpr * balance;
				part3 =
					part1 >= part2
						? part2 +
						  Fixed.complement(Fixed.directCast(coin.tradeFeeIn)) *
								(part1 - part2)
						: part2 -
						  (part2 - part1) /
								Fixed.complement(
									Fixed.directCast(coin.tradeFeeOut)
								);
				prod += weight * Math.log(part3);
				sum += weight * part3;
			}
			if (keepT) {
				prod = Math.exp(prod);
				cf =
					(2 * a * prod * sum) / (prod + scaledInvariant) + ac * prod;
				if (cf >= scaledInvariant) {
					// upper bound, check against cfMax
					if (cf <= cfMax) {
						tMax = t;
						cfMax = cf;
					}
				}
				if (cf <= scaledInvariant) {
					// lower bound, check against cfMin
					if (cf >= cfMin) {
						tMin = t;
						cfMin = cf;
					}
				}
			}
		}

		// initial estimate is the linear interpolation between discontinuity bounds
		t =
			cfMax == cfMin
				? tMin
				: (tMin * cfMax +
						tMax * scaledInvariant -
						tMax * cfMin -
						tMin * scaledInvariant) /
				  (cfMax - cfMin);

		return [t, tDrain];
	};

	// Dusty direct all-coin deposit, returns the number s >= 0 so that amounts_in = s*B0 + dust.
	// When performing an all-coin deposit, call this function to get t then split amounts_in into s*B0 + dust.
	// At least one coordinate of dust will be 0. Send the s*B0 balances into the pool and mint s*total_lp.
	// The caller keeps the dust.
	public static calcAllCoinDeposit = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): CoinsToBalance => {
		let coins = pool.coins;

		let balance;
		let amountIn;

		let s;
		let sMin = Number.POSITIVE_INFINITY;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amountIn = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));

			s = amountIn / balance;

			if (s < sMin) sMin = s;
		}

		let returner: CoinsToBalance = {};
		for (let coinType of Object.keys(coins))
			returner[coinType] = Helpers.blendedOperations.mulNBB(
				sMin,
				amountsIn[coinType] || BigInt(0)
			);
		return returner;
	};

	// Dusty direct all-coin withdraw, returns the number s >= 0 so that amounts_out + dust = s*B0.
	// The normal all-coin withdraw (take this exact amount of lp and give however much balances out)
	// should be done directly without this function -- just burn the lp and give the user
	// lp/total_lp * balance_i in each coordinate. This function is for finding how much lp it takes to
	// ensure that at least amounts_out comes out.
	public static calcAllCoinWithdraw = (
		pool: PoolObject,
		amountsOut: CoinsToBalance
	): CoinsToBalance => {
		let coins = pool.coins;

		let balance;
		let amountOut;

		let s;
		let sMax = 0;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amountOut = Fixed.convertFromInt(amountsOut[coinType] || BigInt(0));

			s = amountOut / balance;

			if (s > sMax) sMax = s;
		}

		let returner: CoinsToBalance = {};
		for (let coinType of Object.keys(coins))
			returner[coinType] = Helpers.blendedOperations.mulNBB(
				sMax,
				amountsOut[coinType] || BigInt(0)
			);
		return returner;
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
		//let bottomNeg;

		let prevX = x;

		let i = 0;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			xw = Math.pow(x, w);

			topPos = x * (xw * (c1 * x + c2 * xw + c3) + c4);
			topNeg = x * (xw * (c5 * xw + c6));
			bottomPos = c7 * x + c8 * xw + c9;
			//bottomNeg = c10;

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
				Helpers.closeEnough(x, prevX, CmmmCalculations.convergenceBound)
			) {
				return x;
			}

			prevX = x;
			i = i + 1;
		}
		throw Error("Newton diverged");
	};

	// Compute the invariant before swap and pseudoinvariant (invariant considering fees)
	// after the swap and see if they are the same up to a tolerance.
	// It also checks that this balance does not drain the pool i.e. the final balance is at least 1.
	// The scalars are here to avoid unnecessary vector creation. In most calls one scalar will be 10^18 (1).
	public static checkValidSwap = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		amountsInScalar: LocalNumber,
		amountsOut: CoinsToBalance,
		amountsOutScalar: LocalNumber
	): boolean => {
		let coins = pool.coins;
		let flatness = Fixed.directCast(pool.flatness);

		// balance = balances[i]
		let balance;
		// pseudobalance = balance + feedAmountIn - feedAmountOut
		let pseudobalance;
		// postbalance = balance + amountIn - amountOut
		let postbalance;
		let weight;
		let amountIn;
		let amountOut;
		let feedAmountIn;
		let feedAmountOut;

		let preprod = 0;
		let presum = 0;
		let pseudoprod = 0;
		let pseudosum = 0;
		let postprod = 0;
		let postsum = 0;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			amountIn =
				Fixed.convertFromInt(amountsIn[coinType] || BigInt(0)) *
				amountsInScalar;
			amountOut =
				Fixed.convertFromInt(amountsOut[coinType] || BigInt(0)) *
				amountsOutScalar;
			if (amountIn > 0 && amountOut > 0) return false;
			feedAmountIn = amountIn * (1 - Fixed.directCast(coin.tradeFeeIn));
			feedAmountOut =
				amountOut == 0
					? 0
					: amountOut / (1 - Fixed.directCast(coin.tradeFeeOut));

			postbalance = balance + amountIn;
			if (amountOut > postbalance + 1) return false;
			postbalance -= -amountOut;
			pseudobalance = balance + feedAmountIn;
			if (feedAmountOut > pseudobalance + 1) return false;
			pseudobalance -= -feedAmountOut;

			preprod += weight * Math.log(balance);
			presum += weight * balance;
			postprod += weight * Math.log(postbalance);
			postsum += weight * postbalance;
			pseudoprod += weight * Math.log(pseudobalance);
			pseudosum += weight * pseudobalance;
		}
		preprod = Math.exp(preprod);
		postprod = Math.exp(postprod);
		pseudoprod = Math.exp(pseudoprod);

		let preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		let postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		let pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				Fixed.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	// Compute the invariant before swap and pseudoinvariant (invariant considering fees)
	// after the swap and see if they are the same up to a tolerance.
	// It also checks that this balance does not drain the pool i.e. the final balance is at least 1.
	public static checkValid1dSwap = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountInB: Balance,
		amountOutB: Balance
	): boolean => {
		if (coinTypeIn == coinTypeOut) return false;
		let coins = pool.coins;
		let flatness = Fixed.directCast(pool.flatness);

		// balance = balances[i]
		let balance;
		// pseudobalance = balance + feed amount in - feed amount out
		let pseudobalance;
		// postbalance = balance + amount in - amount out
		let postbalance;
		let weight;
		let amountIn = Fixed.convertFromInt(amountInB);
		let amountOut = Fixed.convertFromInt(amountOutB);
		let feedAmountIn =
			amountIn * (1 - Fixed.directCast(coins[coinTypeIn].tradeFeeIn));
		let feedAmountOut =
			amountOut == 0
				? 0
				: amountOut /
				  (1 - Fixed.directCast(coins[coinTypeOut].tradeFeeOut));

		let preprod = 0;
		let presum = 0;
		let pseudoprod = 0;
		let pseudosum = 0;
		let postprod = 0;
		let postsum = 0;
		let p;
		let s;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);

			p = weight * Math.log(balance);
			s = weight * balance;

			preprod += p;
			presum += s;

			if (coinType == coinTypeIn) {
				pseudobalance = balance + feedAmountIn;
				postbalance = balance + amountIn;

				pseudoprod += weight * Math.log(pseudobalance);
				pseudosum += weight * pseudobalance;
				postprod += weight * Math.log(postbalance);
				postsum += weight * postbalance;
			} else {
				if (coinType == coinTypeOut) {
					if (feedAmountOut > balance + 1 || amountOut > balance + 1)
						return false;
					pseudobalance = balance - feedAmountOut;
					postbalance = balance - amountOut;

					pseudoprod += weight * Math.log(pseudobalance);
					pseudosum += weight * pseudobalance;
					postprod += weight * Math.log(postbalance);
					postsum += weight * postbalance;
				} else {
					pseudoprod += p;
					pseudosum += s;
					postprod += p;
					postsum += s;
				}
			}
		}
		preprod = Math.exp(preprod);
		postprod = Math.exp(postprod);
		pseudoprod = Math.exp(pseudoprod);

		let preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		let postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		let pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				Fixed.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	// A fixed amount investment is a swap followed by an all coin investment. This function checks that the
	// intermediate swap is allowed and corresponds to the claimed lp ratio.
	public static checkValidDeposit = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		lpRatioRaw: OnChainScalar
	): boolean => {
		// The supposed swap is from B0 to R*(B0 + Din)
		// This test is check_valid_swap for those data

		let coins = pool.coins;
		let lpRatio = Fixed.directCast(lpRatioRaw);
		if (lpRatio > 1) return false;

		let flatness = Fixed.directCast(pool.flatness);

		// balance = balances[i]
		let balance;
		let weight;
		// amount = amountsIn[i]
		let amount;
		// postbalance = lpRatio * (balance + amount)
		let postbalance;
		// pseudobalance = fee(postbalance - balance) + balance
		let pseudobalance;
		// diff = postbalance - balance
		let diff;
		// pseudodiff = fee(diff)
		let pseudodiff;

		let preprod = 0;
		let presum = 0;
		let pseudoprod = 0;
		let pseudosum = 0;
		let postprod = 0;
		let postsum = 0;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			amount = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
			postbalance = lpRatio * (balance + amount);

			if (postbalance >= balance) {
				// use fee in
				diff = postbalance - balance;
				pseudodiff = diff * (1 - Fixed.directCast(coin.tradeFeeIn));
				pseudobalance = balance + pseudodiff;
			} else {
				// use fee out
				diff = balance - postbalance;
				pseudodiff =
					diff == 0
						? 0
						: diff / (1 - Fixed.directCast(coin.tradeFeeOut));
				if (pseudodiff >= balance + 1) return false;
				pseudobalance = balance - pseudodiff;
			}

			preprod += weight * Math.log(balance);
			presum += weight * balance;
			postprod += weight * Math.log(postbalance);
			postsum += weight * postbalance;
			pseudoprod += weight * Math.log(pseudobalance);
			pseudosum += weight * pseudobalance;
		}
		preprod = Math.exp(preprod);
		postprod = Math.exp(postprod);
		pseudoprod = Math.exp(pseudoprod);

		let preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		let postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		let pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				Fixed.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	// A fixed lp withdraw is an all coin withdraw followed by a swap.
	// This function checks that the swap is valid.
	public static checkValidWithdraw = (
		pool: PoolObject,
		amountsOutSrc: CoinsToBalance,
		lpRatio: LocalNumber
	): boolean => {
		// Check that the swap from R*B0 to B0 - Dout is valid

		let coins = pool.coins;
		if (lpRatio > 1) return false;

		let flatness = Fixed.directCast(pool.flatness);

		// balance = balances[i]
		let balance;
		let weight;
		// amount is scaled amounts out at i
		let amount;
		// scaledBalance = lpRatio * balance
		let scaledBalance;
		// postbalance = balance - amount
		let postbalance;
		// pseudobalance is postbalance but considering fees
		let pseudobalance;
		let diff;
		let pseudodiff;

		let preprod = 0;
		let presum = 0;
		let pseudoprod = 0;
		let pseudosum = 0;
		let postprod = 0;
		let postsum = 0;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			scaledBalance = lpRatio * balance;
			weight = Fixed.directCast(coin.weight);
			amount = Fixed.convertFromInt(amountsOutSrc[coinType] || BigInt(0));
			if (amount > scaledBalance + 1) return false;
			postbalance = balance - amount;

			if (postbalance >= scaledBalance) {
				// use fee in
				diff = postbalance - scaledBalance;
				pseudodiff =
					diff * Fixed.complement(Fixed.directCast(coin.tradeFeeIn));
				pseudobalance = scaledBalance + pseudodiff;
			} else {
				// use fee out
				diff = scaledBalance - postbalance;
				pseudodiff =
					diff == 0
						? 0
						: diff /
						  Fixed.complement(Fixed.directCast(coin.tradeFeeOut));
				if (pseudodiff > scaledBalance + 1) return false;
				pseudobalance = scaledBalance - pseudodiff;
			}

			preprod += weight * Math.log(scaledBalance);
			presum += weight * scaledBalance;
			postprod += weight * Math.log(postbalance);
			postsum += weight * postbalance;
			pseudoprod += weight * Math.log(pseudobalance);
			pseudosum += weight * pseudobalance;
		}
		preprod = Math.exp(preprod);
		postprod = Math.exp(postprod);
		pseudoprod = Math.exp(pseudoprod);

		let preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		let postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		let pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				Fixed.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	// get an estimate for outGivenIn based on the spot price
	public static getEstimateOutGivenIn = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountIn: Balance
	): Balance =>
		Helpers.blendedOperations.mulNBB(
			CmmmCalculations.calcSpotPriceWithFees(
				pool,
				coinTypeIn,
				coinTypeOut
			),
			amountIn
		);

	// get an estimate for inGivenOut based on the spot price
	public static getEstimateInGivenOut = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountOut: Balance
	): Balance =>
		Helpers.blendedOperations.mulNBB(
			1 /
				CmmmCalculations.calcSpotPriceWithFees(
					pool,
					coinTypeIn,
					coinTypeOut
				),
			amountOut
		);

	// get an estimate for swapFixedIn using the spot prices
	// returns t > 0 such that t*amountsOutDirection agrees with amountsIn wrt spot prices
	public static getEstimateSwapFixedIn = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		amountsOutDirection: CoinsToBalance
	): LocalNumber => {
		// find t such that Ain + t*Aout lies in the tangent plane to the swap surface at balances in the given directions

		// the gradient of the invariant function with fees is (with spot body E)
		// Win * (1 - Sin) * (E + 2*A * Bin) / Bin or
		// Wout * (E + 2*A * Bout) / (1-Sout) * Bout
		// depending on whether the balance is coming in or going out

		let coins = pool.coins;
		let spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		let a = Fixed.directCast(pool.flatness);

		let balance;
		let grad;
		let amountIn;
		let amountOut;
		let inDotGrad = 0;
		let outDotGrad = 0;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amountIn = Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
			amountOut = Fixed.convertFromInt(
				amountsOutDirection[coinType] || BigInt(0)
			);
			grad =
				amountIn == 0
					? (Fixed.directCast(coin.weight) *
							(spotBody + 2 * a * balance)) /
					  (balance * (1 - Fixed.directCast(coin.tradeFeeOut)))
					: (Fixed.directCast(coin.weight) *
							(1 - Fixed.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
					  balance;
			inDotGrad += amountIn * grad;
			outDotGrad += amountOut * grad;
		}

		return inDotGrad / outDotGrad;
	};

	// get an estimate for swapFixedOut using the spot prices
	// returns t > 0 such that t*amountsInDirection agrees with amountsOut wrt spot prices
	public static getEstimateSwapFixedOut = (
		pool: PoolObject,
		amountsInDirection: CoinsToBalance,
		amountsOut: CoinsToBalance
	): LocalNumber => {
		// find t such that Ain + t*Aout lies in the tangent plane to the swap surface at balances in the given directions

		// the gradient of the invariant function with fees is (with spot body E)
		// Win * (1 - Sin) * (E + 2*A * Bin) / Bin or
		// Wout * (E + 2*A * Bout) / (1-Sout) * Bout
		// depending on whether the balance is coming in or going out

		let coins = pool.coins;
		let spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		let a = Fixed.directCast(pool.flatness);

		let balance;
		let grad;
		let amountIn;
		let amountOut;
		let inDotGrad = 0;
		let outDotGrad = 0;
		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			amountIn = Fixed.convertFromInt(
				amountsInDirection[coinType] || BigInt(0)
			);
			amountOut = Fixed.convertFromInt(amountsOut[coinType] || BigInt(0));
			grad =
				amountIn == 0
					? (Fixed.directCast(coin.weight) *
							(spotBody + 2 * a * balance)) /
					  (balance * (1 - Fixed.directCast(coin.tradeFeeOut)))
					: (Fixed.directCast(coin.weight) *
							(1 - Fixed.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
					  balance;
			inDotGrad += amountIn * grad;
			outDotGrad += amountOut * grad;
		}

		return outDotGrad / inDotGrad;
	};

	// Calculate an estimate for lpRatio using the spot price (linear estiamtion)
	// This estimation will be very good for small values in amountsIn
	public static getEstimateDepositFixedAmounts = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): LocalNumber => {
		// Initial estimate comes from testing the discontinuities and doing a linear
		// approximation off the two closest test points. We use it to get the correct fees.
		let r0 = CmmmCalculations.calcDepositFixedAmountsInitialEstimate(
			pool,
			amountsIn
		);

		// Now r0 is on the correct side of B0 as the final t*(B0+Din). This tells us which fees apply.
		// All we have to do is find the value of r for which r*(B0+Din) lies on the feed tangent plane at B0.

		// the gradient of the invariant function with fees is (with spot body E)
		// Win * (1 - Sin) * (E + 2*A * Bin) / Bin or
		// Wout * (E + 2*A * Bout) / (1-Sout) * Bout
		// depending on whether the balance is coming in or going out

		let coins = pool.coins;
		let spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		let a = Fixed.directCast(pool.flatness);

		// dot(B0, g)
		let d1 = 0;
		// dot(B0 + Din, g)
		let d2 = 0;

		let balance;
		let weight;
		let amount;
		let grad;
		let scaledAmount;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			amount =
				balance +
				Fixed.convertFromInt(amountsIn[coinType] || BigInt(0));
			scaledAmount = amount * r0;

			grad =
				scaledAmount < balance
					? // use amount out
					  (weight * (spotBody + 2 * a * balance)) /
					  (balance * (1 - Fixed.directCast(coin.tradeFeeOut)))
					: // use amount in
					  (weight *
							(1 - Fixed.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
					  balance;

			d1 += balance * grad;
			d2 += amount * grad;
		}

		return d1 / d2;
	};

	// Calculate an estimate for amountsOut using the spot price (linear estiamtion)
	// This estimation will be very good for lpRatios close to 1
	// Since we still need the out vector for its direction we return t s.t. t*amountsOutDirection is the estimate.
	public static getEstimateWithdrawFlpAmountsOut = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): LocalNumber => {
		// Initial estimate comes from testing the discontinuities and doing a linear
		// approximation off the two closest test points. We use it to get the correct fees.
		let [r0, _rDrain] =
			CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate(
				pool,
				amountsOutDirection,
				lpRatio
			);

		// Now r0 is on the correct side of R*B0 as the final B0-t*Deout. This tells us which fees apply.
		// All we have to do is find the value of t for which B0-t*Deout lies on the feed tangent plane at R*B0.

		// the gradient of the invariant function with fees is (with spot body E)
		// Win * (1 - Sin) * (E + 2*A * Bin) / Bin or
		// Wout * (E + 2*A * Bout) / (1-Sout) * Bout
		// depending on whether the balance is coming in or going out

		let coins = pool.coins;
		// Swap center is R*B0, not B0. Luckily the spot body formula is homogeneous.
		let spotBody = CmmmCalculations.calcSpotPriceBody(pool) * lpRatio;
		let a = Fixed.directCast(pool.flatness);

		// dot(B0, g)
		let d1 = 0;
		// dot(Deout, g)
		let d2 = 0;

		let balance;
		let scaledAmount;
		let weight;
		let amount;
		let grad;

		for (let [coinType, coin] of Object.entries(coins)) {
			balance = Fixed.convertFromInt(coin.balance);
			weight = Fixed.directCast(coin.weight);
			amount =
				balance +
				Fixed.convertFromInt(
					amountsOutDirection[coinType] || BigInt(0)
				);
			scaledAmount = amount * r0;

			grad =
				scaledAmount < balance
					? // use amount out
					  (weight * (spotBody + 2 * a * balance)) /
					  (balance * (1 - Fixed.directCast(coin.tradeFeeOut)))
					: // use amount in
					  (weight *
							(1 - Fixed.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
					  balance;

			d1 += balance * grad;
			d2 += amount * grad;
		}

		return ((1 - lpRatio) * d1) / d2;
	};
}

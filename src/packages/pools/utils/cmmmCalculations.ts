import { Casting, Helpers } from "../../../general/utils";
import {
	FixedUtils,
	type LocalNumber,
	type OnChainScalar,
} from "../../../general/utils/fixedUtils";
import type {
	Balance,
	CoinsToBalance,
	CoinType,
	PoolObject,
} from "../../../types";

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

/**
 * Implements the pool invariant and local swap, liquidity, and validity math.
 *
 * The formulas mirror the pool Move package. This implementation uses
 * JavaScript `number` values internally, so it is useful for estimates and
 * input validation but can differ from on-chain results at large values or
 * near rounding boundaries. Coin amounts in the public methods use smallest
 * units. Pool weights, fees, balances, and fixed ratios use the pool's fixed
 * scalars unless a parameter is documented as a decimal `number`.
 *
 * @example
 * ```typescript
 * const amountOut = CmmmCalculations.calcOutGivenIn(
 * 	pool,
 * 	"0x2::sui::SUI",
 * 	"0x<package>::coin::USDC",
 * 	1_000_000_000n,
 * );
 * ```
 */
export class CmmmCalculations {
	private static maxNewtonAttempts: LocalNumber = 255;
	private static convergenceBound: LocalNumber = 0.000_000_001;
	private static tolerance: LocalNumber = 0.000_000_000_000_1;
	private static validityTolerance: LocalNumber = 0.000_001;

	/**
	 * Calculates the pool invariant from normalized balances, weights, and flatness.
	 *
	 * Swaps preserve this value before fees. Liquidity changes alter it and are
	 * therefore related to LP value. The result is a local floating-point value,
	 * not an on-chain fixed-point integer.
	 *
	 * @param pool - The pool state containing normalized balances and fixed-point parameters.
	 * @returns The invariant in normalized decimal units.
	 */
	public static calcInvariant = (pool: PoolObject): number => {
		const flatness = FixedUtils.directCast(pool.flatness);

		// The value for h which we want is the one for which the balances vector B lies on the curve through T.
		// That is, C(T) = C(B). This turns out to be a quadratic equation which can be solved with
		// h = [sqrt[P(B) * (P(B) * (A*A + 4*(1-A)) + 8*A*S(B))] - A*P(B)] / 2.
		let sum = 0;
		let prod = 0;
		let balance;
		let weight;
		for (const coin of Object.values(pool.coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			sum += weight * balance;
			prod += weight * Math.log(balance);
		}
		prod = Math.exp(prod);

		return this.calcInvariantQuadratic(prod, sum, flatness);
	};

	/**
	 * Solves the invariant's quadratic equation for a weighted product and sum.
	 *
	 * Pass decimal values produced by `FixedUtils.directCast`, not raw on-chain
	 * fixed-point integers.
	 *
	 * @param prod - The weighted product of normalized balances.
	 * @param sum - The weighted sum of normalized balances.
	 * @param flatness - The decimal flatness value in the inclusive range `0` to `1`.
	 * @returns The invariant solution `h`.
	 */
	public static calcInvariantQuadratic = (
		prod: number,
		sum: number,
		flatness: number
	): number =>
		(Math.sqrt(
			prod *
				(prod * (flatness * flatness + (1 - flatness) * 4) + flatness * sum * 8)
		) -
			flatness * prod) /
		2;

	/**
	 * Returns invariant components with one coin removed for one-dimensional math.
	 *
	 * The tuple is `[prod, sum, p0, s0, h]`. `prod` and `sum` include every
	 * coin. `p0` and `s0` omit `index`. `h` is the full pool invariant.
	 *
	 * @param pool - The pool state used for the calculation.
	 * @param index - The coin type whose contribution `p0` and `s0` omit.
	 * @returns The weighted product, weighted sum, reduced product, reduced sum, and invariant.
	 */
	public static calcInvariantComponents = (
		pool: PoolObject,
		index: CoinType
	): [prod: number, sum: number, p0: number, s0: number, h: number] => {
		const flatness = FixedUtils.directCast(pool.flatness);
		let prod = 0;
		let sum = 0;
		let p0 = 0;
		let s0 = 0;

		let balance;
		let weight;
		let p;
		let s;
		for (const [coinType, coin] of Object.entries(pool.coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);

			p = weight * Math.log(balance);
			s = weight * balance;

			prod += p;
			sum += s;

			if (coinType !== index) {
				p0 += p;
				s0 += s;
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

	/**
	 * Calculates the fee-free spot price from one pool coin to another.
	 *
	 * The result is the normalized `coinIn` amount per normalized `coinOut`
	 * amount. `Pool.getSpotPrice` applies decimal scalars when it exposes this
	 * value to callers.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param coinTypeIn - The input coin type.
	 * @param coinTypeOut - The output coin type.
	 * @returns The fee-free normalized spot-price ratio.
	 */
	public static calcSpotPrice = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType
	): number =>
		CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut, true);

	/**
	 * Calculates a spot price with optional pool fee terms.
	 *
	 * The result is the normalized `coinIn` amount per normalized `coinOut`
	 * amount. Set `ignoreFees` to `true` to omit swap and DAO fee terms.
	 *
	 * @param pool - The pool state used for the invariant and fee metadata.
	 * @param coinTypeIn - The input coin type.
	 * @param coinTypeOut - The output coin type.
	 * @param ignoreFees - Whether to omit the fee terms. The default is `false`.
	 * @returns The normalized spot-price ratio.
	 */
	public static calcSpotPriceWithFees = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		ignoreFees?: boolean
	): number => {
		const a = FixedUtils.directCast(pool.flatness);
		const part1 = CmmmCalculations.calcSpotPriceBody(pool);

		const coinIn = pool.coins[coinTypeIn];
		const coinOut = pool.coins[coinTypeOut];
		const balanceIn = FixedUtils.directCast(coinIn.normalizedBalance);
		const balanceOut = FixedUtils.directCast(coinOut.normalizedBalance);
		const weightIn = FixedUtils.directCast(coinIn.weight);
		const weightOut = FixedUtils.directCast(coinOut.weight);
		const swapFeeIn = ignoreFees ? 0 : FixedUtils.directCast(coinIn.tradeFeeIn);
		const swapFeeOut = ignoreFees
			? 0
			: FixedUtils.directCast(coinIn.tradeFeeOut);

		const sbi = weightOut * balanceIn;
		// this is the only place where fee values are used
		const sbo =
			(1 -
				(ignoreFees
					? 0
					: Casting.bpsToPercentage(
							pool.daoFeePoolObject?.feeBps ?? BigInt(0)
						))) *
			(1 - swapFeeIn) *
			(1 - swapFeeOut) *
			weightIn *
			balanceOut;

		return (
			(sbi * (part1 + 2 * a * balanceOut)) / (sbo * (part1 + 2 * a * balanceIn))
		);
	};

	// The spot price formula contains a factor of C0^2 / P(B0) + (1-A)P(B0), this returns that
	private static calcSpotPriceBody = (pool: PoolObject): number => {
		// The spot price formula comes from the partial derivatives of Cf, specifically -(dCf / dxOut) / (dCf / dxIn)
		const a: number = FixedUtils.directCast(pool.flatness);
		const ac: number = 1 - a;

		let prod = 0;
		let sum = 0;
		let balance: number;
		let weight: number;

		// The spot price formula requires knowing the value of the invariant. We need the prod and sum parts
		// also later on so no need to compute them twice by calling calcInvariant, just evaluate here.
		for (const coin of Object.values(pool.coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);

			prod += weight * Math.log(balance);
			sum += weight * balance;
		}
		prod = Math.exp(prod);

		const invarnt = CmmmCalculations.calcInvariantQuadratic(prod, sum, a);

		return (invarnt * invarnt) / prod + ac * prod;
	};

	/**
	 * Calculates the exact output for a one-dimensional exact-input swap.
	 *
	 * `amountIn` and the return value use the respective coin's smallest unit.
	 * The calculation applies the pool's input and output swap fees. Protocol and
	 * DAO fees are applied by the higher-level `Pool` wrapper, not here.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param coinTypeIn - The coin type entering the pool.
	 * @param coinTypeOut - The coin type leaving the pool.
	 * @param amountIn - The input amount in `coinTypeIn` smallest units.
	 * @returns The output amount in `coinTypeOut` smallest units. Returns `0n` when either swap fee disables the pair.
	 * @throws `Error` when the coin types match or the calculated swap is invalid.
	 */
	public static calcOutGivenIn = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountIn: Balance
	): Balance => {
		if (coinTypeIn === coinTypeOut) {
			throw new Error("in and out must be different coins");
		}
		const coinIn = pool.coins[coinTypeIn];
		const coinOut = pool.coins[coinTypeOut];
		const swapFeeIn = FixedUtils.directCast(coinIn.tradeFeeIn);
		const swapFeeOut = FixedUtils.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			return BigInt(0);
		}

		const flatness = FixedUtils.directCast(pool.flatness);
		const oldIn = FixedUtils.directCast(coinIn.normalizedBalance);
		const oldOut = FixedUtils.directCast(coinOut.normalizedBalance);

		const wIn = FixedUtils.directCast(coinIn.weight);
		const wOut = FixedUtils.directCast(coinOut.weight);
		const [prod, , p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeOut
		);

		const feedAmountIn =
			(1 - swapFeeIn) *
			FixedUtils.castAndNormalize(coinIn.decimalsScalar, amountIn);
		const newIn = oldIn + feedAmountIn;
		const prodRatio = (newIn / oldIn) ** wIn;

		const newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		const xi = (prod / newP0) ** (1 / wOut);
		const newS0 = s0 + wIn * feedAmountIn;

		const tokenAmountOut =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wOut,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		const amountOut = FixedUtils.uncastAndUnnormalize(
			coinOut.decimalsScalar,
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
		) {
			throw new Error("invalid 1d swap");
		}
		return amountOut;
	};

	/**
	 * Calculates the exact input for a one-dimensional exact-output swap.
	 *
	 * `amountOut` and the return value use the respective coin's smallest unit.
	 * The calculation applies the pool's input and output swap fees. Protocol and
	 * DAO fees are applied by the higher-level `Pool` wrapper.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param coinTypeIn - The coin type entering the pool.
	 * @param coinTypeOut - The coin type leaving the pool.
	 * @param amountOut - The required output in `coinTypeOut` smallest units.
	 * @returns The input amount in `coinTypeIn` smallest units.
	 * @throws `Error` when the coin types match, the swap is disabled for a non-zero output, or the calculated swap is invalid.
	 */
	public static calcInGivenOut = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountOut: Balance
	): Balance => {
		if (coinTypeIn === coinTypeOut) {
			throw new Error("in and out must be different coins");
		}
		const coinIn = pool.coins[coinTypeIn];
		const coinOut = pool.coins[coinTypeOut];
		const swapFeeIn = FixedUtils.directCast(coinIn.tradeFeeIn);
		const swapFeeOut = FixedUtils.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
			// this swap is disabled
			if (amountOut === BigInt(0)) {
				return BigInt(0);
			}
			throw new Error("this swap is disabled");
		}

		const flatness = FixedUtils.directCast(pool.flatness);
		const oldIn = FixedUtils.directCast(coinIn.normalizedBalance);
		const oldOut = FixedUtils.directCast(coinOut.normalizedBalance);

		const wOut = FixedUtils.directCast(coinOut.weight);
		const wIn = FixedUtils.directCast(coinIn.weight);
		const [prod, , p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeIn
		);

		const feedAmountOut =
			FixedUtils.castAndNormalize(coinIn.decimalsScalar, amountOut) /
			(1 - swapFeeOut);
		const newOut = oldOut - feedAmountOut;
		const prodRatio = (newOut / oldOut) ** wOut;

		const newP0 = p0 * prodRatio;
		// the initial estimate (xi) is from if there were only the product part of the curve
		const xi = (prod / newP0) ** (1 / wIn);
		const newS0 = s0 - wOut * feedAmountOut;

		const tokenAmountIn =
			CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
				flatness,
				wIn,
				h,
				xi, // initial estimate -- default can be (P(X) / p0)^n
				newP0, // P(B) / xi^(1/n) (everything but the missing part)
				newS0 // S(B) - xi / n (everything but the missing part)
			);

		const amountIn = FixedUtils.uncastAndUnnormalize(
			coinOut.decimalsScalar,
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
		) {
			throw new Error("invalid 1d swap");
		}
		return amountIn;
	};

	/**
	 * Solves a vector swap with fixed inputs and a proportional output direction.
	 *
	 * The return value is an on-chain fixed-point scalar `t`. Multiply each value
	 * in `amountsOutDirection` by `t` to get the output vector. Amount maps use
	 * each coin's smallest unit, and `1_000_000_000_000_000_000n` represents
	 * `t = 1`.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsIn - Input amounts keyed by coin type, in smallest units.
	 * @param amountsOutDirection - Non-zero output direction amounts, in smallest units.
	 * @returns The fixed-point scalar for the output direction.
	 * @throws `Error` when a requested coin is disabled, the vector is invalid, or Newton iteration diverges.
	 */
	public static calcSwapFixedIn = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		amountsOutDirection: CoinsToBalance
	): OnChainScalar => {
		const coins = pool.coins;
		const invariant = CmmmCalculations.calcInvariant(pool);
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
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
		let _skip;
		let drainT = Number.POSITIVE_INFINITY;
		let shifter = 1;

		// make sure no disabled coin type is expected
		for (const [coinType, coin] of Object.entries(coins)) {
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOutDirection[coinType] || BigInt(0)
			);
			feeOut = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
			if (amountOut > 0) {
				if (feeOut === 0) {
					throw new Error("this trade is disabled");
				}
				// pool is drained when b + Ain * (1 - Sin) - t * Aout / (1 - Sout) = 0, or t = (b + Ain * (1 - Sin)) * (1 - So) / Aout
				t =
					((FixedUtils.directCast(coin.normalizedBalance) +
						FixedUtils.castAndNormalize(
							coin.decimalsScalar,
							amountsIn[coinType] || BigInt(0)
						) *
							FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn))) /
						amountOut) *
					feeOut;
				drainT = Math.min(drainT, t);
			}
		}
		// drain_t is the maximum t can possibly be. It will be 0 if expected amounts out is way too high.
		if (drainT === 0) {
			return BigInt(0);
		}
		while (shifter >= drainT) {
			shifter /= 2;
		}

		t = 1;

		for (let i = 0; i < CmmmCalculations.maxNewtonAttempts; ++i) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			_skip = false;
			for (const [coinType, coin] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin.normalizedBalance);
				weight = FixedUtils.directCast(coin.weight);
				amountIn = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsIn[coinType] || BigInt(0)
				);
				amountOut = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsOutDirection[coinType] || BigInt(0)
				);
				feeIn = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn));
				feeOut = FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));

				// pseudoin
				part1 = feeIn * amountIn;
				// pseudoout
				part2 = (t * amountOut) / feeOut;
				// pseudobalance
				if (part2 >= balance + part1 + 1) {
					_skip = true;
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

			if (Helpers.closeEnough(t, prevT, CmmmCalculations.convergenceBound)) {
				if (
					!CmmmCalculations.checkValidSwap(
						pool,
						amountsIn,
						1,
						amountsOutDirection,
						t
					)
				) {
					throw new Error("invalid swap");
				}
				return FixedUtils.directUncast(t);
			}

			prevT = t;
		}
		throw new Error("Newton diverged");
	};

	/**
	 * Solves a vector swap with fixed outputs and a proportional input direction.
	 *
	 * The return value is an on-chain fixed-point scalar `t`. Multiply each value
	 * in `amountsInDirection` by `t` to get the input vector. Amount maps use
	 * each coin's smallest unit, and `1_000_000_000_000_000_000n` represents
	 * `t = 1`.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsInDirection - Non-zero input direction amounts, in smallest units.
	 * @param amountsOut - Fixed output amounts keyed by coin type, in smallest units.
	 * @returns The fixed-point scalar for the input direction.
	 * @throws `Error` when an output coin is disabled, the vector is invalid, or Newton iteration diverges.
	 */
	public static calcSwapFixedOut = (
		pool: PoolObject,
		amountsInDirection: CoinsToBalance,
		amountsOut: CoinsToBalance
	): OnChainScalar => {
		const coins = pool.coins;
		const invariant = CmmmCalculations.calcInvariant(pool);
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
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
		for (const [coinType, coin] of Object.entries(coins)) {
			if (
				coin.tradeFeeOut >= FixedUtils.fixedOneB &&
				(amountsOut[coinType] || BigInt(0)) > BigInt(0)
			) {
				throw new Error("this trade is disabled");
			}
		}

		for (let i = 0; i < CmmmCalculations.maxNewtonAttempts; ++i) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			for (const [coinType, coin] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin.normalizedBalance);
				weight = FixedUtils.directCast(coin.weight);
				amountIn = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsInDirection[coinType] || BigInt(0)
				);
				amountOut = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsOut[coinType] || BigInt(0)
				);
				feeIn = 1 - FixedUtils.directCast(coin.tradeFeeIn);
				feeOut = 1 - FixedUtils.directCast(coin.tradeFeeOut);

				// pseudoin expected
				part1 = feeIn * amountIn;
				// pseudoout
				part2 = amountOut === 0 ? 0 : amountOut / feeOut;
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
			part4 = (part3 + part2) * prod1 + 2 * a * sum1 - a * invariant * prod1;

			t = (t * part4 + invariant * (a + invariant / prod) - part3) / part4;

			if (Helpers.closeEnough(t, prevT, CmmmCalculations.convergenceBound)) {
				if (
					!CmmmCalculations.checkValidSwap(
						pool,
						amountsInDirection,
						1,
						amountsOut,
						t
					)
				) {
					throw new Error("invalid swap");
				}
				return FixedUtils.directUncast(t);
			}

			prevT = t;
		}
		throw new Error("Newton diverged");
	};

	/**
	 * Calculates the LP ratio produced by a fixed-amount liquidity deposit.
	 *
	 * The result is an on-chain fixed-point ratio. `1_000_000_000_000_000_000n`
	 * represents a ratio of `1`. `Pool.getDepositLpAmountOut` converts this ratio
	 * to a decimal and derives the minted LP amount from the current supply.
	 * Amounts use each coin's smallest unit.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsIn - Deposit amounts keyed by coin type, in smallest units.
	 * @returns The fixed-point LP ratio.
	 * @throws `Error` when the calculated deposit fails invariant validation or Newton iteration diverges.
	 */
	public static calcDepositFixedAmounts = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): OnChainScalar => {
		const invariant = CmmmCalculations.calcInvariant(pool);
		const coins = pool.coins;
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
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

		const fees: Record<CoinType, number> = {};
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amount = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);
			fees[coinType] =
				r * (balance + amount) >= balance
					? 1 - FixedUtils.directCast(coin.tradeFeeIn)
					: 1 / (1 - FixedUtils.directCast(coin.tradeFeeOut));
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
			for (const [coinType, coin] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin.normalizedBalance);
				weight = FixedUtils.directCast(coin.weight);
				amount = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsIn[coinType] || BigInt(0)
				);
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

			if (Helpers.closeEnough(r, prevR, CmmmCalculations.convergenceBound)) {
				const scalar = FixedUtils.directUncast(r);
				if (!CmmmCalculations.checkValidDeposit(pool, amountsIn, scalar)) {
					throw new Error("invalid deposit");
				}
				return scalar;
			}

			prevR = r;
			i += 1;
		}
		throw new Error("Newton diverged");
	};

	private static calcDepositFixedAmountsInitialEstimate = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): LocalNumber => {
		const invariant = CmmmCalculations.calcInvariant(pool);
		const coins = pool.coins;
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
		let balance;
		let amount;
		let weight;
		let r;
		let rMin = 0;
		let cfMin = 0;
		let prod = 0;
		let sum = 0;
		let part1;
		// start cf_max as corresponding to r = 1
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amount = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);
			weight = FixedUtils.directCast(coin.weight);

			// this is all in so use fees in
			part1 = balance + (1 - FixedUtils.directCast(coin.tradeFeeIn)) * amount;
			prod += weight * Math.log(part1);
			sum += weight * part1;
			// r_min portion of the loop
			r =
				(FixedUtils.directCast(coin.tradeFeeOut) * balance) /
				(balance + amount);
			rMin = Math.max(r, rMin);
		}
		prod = Math.exp(prod);
		let cfMax = (2 * a * prod * sum) / (prod + invariant) + ac * prod;

		let rMax = 1;
		let cf: number;
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			amount = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);
			r = balance / (balance + amount);
			if (r <= rMin) {
				continue;
			}

			prod = 0;
			sum = 0;
			for (const [coinType2, coin2] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin2.normalizedBalance);
				weight = FixedUtils.directCast(coin2.weight);
				amount = FixedUtils.castAndNormalize(
					coin2.decimalsScalar,
					amountsIn[coinType2] || BigInt(0)
				);
				part1 = r * (balance + amount);
				if (part1 >= balance) {
					// r * (B0 + Din) >= B0 so use fees in
					part1 =
						balance +
						(1 - FixedUtils.directCast(coin2.tradeFeeIn)) * (part1 - balance);
				} else {
					// r * (B0 + Din) < B0 so use fees out
					part1 =
						balance -
						(balance - part1) /
							FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
				}
				prod += weight * Math.log(part1);
				sum += weight * part1;
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
			cfMin === cfMax
				? rMin
				: (rMin * cfMax + (rMax - rMin) * invariant - rMax * cfMin) /
					(cfMax - cfMin);
		return r;
	};

	/**
	 * Calculates output amounts for a fixed LP withdrawal direction.
	 *
	 * `lpRatio` is the fraction of the original pool balance retained after the
	 * withdrawal. For example, `0.9` means that 10% of the LP position is burned.
	 * Non-zero entries in `amountsOutDirection` define the output direction. The
	 * returned map contains scaled smallest-unit amounts for every pool coin.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsOutDirection - Desired output direction keyed by coin type, in smallest units.
	 * @param lpRatio - Decimal fraction of the pool retained after the withdrawal.
	 * @returns Output amounts keyed by pool coin type, in smallest units.
	 * @throws `Error` when the requested direction drains a coin, fails validation, or Newton iteration diverges.
	 */
	public static calcWithdrawFlpAmountsOut = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): CoinsToBalance => {
		const invariant = CmmmCalculations.calcInvariant(pool);
		const coins = pool.coins;
		const lpr = lpRatio;
		const lpc = 1 - lpr;
		const scaledInvariant = invariant * lpr;
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
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

		let [r, rDrain] = CmmmCalculations.calcWithdrawFlpAmountsOutInitialEstimate(
			pool,
			amountsOutDirection,
			lpRatio
		);
		while (shrinker >= rDrain) {
			shrinker /= 2;
		}

		const fees: Record<CoinType, number> = {};
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOutDirection[coinType] || BigInt(0)
			);
			fees[coinType] =
				balance * lpc >= r * amountOut
					? 1 - FixedUtils.directCast(coin.tradeFeeIn)
					: 1 / (1 - FixedUtils.directCast(coin.tradeFeeOut));
		}

		i = 0;
		while (i < CmmmCalculations.maxNewtonAttempts) {
			prod = 0;
			prod1 = 0;
			sum = 0;
			sum1 = 0;
			skip = false;
			for (const [coinType, coin] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin.normalizedBalance);
				weight = FixedUtils.directCast(coin.weight);
				amountOut = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsOutDirection[coinType] || BigInt(0)
				);
				fee = fees[coinType];

				part1 = balance * (lpr + lpc * fee);
				part2 = fee * r * amountOut;
				if (part2 + 1 >= part1) {
					// Overshot and drained pool. Set t to be closer to t_max and try again.
					skip = true;
					break;
				}
				part1 -= part2;

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

			if (Helpers.closeEnough(r, prevR, CmmmCalculations.convergenceBound)) {
				const returner: CoinsToBalance = {};
				for (const coinType of Object.keys(coins)) {
					returner[coinType] = FixedUtils.directUncast(
						r *
							FixedUtils.directCast(amountsOutDirection[coinType] || BigInt(0))
					);
				}
				if (!CmmmCalculations.checkValidWithdraw(pool, returner, lpRatio)) {
					throw new Error("invalid withdraw");
				}
				return returner;
			}

			prevR = r;
			i += 1;
		}
		throw new Error("Newton diverged");
	};

	private static calcWithdrawFlpAmountsOutInitialEstimate = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): [LocalNumber, LocalNumber] => {
		const invariant = CmmmCalculations.calcInvariant(pool);
		const coins = pool.coins;
		const lpr = lpRatio;
		const lpc = 1 - lpr;
		const scaledInvariant = invariant * lpr;
		const a = FixedUtils.directCast(pool.flatness);
		const ac = 1 - a;
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
		for (const coin of Object.values(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			fee = FixedUtils.directCast(coin.tradeFeeIn);
			part1 = balance * (1 + lpr * fee - fee);
			prod += weight * Math.log(part1);
			sum += weight * part1;
		}
		prod = Math.exp(prod);
		cfMax = (2 * a * prod * sum) / (prod + scaledInvariant) + ac * prod;

		// the smallest cfMin can be is 0 which occurs when the pool is drained
		cfMin = 0;
		tMin = Number.POSITIVE_INFINITY;
		for (const [coinType, coin] of Object.entries(coins)) {
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOutDirection[coinType] || BigInt(0)
			);
			if (amountOut === 0) {
				continue;
			}
			t =
				(FixedUtils.directCast(coin.normalizedBalance) *
					FixedUtils.complement(
						FixedUtils.directCast(coin.tradeFeeOut) * lpRatio
					)) /
				amountOut;
			if (t < tMin) {
				tMin = t;
			}
		}
		tDrain = tMin;

		// remaining test points are the CF discontinuities: where B0 - t*D = R*B0
		for (const [coinTypeT, coinT] of Object.entries(coins)) {
			amountOut = FixedUtils.castAndNormalize(
				coinT.decimalsScalar,
				amountsOutDirection[coinTypeT] || BigInt(0)
			);
			if (amountOut === 0) {
				continue;
			}
			balance = FixedUtils.directCast(coinT.normalizedBalance);
			t = (balance * lpc) / amountOut;
			prod = 0;
			sum = 0;
			keepT = true;
			for (const [coinType, coin] of Object.entries(coins)) {
				balance = FixedUtils.directCast(coin.normalizedBalance);
				weight = FixedUtils.directCast(coin.weight);
				amountOut = FixedUtils.castAndNormalize(
					coin.decimalsScalar,
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
							FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn)) *
								(part1 - part2)
						: part2 -
							(part2 - part1) /
								FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
				prod += weight * Math.log(part3);
				sum += weight * part3;
			}
			if (keepT) {
				prod = Math.exp(prod);
				cf = (2 * a * prod * sum) / (prod + scaledInvariant) + ac * prod;
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
			cfMax === cfMin
				? tMin
				: (tMin * cfMax +
						tMax * scaledInvariant -
						tMax * cfMin -
						tMin * scaledInvariant) /
					(cfMax - cfMin);

		return [t, tDrain];
	};

	/**
	 * Scales a requested all-coin deposit by its smallest normalized proportion.
	 *
	 * The result keeps the input map's keys and multiplies every requested amount
	 * by the smallest `amount / pool balance` ratio. This produces the
	 * proportional, dust-free portion used by the direct all-coin deposit path.
	 * Amounts use smallest units. The helper does not build a transaction.
	 *
	 * @param pool - The pool state supplying balances and decimal scalars.
	 * @param amountsIn - Requested deposit amounts keyed by coin type.
	 * @returns The proportional deposit amounts keyed by the same coin types.
	 */
	public static calcAllCoinDeposit = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): CoinsToBalance => {
		const coins = pool.coins;

		let balance;
		let amountIn;

		let s;
		let sMin = Number.POSITIVE_INFINITY;
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amountIn = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);

			s = amountIn / balance;

			if (s < sMin) {
				sMin = s;
			}
		}

		const returner: CoinsToBalance = {};
		for (const coinType of Object.keys(coins)) {
			returner[coinType] = Helpers.blendedOperations.mulNBB(
				sMin,
				amountsIn[coinType] || BigInt(0)
			);
		}
		return returner;
	};

	/**
	 * Scales a requested all-coin withdrawal by its largest normalized proportion.
	 *
	 * The result keeps the input map's keys and multiplies every requested amount
	 * by the largest `amount / pool balance` ratio. This produces a proportional
	 * vector that covers the requested direction. It does not build a transaction
	 * or apply protocol and DAO fees.
	 *
	 * @param pool - The pool state supplying balances and decimal scalars.
	 * @param amountsOut - Requested output amounts keyed by coin type.
	 * @returns The proportionally scaled output amounts keyed by the same coin types.
	 */
	public static calcAllCoinWithdraw = (
		pool: PoolObject,
		amountsOut: CoinsToBalance
	): CoinsToBalance => {
		const coins = pool.coins;

		let balance;
		let amountOut;

		let s;
		let sMax = 0;
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOut[coinType] || BigInt(0)
			);

			s = amountOut / balance;

			if (s > sMax) {
				sMax = s;
			}
		}

		const returner: CoinsToBalance = {};
		for (const coinType of Object.keys(coins)) {
			returner[coinType] = Helpers.blendedOperations.mulNBB(
				sMax,
				amountsOut[coinType] || BigInt(0)
			);
		}
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
		if (Number.isNaN(xi)) {
			throw new Error("initial estimate is not a number");
		}

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

		const ac = 1 - flatness;
		const aw = flatness * w;
		const acw = ac * w;
		const as0 = flatness * s0;
		const ah = flatness * h;

		const c1 = 2 * aw * w;
		const c2 = 2 * acw * p0;
		const c3 = 2 * w * as0 + ah;
		const c4 = (h * h) / p0;
		const c5 = ac * p0;
		const c6 = 2 * as0 + w * ah;
		const c7 = 2 * aw * (w + 1);
		const c8 = 2 * acw * p0;
		const c9 = 2 * aw * s0;
		const c10 = aw * h;

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
			xw = x ** w;

			topPos = x * (xw * (c1 * x + c2 * xw + c3) + c4);
			topNeg = x * (xw * (c5 * xw + c6));
			bottomPos = c7 * x + c8 * xw + c9;
			//bottomNeg = c10;

			// If x jumps too much (bad initial estimate) then g(x) might overshoot into a negative number.
			// This only happens if x is supposed to be small. In this case, replace x with a small number and try again.
			// Once x is close enough to the true value g(x) won't overshoot anymore and this test will be skipped from then on.
			if (topPos < topNeg || bottomPos < c10) {
				x = 1 / 2 ** i;
				i += 1;
				continue;
			}

			x = (topPos - topNeg) / (xw * (bottomPos - c10));

			// using relative error here (easier to pass) because js numbers are less precise
			if (Helpers.closeEnough(x, prevX, CmmmCalculations.convergenceBound)) {
				return x;
			}

			prevX = x;
			i += 1;
		}
		throw new Error("Newton diverged");
	};

	/**
	 * Checks a vector swap against pool balance, fee, and invariant constraints.
	 *
	 * The two scalar parameters allow callers to reuse direction vectors. A scalar
	 * of `1` applies the vector as supplied. The method rejects a coin that is both
	 * input and output, rejects a drained balance, and checks the fee-adjusted
	 * invariant within the implementation tolerances.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsIn - Input direction amounts in smallest units.
	 * @param amountsInScalar - Decimal scalar applied to `amountsIn`.
	 * @param amountsOut - Output direction amounts in smallest units.
	 * @param amountsOutScalar - Decimal scalar applied to `amountsOut`.
	 * @returns `true` when the scaled swap is valid. Returns `false` for an invalid vector or balance.
	 */
	public static checkValidSwap = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		amountsInScalar: LocalNumber,
		amountsOut: CoinsToBalance,
		amountsOutScalar: LocalNumber
	): boolean => {
		const coins = pool.coins;
		const flatness = FixedUtils.directCast(pool.flatness);

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

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			amountIn =
				FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsIn[coinType] || BigInt(0)
				) * amountsInScalar;
			amountOut =
				FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsOut[coinType] || BigInt(0)
				) * amountsOutScalar;
			if (amountIn > 0 && amountOut > 0) {
				return false;
			}
			feedAmountIn = amountIn * (1 - FixedUtils.directCast(coin.tradeFeeIn));
			feedAmountOut =
				amountOut === 0
					? 0
					: amountOut / (1 - FixedUtils.directCast(coin.tradeFeeOut));

			postbalance = balance + amountIn;
			if (amountOut > postbalance + 1) {
				return false;
			}
			postbalance -= -amountOut;
			pseudobalance = balance + feedAmountIn;
			if (feedAmountOut > pseudobalance + 1) {
				return false;
			}
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

		const preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		const postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		const pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				FixedUtils.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	/**
	 * Checks a one-input, one-output swap against pool constraints.
	 *
	 * Amounts use the input and output coins' smallest units. This helper returns
	 * `false` for equal coin types, drained balances, or an invariant mismatch.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param coinTypeIn - The input coin type.
	 * @param coinTypeOut - The output coin type.
	 * @param amountInB - The input amount in smallest units.
	 * @param amountOutB - The output amount in smallest units.
	 * @returns `true` when the swap is valid within the math tolerances.
	 */
	public static checkValid1dSwap = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountInB: Balance,
		amountOutB: Balance
	): boolean => {
		if (coinTypeIn === coinTypeOut) {
			return false;
		}
		const coins = pool.coins;
		const coinIn = coins[coinTypeIn];
		const coinOut = coins[coinTypeOut];
		const flatness = FixedUtils.directCast(pool.flatness);

		// balance = balances[i]
		let balance;
		// pseudobalance = balance + feed amount in - feed amount out
		let pseudobalance;
		// postbalance = balance + amount in - amount out
		let postbalance;
		let weight;
		const amountIn = FixedUtils.castAndNormalize(
			coinIn.decimalsScalar,
			amountInB
		);
		const amountOut = FixedUtils.castAndNormalize(
			coinOut.decimalsScalar,
			amountOutB
		);
		const feedAmountIn =
			amountIn * (1 - FixedUtils.directCast(coinIn.tradeFeeIn));
		const feedAmountOut =
			amountOut === 0
				? 0
				: amountOut / (1 - FixedUtils.directCast(coinOut.tradeFeeOut));

		let preprod = 0;
		let presum = 0;
		let pseudoprod = 0;
		let pseudosum = 0;
		let postprod = 0;
		let postsum = 0;
		let p;
		let s;

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);

			p = weight * Math.log(balance);
			s = weight * balance;

			preprod += p;
			presum += s;

			if (coinType === coinTypeIn) {
				pseudobalance = balance + feedAmountIn;
				postbalance = balance + amountIn;

				pseudoprod += weight * Math.log(pseudobalance);
				pseudosum += weight * pseudobalance;
				postprod += weight * Math.log(postbalance);
				postsum += weight * postbalance;
			} else if (coinType === coinTypeOut) {
				if (feedAmountOut > balance + 1 || amountOut > balance + 1) {
					return false;
				}
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
		preprod = Math.exp(preprod);
		postprod = Math.exp(postprod);
		pseudoprod = Math.exp(pseudoprod);

		const preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		const postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		const pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				FixedUtils.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	/**
	 * Checks a fixed-amount deposit and its claimed LP ratio.
	 *
	 * `lpRatioRaw` is an on-chain fixed-point ratio. `1_000_000_000_000_000_000n`
	 * represents `1`. The check models the intermediate swap and all-coin
	 * investment used by the pool contract.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsIn - Deposit amounts keyed by coin type, in smallest units.
	 * @param lpRatioRaw - Claimed LP ratio in on-chain fixed-point units.
	 * @returns `true` when the deposit and ratio satisfy pool constraints.
	 */
	public static checkValidDeposit = (
		pool: PoolObject,
		amountsIn: CoinsToBalance,
		lpRatioRaw: OnChainScalar
	): boolean => {
		// The supposed swap is from B0 to R*(B0 + Din)
		// This test is check_valid_swap for those data

		const coins = pool.coins;
		const lpRatio = FixedUtils.directCast(lpRatioRaw);
		if (lpRatio > 1) {
			return false;
		}

		const flatness = FixedUtils.directCast(pool.flatness);

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

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			amount = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);
			postbalance = lpRatio * (balance + amount);

			if (postbalance >= balance) {
				// use fee in
				diff = postbalance - balance;
				pseudodiff = diff * (1 - FixedUtils.directCast(coin.tradeFeeIn));
				pseudobalance = balance + pseudodiff;
			} else {
				// use fee out
				diff = balance - postbalance;
				pseudodiff =
					diff === 0 ? 0 : diff / (1 - FixedUtils.directCast(coin.tradeFeeOut));
				if (pseudodiff >= balance + 1) {
					return false;
				}
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

		const preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		const postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		const pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				FixedUtils.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	/**
	 * Checks a fixed LP withdrawal and its output direction.
	 *
	 * `lpRatio` is the decimal fraction of the pool balance retained before the
	 * final swap. Amounts use smallest units. The check rejects ratios above `1`,
	 * overdrawn balances, and fee-adjusted invariant mismatches.
	 *
	 * @param pool - The pool state used for the invariant.
	 * @param amountsOutSrc - Requested output direction keyed by coin type.
	 * @param lpRatio - Decimal fraction of the pool retained after the proportional withdrawal.
	 * @returns `true` when the withdrawal is valid within the math tolerances.
	 */
	public static checkValidWithdraw = (
		pool: PoolObject,
		amountsOutSrc: CoinsToBalance,
		lpRatio: LocalNumber
	): boolean => {
		// Check that the swap from R*B0 to B0 - Dout is valid

		const coins = pool.coins;
		if (lpRatio > 1) {
			return false;
		}

		const flatness = FixedUtils.directCast(pool.flatness);

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

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			scaledBalance = lpRatio * balance;
			weight = FixedUtils.directCast(coin.weight);
			amount = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOutSrc[coinType] || BigInt(0)
			);
			if (amount > scaledBalance + 1) {
				return false;
			}
			postbalance = balance - amount;

			if (postbalance >= scaledBalance) {
				// use fee in
				diff = postbalance - scaledBalance;
				pseudodiff =
					diff * FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeIn));
				pseudobalance = scaledBalance + pseudodiff;
			} else {
				// use fee out
				diff = scaledBalance - postbalance;
				pseudodiff =
					diff === 0
						? 0
						: diff /
							FixedUtils.complement(FixedUtils.directCast(coin.tradeFeeOut));
				if (pseudodiff > scaledBalance + 1) {
					return false;
				}
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

		const preinvariant = CmmmCalculations.calcInvariantQuadratic(
			preprod,
			presum,
			flatness
		);
		const postinvariant = CmmmCalculations.calcInvariantQuadratic(
			postprod,
			postsum,
			flatness
		);
		const pseudoinvariant = CmmmCalculations.calcInvariantQuadratic(
			pseudoprod,
			pseudosum,
			flatness
		);

		return (
			postinvariant * (1 + CmmmCalculations.tolerance) >= preinvariant &&
			(Helpers.veryCloseInt(
				preinvariant,
				pseudoinvariant,
				FixedUtils.fixedOneN
			) ||
				Helpers.closeEnough(
					preinvariant,
					pseudoinvariant,
					CmmmCalculations.validityTolerance
				))
		);
	};

	/**
	 * Estimates exact-input output by multiplying the amount by the fee-aware spot price.
	 *
	 * This is a fast linear estimate. It does not solve the invariant and becomes
	 * less accurate as the trade consumes more pool balance.
	 *
	 * @param pool - The pool state used for the spot price.
	 * @param coinTypeIn - The input coin type.
	 * @param coinTypeOut - The output coin type.
	 * @param amountIn - The input amount in smallest units.
	 * @returns The estimated output in smallest units.
	 */
	public static getEstimateOutGivenIn = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountIn: Balance
	): Balance =>
		Helpers.blendedOperations.mulNBB(
			CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut),
			amountIn
		);

	/**
	 * Estimates exact-output cost by dividing the desired output by the fee-aware spot price.
	 *
	 * This is a fast linear estimate. It does not solve the invariant and becomes
	 * less accurate as the requested output consumes more pool balance.
	 *
	 * @param pool - The pool state used for the spot price.
	 * @param coinTypeIn - The input coin type.
	 * @param coinTypeOut - The output coin type.
	 * @param amountOut - The desired output amount in smallest units.
	 * @returns The estimated input in smallest units.
	 */
	public static getEstimateInGivenOut = (
		pool: PoolObject,
		coinTypeIn: CoinType,
		coinTypeOut: CoinType,
		amountOut: Balance
	): Balance =>
		Helpers.blendedOperations.mulNBB(
			1 / CmmmCalculations.calcSpotPriceWithFees(pool, coinTypeIn, coinTypeOut),
			amountOut
		);

	/**
	 * Estimates the fixed-input vector-swap scalar from the current spot prices.
	 *
	 * The return value is a decimal `number`, not an on-chain fixed-point scalar.
	 * Multiply `amountsOutDirection` by it to get the linear output estimate.
	 * Use `calcSwapFixedIn` when an invariant solve is required.
	 *
	 * @param pool - The pool state used for spot prices and fee metadata.
	 * @param amountsIn - Input direction amounts in smallest units.
	 * @param amountsOutDirection - Output direction amounts in smallest units.
	 * @returns The decimal output-direction scalar estimate.
	 */
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

		const coins = pool.coins;
		const spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		const a = FixedUtils.directCast(pool.flatness);

		let balance;
		let grad;
		let amountIn;
		let amountOut;
		let inDotGrad = 0;
		let outDotGrad = 0;
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amountIn = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsIn[coinType] || BigInt(0)
			);
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOutDirection[coinType] || BigInt(0)
			);
			grad =
				amountIn === 0
					? (FixedUtils.directCast(coin.weight) *
							(spotBody + 2 * a * balance)) /
						(balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
					: (FixedUtils.directCast(coin.weight) *
							(1 - FixedUtils.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
						balance;
			inDotGrad += amountIn * grad;
			outDotGrad += amountOut * grad;
		}

		return inDotGrad / outDotGrad;
	};

	/**
	 * Estimates the fixed-output vector-swap scalar from the current spot prices.
	 *
	 * The return value is a decimal `number`, not an on-chain fixed-point scalar.
	 * Multiply `amountsInDirection` by it to get the linear input estimate.
	 * Use `calcSwapFixedOut` when an invariant solve is required.
	 *
	 * @param pool - The pool state used for spot prices and fee metadata.
	 * @param amountsInDirection - Input direction amounts in smallest units.
	 * @param amountsOut - Fixed output amounts in smallest units.
	 * @returns The decimal input-direction scalar estimate.
	 */
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

		const coins = pool.coins;
		const spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		const a = FixedUtils.directCast(pool.flatness);

		let balance;
		let grad;
		let amountIn;
		let amountOut;
		let inDotGrad = 0;
		let outDotGrad = 0;
		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			amountIn = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsInDirection[coinType] || BigInt(0)
			);
			amountOut = FixedUtils.castAndNormalize(
				coin.decimalsScalar,
				amountsOut[coinType] || BigInt(0)
			);
			grad =
				amountIn === 0
					? (FixedUtils.directCast(coin.weight) *
							(spotBody + 2 * a * balance)) /
						(balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
					: (FixedUtils.directCast(coin.weight) *
							(1 - FixedUtils.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
						balance;
			inDotGrad += amountIn * grad;
			outDotGrad += amountOut * grad;
		}

		return outDotGrad / inDotGrad;
	};

	/**
	 * Estimates the LP ratio for a fixed-amount deposit using a tangent-plane approximation.
	 *
	 * The return value is a decimal retained ratio. The approximation is most
	 * accurate for small deposits. Use `calcDepositFixedAmounts` for the invariant
	 * solve used by transaction preparation.
	 *
	 * @param pool - The pool state used for spot prices and fee metadata.
	 * @param amountsIn - Deposit amounts keyed by coin type, in smallest units.
	 * @returns The decimal LP ratio estimate.
	 */
	public static getEstimateDepositFixedAmounts = (
		pool: PoolObject,
		amountsIn: CoinsToBalance
	): LocalNumber => {
		// Initial estimate comes from testing the discontinuities and doing a linear
		// approximation off the two closest test points. We use it to get the correct fees.
		const r0 = CmmmCalculations.calcDepositFixedAmountsInitialEstimate(
			pool,
			amountsIn
		);

		// Now r0 is on the correct side of B0 as the final t*(B0+Din). This tells us which fees apply.
		// All we have to do is find the value of r for which r*(B0+Din) lies on the feed tangent plane at B0.

		// the gradient of the invariant function with fees is (with spot body E)
		// Win * (1 - Sin) * (E + 2*A * Bin) / Bin or
		// Wout * (E + 2*A * Bout) / (1-Sout) * Bout
		// depending on whether the balance is coming in or going out

		const coins = pool.coins;
		const spotBody = CmmmCalculations.calcSpotPriceBody(pool);
		const a = FixedUtils.directCast(pool.flatness);

		// dot(B0, g)
		let d1 = 0;
		// dot(B0 + Din, g)
		let d2 = 0;

		let balance;
		let weight;
		let amount;
		let grad;
		let scaledAmount;

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			amount =
				balance +
				FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsIn[coinType] || BigInt(0)
				);
			scaledAmount = amount * r0;

			grad =
				scaledAmount < balance
					? // use amount out
						(weight * (spotBody + 2 * a * balance)) /
						(balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
					: // use amount in
						(weight *
							(1 - FixedUtils.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
						balance;

			d1 += balance * grad;
			d2 += amount * grad;
		}

		return d1 / d2;
	};

	/**
	 * Estimates the output-direction scalar for a fixed LP withdrawal.
	 *
	 * The return value is a decimal `number`. Multiply `amountsOutDirection` by
	 * it to get the estimated output vector. `lpRatio` is the decimal retained
	 * pool ratio. The approximation is most accurate when `lpRatio` is close to
	 * `1`. Use `calcWithdrawFlpAmountsOut` for the invariant solve.
	 *
	 * @param pool - The pool state used for spot prices and fee metadata.
	 * @param amountsOutDirection - Output direction amounts in smallest units.
	 * @param lpRatio - Decimal fraction of the pool retained after withdrawal.
	 * @returns The decimal output-direction scalar estimate.
	 */
	public static getEstimateWithdrawFlpAmountsOut = (
		pool: PoolObject,
		amountsOutDirection: CoinsToBalance,
		lpRatio: LocalNumber
	): LocalNumber => {
		// Initial estimate comes from testing the discontinuities and doing a linear
		// approximation off the two closest test points. We use it to get the correct fees.
		const [r0, _rDrain] =
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

		const coins = pool.coins;
		// Swap center is R*B0, not B0. Luckily the spot body formula is homogeneous.
		const spotBody = CmmmCalculations.calcSpotPriceBody(pool) * lpRatio;
		const a = FixedUtils.directCast(pool.flatness);

		// dot(B0, g)
		let d1 = 0;
		// dot(Deout, g)
		let d2 = 0;

		let balance;
		let scaledAmount;
		let weight;
		let amount;
		let grad;

		for (const [coinType, coin] of Object.entries(coins)) {
			balance = FixedUtils.directCast(coin.normalizedBalance);
			weight = FixedUtils.directCast(coin.weight);
			amount =
				balance +
				FixedUtils.castAndNormalize(
					coin.decimalsScalar,
					amountsOutDirection[coinType] || BigInt(0)
				);
			scaledAmount = amount * r0;

			grad =
				scaledAmount < balance
					? // use amount out
						(weight * (spotBody + 2 * a * balance)) /
						(balance * (1 - FixedUtils.directCast(coin.tradeFeeOut)))
					: // use amount in
						(weight *
							(1 - FixedUtils.directCast(coin.tradeFeeIn)) *
							(spotBody + 2 * a * balance)) /
						balance;

			d1 += balance * grad;
			d2 += amount * grad;
		}

		return ((1 - lpRatio) * d1) / d2;
	};
}

import { Coin } from "../../coin/coin";
import { Balance, CoinType, PoolObject, PoolTradeFee, PoolWeight } from "../../../types";
import { Pools } from "../pools";

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
	private static convertFromInt = (n: bigint): number => Number(n);
	private static directCast = (n: bigint): number => Coin.balanceWithDecimals(n, 18);

	// Invariant is used to govern pool behavior. Swaps are operations which change the pool balances without changing
	// the invariant (ignoring fees) and investments change the invariant without changing the distribution of balances.
	// Invariant and pool lp are almost in 1:1 correspondence -- e.g. burning lp in a withdraw proportionally lowers the pool invariant.
	// The difference is as swap fees are absorbed they increase the invariant without incrasing total lp, increasing lp worth.
	// Every pool operation either explicitly or implicity calls this function.
	public static calcInvariant = (
		pool: PoolObject,
	): number => {
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
		};
		prod = Math.exp(prod);

		return this.calcInvariantQuadratic(
			prod,
			sum,
			flatness
		);
	};
	
    // The invariant for stables comes from a quadratic equation coming from the reference point T = (h,h,...,h).
    // h = [sqrt[p * (p * (A*A + 4*(1-A)) + 8*A*s)] - A*p] / 2.
	public static calcInvariantQuadratic = (
        prod: number,
        sum: number,
        flatness: number,
    ): number => (Math.sqrt(prod * (prod * (flatness * flatness) + ((1-flatness) * 4)) + ((flatness * sum) * 8)) - flatness * prod) / 2;


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
		index: CoinType,
    ): [
		prod: number,
		sum: number,
		p0: number,
		s0: number,
		h: number,
	] => {
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
            };
        };
        prod = Math.exp(prod);
        p0 = Math.exp(p0);

        return [
			prod,
			sum,
			p0,
			s0,
			CmmmCalculations.calcInvariantQuadratic(prod, sum, flatness)
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
        s0: number, // S(B) - xi / n (everything but the missing part)
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
        let c4 = h * h / p0;
        let c5 = ac * p0;
        let c6 = 2 * as0 + w * ah;
        let c7 = 2 * aw * (w + 1);
        let c8 = 2 * acw * p0;
        let c9 = 2 * aw * s0;
        let c10= aw * h;

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

            top_pos = x * ((xw * (c1 * x + c2 * xw + c3)) + c4);
            top_neg = x * (xw * (c5 * xw + c6));
            bottom_pos = c7 * x + c8 * xw + c9;
            //bottom_neg = c10;

            // If x jumps too much (bad initial estimate) then g(x) might overshoot into a negative number.
            // This only happens if x is supposed to be small. In this case, replace x with a small number and try again.
            // Once x is close enough to the true value g(x) won't overshoot anymore and this test will be skipped from then on.
            if (top_pos < top_neg || bottom_pos < c10) {
                x = 1 / (2 ** i);
                i = i + 1;
                continue
            };

            x = (top_pos - top_neg) / (xw * (bottom_pos - c10));

            if (Math.abs(x - prev_x) <= CmmmCalculations.convergenceBound) {
                return x
            };

			prev_x = x;
            i = i + 1;
        };
		throw Error("Newton diverged");
    }

	// 1d optimized swap function for finding out given in. Returns t such that t*expected_out is the true out.
    // Lower t favors the pool.
    public static calcOutGivenIn = (
        pool: PoolObject,
		coinTypeIn: CoinType,
        coinTypeOut: CoinType,
		amountIn: Balance,
    ): number => {
        if (coinTypeIn == coinTypeOut) throw Error("In and out must be different coins");
		let coinIn = pool.coins[coinTypeIn];
		let coinOut = pool.coins[coinTypeOut];
        let swapFeeIn = CmmmCalculations.directCast(coinIn.tradeFeeIn);
        let swapFeeOut = CmmmCalculations.directCast(coinOut.tradeFeeOut);
		if (swapFeeIn >= 1 || swapFeeOut >= 1) {
            // this swap is disabled
            return 0
        };

        let flatness = CmmmCalculations.directCast(pool.flatness);
        let oldIn = CmmmCalculations.convertFromInt(coinIn.balance);
        let oldOut = CmmmCalculations.convertFromInt(coinOut.balance);

        let wIn = CmmmCalculations.directCast(coinIn.weight);
		let [prod, _sum, p0, s0, h] = CmmmCalculations.calcInvariantComponents(
			pool,
			coinTypeIn
		);

        let feedAmountIn = (1 - swapFeeIn) * CmmmCalculations.convertFromInt(amountIn);
        let newIn = oldIn + feedAmountIn;
        let prodRatio = Math.pow(newIn / oldIn, wIn);

        let newP0 = p0 * prodRatio;
        // the initial estimate (xi) is from if there were only the product part of the curve
        let xi = Math.pow(
			prod / newP0,
            1 / wIn
        );
        let newS0 = s0 + wIn * feedAmountIn;

        let wOut = CmmmCalculations.directCast(coinOut.weight);

        let tokenAmountOut = CmmmCalculations.getTokenBalanceGivenInvariantAndAllOtherBalances(
            flatness,
            wOut,
            h,
            xi, // initial estimate -- default can be (P(X) / p0)^n
            newP0, // P(B) / xi^(1/n) (everything but the missing part)
            newS0 // S(B) - xi / n (everything but the missing part)
        );

        let amountOut = (oldOut - tokenAmountOut) * (1 - swapFeeOut);
		return amountOut;
    }

	/*// Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
	// current balances and weights.
	public static calcOutGivenIn = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountIn: Balance,
		swapFee: PoolTradeFee
	): Balance => {
		let readBalanceIn = CmmmCalculations.readBalance(balanceIn);
		let readWeightIn = Pools.coinWeightWithDecimals(weightIn);
		let readBalanceOut = CmmmCalculations.readBalance(balanceOut);
		let readWeightOut = Pools.coinWeightWithDecimals(weightOut);
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readSwapFee = Pools.tradeFeeWithDecimals(swapFee);

	
		// NOTE: removed the below check to allow for large amounts of coins
		// to be simulated on front end without throwing errors

		// Cannot exceed maximum in ratio
		// if (readAmountIn > readBalanceIn * maxInRatio)
		// 	throw Error("cannot exceed maximum in ratio");

		let amountInWithoutFee = readAmountIn * (1 - readSwapFee);
		let denominator = readBalanceIn + amountInWithoutFee;
		let base = readBalanceIn / denominator;
		let exponent = readWeightIn / readWeightOut;
		let power = Math.pow(base, exponent);

		return CmmmCalculations.unreadBalance(readBalanceOut * (1 - power));
	};

	// Computes how many tokens must be sent to a pool in order to take `amountOut`, given the
	// current balances and weights.
	public static calcInGivenOut = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountOut: Balance,
		swapFee: PoolTradeFee
	): Balance => {
		let readBalanceIn = CmmmCalculations.readBalance(balanceIn);
		let readWeightIn = Pools.coinWeightWithDecimals(weightIn);
		let readBalanceOut = CmmmCalculations.readBalance(balanceOut);
		let readWeightOut = Pools.coinWeightWithDecimals(weightOut);
		let readAmountOut = CmmmCalculations.readBalance(amountOut);
		let readSwapFee = Pools.tradeFeeWithDecimals(swapFee);

		// Amount in, so we round up overall.

		// The multiplication rounds up, and the power rounds up (so the base rounds up too).
		// Because b0 / (b0 - a0) >= 1, the exponent rounds up.

		// Cannot exceed maximum out ratio
		if (readAmountOut > readBalanceOut * CmmmCalculations.maxOutRatio)
			throw Error("cannot exceed maximum out ratio");

		let base = readBalanceOut / (readBalanceOut - readAmountOut);
		let exponent = readWeightOut / readWeightIn;
		let power = Math.pow(base, exponent);

		// Because the base is larger than one (and the power rounds up), the power should always be larger than one, so
		// the following subtraction should never revert.
		let ratio = power - 1;

		return CmmmCalculations.unreadBalance(
			(readBalanceIn * ratio) / (1 - readSwapFee)
		);
	};

	public static calcLpOutGivenExactTokensIn = (
		balances: Balance[],
		weights: PoolWeight[],
		amountsIn: Balance[],
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			Pools.tradeFeeWithDecimals(swapFeePercentage);
		// LP out, so we round down overall.

		let balanceRatiosWithFee = [];
		let invariantRatioWithFees = 0;
		let balancesI;
		let weightsI;
		let amountsI;
		let balanceRatioWithFeesI;
		for (let i = 0; i < balances.length; ++i) {
			balancesI = CmmmCalculations.readBalance(balances[i]);
			amountsI = CmmmCalculations.readBalance(amountsIn[i]);
			balanceRatioWithFeesI = (balancesI + amountsI) / balancesI;
			weightsI = Pools.coinWeightWithDecimals(weights[i]);

			balanceRatiosWithFee.push(balanceRatioWithFeesI);
			invariantRatioWithFees += balanceRatioWithFeesI * weightsI;
		}

		// Swap fees are charged on all tokens that are being added in a larger proportion than the overall invariant
		// increase.
		let invariantRatio = 1;

		for (let i = 0; i < balances.length; ++i) {
			balancesI = CmmmCalculations.readBalance(balances[i]);
			amountsI = CmmmCalculations.readBalance(amountsIn[i]);
			weightsI = Pools.coinWeightWithDecimals(weights[i]);

			let amountInWithoutFee;

			if (balanceRatiosWithFee[i] > invariantRatioWithFees) {
				// invariantRatioWithFees might be less than FixedPoint.ONE in edge scenarios due to rounding error,
				// particularly if the weights don't exactly add up to 100%.
				let nonTaxableAmount =
					invariantRatioWithFees > 1
						? balancesI * (invariantRatioWithFees - 1)
						: 0;
				let swapFee =
					(amountsI - nonTaxableAmount) * readSwapFeePercentage;
				amountInWithoutFee = amountsI - swapFee;
			} else {
				amountInWithoutFee = amountsI;

				// If a token's amount in is not being charged a swap fee then it might be zero (e.g. when joining a
				// Pool with only a subset of tokens). In this case, `balanceRatio` will equal `FixedPoint.ONE`, and
				// the `invariantRatio` will not change at all. We therefore skip to the next iteration, avoiding
				// the costly `pow_down` call.
				if (amountInWithoutFee == 0) continue;
			}

			let balanceRatio = (balancesI + amountInWithoutFee) / balancesI;

			invariantRatio *= Math.pow(balanceRatio, weightsI);
		}

		return invariantRatio > 1
			? CmmmCalculations.unreadBalance(
					readLpTotalSupply * (invariantRatio - 1)
			  )
			: BigInt(0);
	};

	public static calcLpOutGivenExactTokenIn = (
		balance: Balance,
		weight: PoolWeight,
		amountIn: Balance,
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = Pools.coinWeightWithDecimals(weight);
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			Pools.tradeFeeWithDecimals(swapFeePercentage);

		// LP out, so we round down overall.

		let amountInWithoutFee;
		{
			let balanceRatioWithFee = (redBalance + readAmountIn) / redBalance;

			// The use of `fixed::complement(weight)` assumes that the sum of all weights equals 1.
			// This may not be the case when weights are stored in a denormalized format or during a gradual weight
			// change due rounding errors during normalization or interpolation. This will result in a small difference
			// between the output of this function and the equivalent `_calc_lp_out_given_exact_tokens_in` call.
			let invariantRatioWithFees =
				balanceRatioWithFee * readWeight + (1 - readWeight);

			if (balanceRatioWithFee > invariantRatioWithFees) {
				let nonTaxableAmount =
					invariantRatioWithFees > 1
						? redBalance * (invariantRatioWithFees - 1)
						: 0;
				let taxableAmount = readAmountIn - nonTaxableAmount;
				let swapFee = taxableAmount * readSwapFeePercentage;

				amountInWithoutFee = nonTaxableAmount + taxableAmount - swapFee;
			} else {
				amountInWithoutFee = readAmountIn;
				// If a token's amount in is not being charged a swap fee then it might be zero.
				// In this case, it's clear that the sender should receive no LP.
				if (amountInWithoutFee == 0) {
					return BigInt(0);
				}
			}
		}

		let balanceRatio = (redBalance + amountInWithoutFee) / redBalance;

		let invariantRatio = Math.pow(balanceRatio, readWeight);

		return invariantRatio > 1
			? CmmmCalculations.unreadBalance(
					readLpTotalSupply * (invariantRatio - 1)
			  )
			: BigInt(0);
	};

	public static calcTokenInGivenExactLpOut = (
		balance: Balance,
		weight: PoolWeight,
		lpAmountOut: Balance,
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = Pools.coinWeightWithDecimals(weight);
		let readLpAmountOut = CmmmCalculations.readBalance(lpAmountOut);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			Pools.tradeFeeWithDecimals(swapFeePercentage);


		// Token in, so we round up overall.

		// Calculate the factor by which the invariant will increase after minting lpAmountOut
		let invariantRatio =
			(readLpTotalSupply + readLpAmountOut) / readLpTotalSupply;
		if (invariantRatio > CmmmCalculations.maxInvariantRatio)
			throw Error("max out lp for token in");

		// Calculate by how much the token balance has to increase to match the invariantRatio
		let balanceRatio = Math.pow(invariantRatio, 1 / readWeight);

		let amountInWithoutFee = redBalance * (balanceRatio - 1);

		// We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
		// accordingly.
		let taxableAmount = amountInWithoutFee * (1 - readWeight);
		let nonTaxableAmount = amountInWithoutFee - taxableAmount;

		let taxableAmountPlusFees = taxableAmount / (1 - readSwapFeePercentage);

		return CmmmCalculations.unreadBalance(
			nonTaxableAmount + taxableAmountPlusFees
		);
	};

	public static calcAllTokensInGivenExactLpOut = (
		balances: Balance[],
		lpAmountOut: Balance,
		totalLp: Balance
	): Balance[] => {
		let readLpAmountOut = CmmmCalculations.readBalance(lpAmountOut);
		let readTotalLp = CmmmCalculations.readBalance(totalLp);

		// Tokens in, so we round up overall.
		let lpRatio = readLpAmountOut / readTotalLp;

		let amountsIn: Balance[] = [];
		for (let balanceI of balances) {
			amountsIn.push(
				CmmmCalculations.unreadBalance(
					CmmmCalculations.readBalance(balanceI) * lpRatio
				)
			);
		}

		return amountsIn;
	};

	public static calcLpInGivenExactTokensOut = (
		balances: Balance[],
		weights: PoolWeight[],
		amountsOut: Balance[],
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			Pools.tradeFeeWithDecimals(swapFeePercentage);

		// LP in, so we round up overall.

		let balanceRatiosWithoutFee: number[] = [];
		let invariantRatioWithoutFee = 0;
		for (let i = 0; i < balances.length; ++i) {
			let balancesI = CmmmCalculations.readBalance(balances[i]);
			let amountsOutI = CmmmCalculations.readBalance(amountsOut[i]);
			let balanceRatioWithoutFeesI =
				(balancesI - amountsOutI) / balancesI;
			let weightsI = Pools.coinWeightWithDecimals(weights[i]);

			balanceRatiosWithoutFee.push(balanceRatioWithoutFeesI);
			invariantRatioWithoutFee += balanceRatioWithoutFeesI * weightsI;
		}

		let invariantRatio = 1;

		for (let i = 0; i < balances.length; ++i) {
			let balanceRatiosWithoutFeeI = balanceRatiosWithoutFee[i];
			let balancesI = CmmmCalculations.readBalance(balances[i]);
			let amountsOutI = CmmmCalculations.readBalance(amountsOut[i]);
			let weightsI = Pools.coinWeightWithDecimals(weights[i]);

			// Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
			// 'token out'. This results in slightly larger price impact.

			let amountOutWithFee;
			if (invariantRatioWithoutFee > balanceRatiosWithoutFeeI) {
				let nonTaxableAmount =
					balancesI * (1 - invariantRatioWithoutFee);
				let taxableAmount = amountsOutI - nonTaxableAmount;
				let taxableAmountPlusFees =
					taxableAmount / (1 - readSwapFeePercentage);

				amountOutWithFee = nonTaxableAmount + taxableAmountPlusFees;
			} else {
				amountOutWithFee = amountsOutI;
				// If a token's amount out is not being charged a swap fee then it might be zero (e.g. when exiting a
				// Pool with only a subset of tokens). In this case, `balanceRatio` will equal `FixedPoint.ONE`, and
				// the `invariantRatio` will not change at all. We therefore skip to the next iteration, avoiding
				// the costly `pow_down` call.
				if (amountOutWithFee == 0) continue;
			}

			invariantRatio *= Math.pow(
				(balancesI - amountOutWithFee) / balancesI,
				weightsI
			);
		}

		return CmmmCalculations.unreadBalance(
			readLpTotalSupply * (1 - invariantRatio)
		);
	};

	public static calcRequestedTokensOutGivenExactLpIn = (
		balances: Balance[],
		requestedAmountsOut: Balance[],
		weights: PoolWeight[],
		lpAmountIn: Balance,
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance[] => {
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readLpAmountIn = CmmmCalculations.readBalance(lpAmountIn);
		let readSwapFeePercentage =
			CmmmCalculations.readBalance(swapFeePercentage);
		let len = balances.length;

		// Looking for a scalar p such that scaling the amounts vector C = (c1, c2, ..., cn) by p and withdrawing those amounts
		// p*C = (pc1, ..., pcn) corresponds to lp_amount_in. The value for p is solved with Newton's method using the function
		// from calc_lp_in_given_exact_tokens_out

		// Newton's method notes: call the function from calc_lp_in_given_exact_tokens_out F. That is, F(p) is the lp it costs
		// to withdraw p*C from the pool. Newton's method is to create the function G(x) = x - F(x) / F'(x) and iterate G(G(...)).
		// This function G has a singularity (from F) if p is too large -- you can't withdraw more than the pool contains. That singularity
		// happens at M = min(balances[i] / A_i) where the A_i are computed below (they are amounts_out[i] but counting fees).
		// Worth noting that A_i scales with p.
		// The function G is defined for all x below M and is not defined for x >= M. Also G(x) < M if x is large enough (but not larger
		// than M) and can be >= M in some scenarios if x is too small, leading to problems iterating: if G(x) >= M then G(G(x)) DNE.
		// Thus our initial guess is itself from an iterative process, starting at M/2 and moving towards M (3M/4, 7M/8, ...) until we find
		// an initial value of x for which G(x) < M, then we do Newton's method from there. See https://www.desmos.com/calculator/0b9xwjobkg
		// for a graph to explain these functions.

		// First we need to make sure none of `requested_amounts_out` is too large
		// once solved, read requested amounts as requested_amounts_out[i] / initial_scalar
		// and that will be no larger than balances[i] < 2
		// 2r < Ib
		let initialScalar: number = 1;
		let i: number;
		let findingScalar: boolean = true;
		while (findingScalar) {
			findingScalar = false;
			i = 0;
			while (i < len) {
				if (
					CmmmCalculations.readBalance(requestedAmountsOut[i]) * 2 >=
					initialScalar * CmmmCalculations.readBalance(balances[i])
				) {
					initialScalar = initialScalar * 2;
					findingScalar = true;
					break;
				}
				i = i + 1;
			}
		}

		let weightedBalanceSum: number = 0;
		i = 0;
		while (i < len) {
			weightedBalanceSum +=
				(CmmmCalculations.readBalance(weights[i]) *
					(CmmmCalculations.readBalance(requestedAmountsOut[i]) /
						initialScalar)) /
				CmmmCalculations.readBalance(balances[i]);
			i = i + 1;
		}

		let amountsOutWithoutFee: number[] = []; // the A_i values
		let amountsOutI: number;
		let balancesI: number;
		let aI: number;
		let m: number = Number.POSITIVE_INFINITY;
		i = 0;
		while (i < len) {
			amountsOutI =
				CmmmCalculations.readBalance(requestedAmountsOut[i]) /
				initialScalar;
			balancesI = CmmmCalculations.readBalance(balances[i]);
			aI =
				weightedBalanceSum < amountsOutI / balancesI
					? (amountsOutI -
							readSwapFeePercentage *
								balancesI *
								weightedBalanceSum) /
					  (1 - readSwapFeePercentage)
					: amountsOutI;
			amountsOutWithoutFee.push(aI);
			if (balancesI / aI < m) {
				m = balancesI / aI;
			}
			i = i + 1;
		}

		// if there are overflows then these intermediates might have to be reworked
		// product of ((balance_i - p*A_i) / (balance_i)) ^ weight_i
		let intermediate1: number;
		// sum of A_i * weight_i / (balance_i - p*A_i)
		let intermediate2: number;

		// in the notation above, F(x) = intermediate_1(x) - (lp_total_supply - lp_amount_in) / lp_total_supply
		// and G(x) = (lp_total_supply * (x * intermediate_1(x) * intermediate_2(x) + intermediate_1(x) - 1) + lp_amount_in) /
		// (intermediate_1(x) * lp_total_supply * intermediate_2(x))

		// if there are overflows this function will have to be rearranged, most likely the intermediate_2 parts since those blow up

		let weightI: number;
		let prevP: number = 0;
		let currentP: number = m / 2;
		let offset: number = m / 4;
		let j: number = 0;
		while (j < 255) {
			// intermediate values used in the function G
			intermediate1 = 1;
			intermediate2 = 0;
			i = 0;
			while (i < len) {
				balancesI = CmmmCalculations.readBalance(balances[i]);
				weightI = CmmmCalculations.readBalance(weights[i]);
				aI = amountsOutWithoutFee[i];

				intermediate1 *= Math.pow(
					(balancesI - currentP * aI) / balancesI,
					weightI
				);

				intermediate2 += (aI * weightI) / (balancesI - aI * currentP);

				i = i + 1;
			}

			// set current_p to be G(current_p)
			// if current_p >= M, replace it with M - offset, halve offset, and try again
			// these halving steps are only for the initial guess and don't count towards the convergence (j)
			while (true) {// aborts from offset vanishing, never infinite loop) {
				// checking for out of bounds
				if (currentP >= m) {
					// out of bounds so try again
					if (offset == 0) {
						throw Error("Request Tokens Out Didn't Converge");
					}
					currentP = m - offset;
					offset = offset * 2;
					// no infinite loop because offset becomes 0 eventually
				}

				// setting current_p to be G(current_p)
				currentP =
					(readLpTotalSupply *
						intermediate1 *
						(1 + currentP * intermediate2) +
						readLpAmountIn -
						readLpTotalSupply) /
					(readLpTotalSupply * intermediate1 * intermediate2);

				if (currentP < m) {
					// good value, no problem, continue main loop
					// if current_p >= m that's bad,
					// move current_p closer and try again (offset)
					break;
				}
			}

			// check if Newton's has finished converging
			if (Math.abs(currentP - prevP) < 1) {
				prevP = currentP;
				break;
			}
			prevP = currentP;
			j = j + 1;
		}

		// these will be equal if loop aborted from convergence instead of from max loop count
		if (prevP != currentP) {
			throw Error("Request Tokens Out Didn't Converge");
		}

		let actualOuts: Balance[] = [];
		i = 0;
		while (i < len) {
			actualOuts.push(
				CmmmCalculations.unreadBalance(
					(CmmmCalculations.readBalance(requestedAmountsOut[i]) /
						initialScalar) *
						currentP
				)
			);
			i = i + 1;
		}

		return actualOuts;
	};

	public static calcLpInGivenExactTokenOut = (
		balance: Balance,
		weight: PoolWeight,
		amountOut: Balance,
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = Pools.coinWeightWithDecimals(weight);
		let readAmountOut = CmmmCalculations.readBalance(amountOut);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			Pools.tradeFeeWithDecimals(swapFeePercentage);

		// LP in, so we round up overall.

		let amountOutbalanceRatioWithoutFee =
			(redBalance - readAmountOut) / redBalance;

		let invariantRatioWithoutFee =
			amountOutbalanceRatioWithoutFee * readWeight + (1 - readWeight);

		let amountOutWithFee;
		if (invariantRatioWithoutFee > amountOutbalanceRatioWithoutFee) {
			// Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
			// 'token out'. This results in slightly larger price impact.

			let nonTaxableAmount = redBalance * (1 - invariantRatioWithoutFee);
			let taxableAmount = readAmountOut - nonTaxableAmount;
			let taxableAmountPlusFees =
				taxableAmount / (1 - readSwapFeePercentage);

			amountOutWithFee = nonTaxableAmount + taxableAmountPlusFees;
		} else {
			amountOutWithFee = readAmountOut;
			// If a token's amount out is not being charged a swap fee then it might be zero.
			// In this case, it's clear that the sender should not send any LP.
			if (amountOutWithFee == 0) {
				return BigInt(0);
			}
		}

		let balanceRatio = (redBalance - amountOutWithFee) / redBalance;

		let invariantRatio = Math.pow(balanceRatio, readWeight);

		return CmmmCalculations.unreadBalance(
			readLpTotalSupply * (1 - invariantRatio)
		);
	};

	public static calcTokenOutGivenExactLpIn = (
		balance: Balance,
		weight: PoolWeight,
		lpAmountIn: Balance,
		lpTotalSupply: Balance,
		swapFeePercentage: PoolTradeFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = Pools.coinWeightWithDecimals(weight);
		let readLpAmountIn = CmmmCalculations.readBalance(lpAmountIn);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			CmmmCalculations.readBalance(swapFeePercentage);

		// Token out, so we round down overall. The multiplication rounds down, but the power rounds up (so the base
		// rounds up). Because (totalLp - lp_in) / totalLp <= 1, the exponent rounds down.

		// Calculate the factor by which the invariant will decrease after burning lpAmountIn
		let invariantRatio =
			(readLpTotalSupply - readLpAmountIn) / readLpTotalSupply;
		if (invariantRatio < CmmmCalculations.minInvariantRatio)
			throw Error("min out lp for token out");

		// Calculate by how much the token balance has to decrease to match invariantRatio
		let balanceRatio = Math.pow(invariantRatio, 1 / readWeight);

		// Because of rounding up, balanceRatio can be greater than one. Using complement prevents reverts.
		let amountOutWithoutFee = redBalance * (1 - balanceRatio);

		// We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
		// in swap fees.

		// Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
		// to 'token out'. This results in slightly larger price impact. Fees are rounded up.
		let taxableAmount = amountOutWithoutFee * (1 - readWeight);
		let nonTaxableAmount = amountOutWithoutFee - taxableAmount;
		let taxableAmountMinusFees =
			taxableAmount * (1 - readSwapFeePercentage);

		return CmmmCalculations.unreadBalance(
			nonTaxableAmount + taxableAmountMinusFees
		);
	};

	public static calcTokensOutGivenExactLpIn = (
		balances: Balance[],
		lpAmountIn: Balance,
		totalLp: Balance
	): Balance[] => {
		let readLpAmountIn = CmmmCalculations.readBalance(lpAmountIn);
		let readTotalLp = CmmmCalculations.readBalance(totalLp);

		// Since we're computing an amount out, we round down overall. This means rounding down on both the
		// multiplication and division.

		let lpRatio = readLpAmountIn / readTotalLp;

		let amountsOut: Balance[] = [];
		for (let i = 0; i < balances.length; ++i) {
			amountsOut.push(
				CmmmCalculations.unreadBalance(
					CmmmCalculations.readBalance(balances[i]) * lpRatio
				)
			);
		}

		return amountsOut;
	};
	public static calcLpOutAddToken = (
		totalSupply: Balance,
		weight: PoolWeight
	): Balance => {
		let readTotalSupply = CmmmCalculations.readBalance(totalSupply);
		let readWeight = Pools.coinWeightWithDecimals(weight);

		// The amount of LP which is equivalent to the token being added may be calculated by the growth in the
		// sum of the token weights, i.e. if we add a token which will make up 50% of the pool then we should receive
		// 50% of the new supply of LP.
		//
		// The growth in the total weight of the pool can be easily calculated by:
		//
		// weight_sum_ratio = total_weight / (total_weight - new_token_weight)
		//
		// As we're working with normalized weights `total_weight` is equal to 1.

		let weightSumRatio = 1 / (1 - readWeight);

		// The amount of LP to mint is then simply:
		//
		// toMint = total_supply * (weight_sum_ratio - 1)

		return CmmmCalculations.unreadBalance(
			readTotalSupply * (weightSumRatio - 1)
		);
	};

	// ------------------------------------------------------------------
	// Quality of life functions
	// ------------------------------------------------------------------

	// spot price is given in units of Cin / Cout
	// spot price formula for fixed point
	public static calcSpotPrice = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight
	): number =>
		CmmmCalculations.readBalance(balanceIn) /
		Pools.coinWeightWithDecimals(weightIn) /
		(CmmmCalculations.readBalance(balanceOut) /
			Pools.coinWeightWithDecimals(weightOut));

	// Cheaper to calculate ideal swap ratio but does not consider price_impact. Does consider trading fees.
	public static calcIdealOutGivenIn = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountIn: Balance,
		swapFee: PoolTradeFee
	): Balance => {
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readSwapFee = Pools.tradeFeeWithDecimals(swapFee);

		let amountInWithoutFee = readAmountIn * (1 - readSwapFee);
		let price = CmmmCalculations.calcSpotPrice(
			balanceIn,
			weightIn,
			balanceOut,
			weightOut
		);
		// price P equals amountIn / amountOut (idealized), so amountOut = amountIn / P
		return CmmmCalculations.unreadBalance(amountInWithoutFee / price);
	};

	// Calculate price impact for this trade
	public static calcPriceImpactFully = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountIn: Balance,
		swapFee: PoolTradeFee
	): Balance => {
		return (
			CmmmCalculations.calcIdealOutGivenIn(
				balanceIn,
				weightIn,
				balanceOut,
				weightOut,
				amountIn,
				swapFee
			) -
			CmmmCalculations.calcOutGivenIn(
				balanceIn,
				weightIn,
				balanceOut,
				weightOut,
				amountIn,
				swapFee
			)
		);
	};*/
}

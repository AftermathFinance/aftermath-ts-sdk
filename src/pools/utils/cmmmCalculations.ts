import { Balance, PoolSwapFee, PoolWeight } from "../../types";

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

	private static readBalance = (fixed: bigint, digits = 9): number =>
		balanceWithDecimals(fixed, digits);
	private static unreadBalance = (native: number, digits = 9) =>
		normalizeBalance(native, digits);

	// About swap fees on joins and exits:
	// Any join or exit that is not perfectly balanced (e.g. all single token joins or exits) is mathematically
	// equivalent to a perfectly balanced join or exit followed by a series of swaps. Since these swaps would charge
	// swap fees, it follows that (some) joins and exits should as well.
	// On these operations, we split the token amounts in 'taxable' and 'non-taxable' portions, where the 'taxable' part
	// is the one to which swap fees are applied.

	// Invariant is used to collect protocol swap fees by comparing its value between two times.
	// So we can round always to the same direction. It is also used to initiate the LP amount
	// and, because there is a minimum LP, we round down the ; invariant.
	public static calcInvariant = (
		weights: PoolWeight[],
		balances: Balance[]
	): number => {
		/*********************************************************************************************
    // invariant               _____                                                             //
    // wi = weight index i      | |      wi                                                      //
    // bi = balance index i     | |  bi ^   = i                                                  //
    // i = invariant                                                                             //
    **********************************************************************************************/

		let inv = 1;
		let balance;
		let weight;
		for (let i = 0; i < balances.length; ++i) {
			balance = CmmmCalculations.readBalance(balances[i]);
			weight = poolWeightWithDecimals(weights[i]);
			if (weight < CmmmCalculations.minWeight)
				throw Error("weight too small");
			inv = inv * Math.pow(balance, weight);
		}

		if (inv <= 0) throw Error("invariant must be positive");
		return inv;
	};

	// Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
	// current balances and weights.
	public static calcOutGivenIn = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountIn: Balance,
		swapFee: PoolSwapFee
	): Balance => {
		let readBalanceIn = CmmmCalculations.readBalance(balanceIn);
		let readWeightIn = poolWeightWithDecimals(weightIn);
		let readBalanceOut = CmmmCalculations.readBalance(balanceOut);
		let readWeightOut = poolWeightWithDecimals(weightOut);
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readSwapFee = poolSwapFeeWithDecimals(swapFee);

		/*********************************************************************************************
    // outGivenIn                                                                                //
    // aO = amountOut                                                                           //
    // bO = balance_out                                                                          //
    // bI = balance_in              /      /            bI              \  (wI / wO) \           //
    // aI = amountIn     aO = bO * |  1 - | -------------------------- | ^          |           //
    // wI = weight_in               \      \       ( bI + aI )          /            /           //
    // wO = weight_out                                                                           //
    **********************************************************************************************/

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
		swapFee: PoolSwapFee
	): Balance => {
		let readBalanceIn = CmmmCalculations.readBalance(balanceIn);
		let readWeightIn = poolWeightWithDecimals(weightIn);
		let readBalanceOut = CmmmCalculations.readBalance(balanceOut);
		let readWeightOut = poolWeightWithDecimals(weightOut);
		let readAmountOut = CmmmCalculations.readBalance(amountOut);
		let readSwapFee = poolSwapFeeWithDecimals(swapFee);
		/*********************************************************************************************
    // inGivenOut                                                                                //
    // aO = amountOut                                                                            //
    // bO = balance_out                                                                          //
    // bI = balance_in             /  /            bO              \   (wO / wI)     \           //
    // aI = amountIn    aI = bI * |  | ---------------------------- | ^          - 1 | / (1 - s) //
    // wI = weight_in              \  \       ( bO - aO )          /                 /           //
    // wO = weight_out                                                                           //
    **********************************************************************************************/

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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage = poolSwapFeeWithDecimals(swapFeePercentage);
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
			weightsI = poolWeightWithDecimals(weights[i]);

			balanceRatiosWithFee.push(balanceRatioWithFeesI);
			invariantRatioWithFees += balanceRatioWithFeesI * weightsI;
		}

		// Swap fees are charged on all tokens that are being added in a larger proportion than the overall invariant
		// increase.
		let invariantRatio = 1;

		for (let i = 0; i < balances.length; ++i) {
			balancesI = CmmmCalculations.readBalance(balances[i]);
			amountsI = CmmmCalculations.readBalance(amountsIn[i]);
			weightsI = poolWeightWithDecimals(weights[i]);

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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = poolWeightWithDecimals(weight);
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage = poolSwapFeeWithDecimals(swapFeePercentage);

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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = poolWeightWithDecimals(weight);
		let readLpAmountOut = CmmmCalculations.readBalance(lpAmountOut);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage = poolSwapFeeWithDecimals(swapFeePercentage);

		/*****************************************************************************************
    // token_in_for_exact_lp_out                                                             //
    // a = amountIn                                                                          //
    // b = balance                      /  /     totalLp + lp_out       \  (1 / w)       \   //
    // lp_out = lpAmountOut     a = b * |  | -------------------------- | ^          - 1 |   //
    // lp = totalLp                     \  \        totalLp             /                /   //
    // w = weight                                                                            //
    ******************************************************************************************/

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
		/***********************************************************************************
    // tokens_in_for_exact_lp_out                                                      //
    // (per token)                                                                     //
    // aI = amountIn                    /    lp_out    \                               //
    // b = balance             aI = b * | ------------ |                               //
    // lp_out = lpAmountOut             \   totalLp    /                               //
    // lp = totalLp                                                                    //
    ************************************************************************************/

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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage = poolSwapFeeWithDecimals(swapFeePercentage);

		// LP in, so we round up overall.

		let balanceRatiosWithoutFee: number[] = [];
		let invariantRatioWithoutFee = 0;
		for (let i = 0; i < balances.length; ++i) {
			let balancesI = CmmmCalculations.readBalance(balances[i]);
			let amountsOutI = CmmmCalculations.readBalance(amountsOut[i]);
			let balanceRatioWithoutFeesI =
				(balancesI - amountsOutI) / balancesI;
			let weightsI = poolWeightWithDecimals(weights[i]);

			balanceRatiosWithoutFee.push(balanceRatioWithoutFeesI);
			invariantRatioWithoutFee += balanceRatioWithoutFeesI * weightsI;
		}

		let invariantRatio = 1;

		for (let i = 0; i < balances.length; ++i) {
			let balanceRatiosWithoutFeeI = balanceRatiosWithoutFee[i];
			let balancesI = CmmmCalculations.readBalance(balances[i]);
			let amountsOutI = CmmmCalculations.readBalance(amountsOut[i]);
			let weightsI = poolWeightWithDecimals(weights[i]);

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
		swapFeePercentage: PoolSwapFee
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
			while (true /*aborts from offset vanishing, never infinite loop*/) {
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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = poolWeightWithDecimals(weight);
		let readAmountOut = CmmmCalculations.readBalance(amountOut);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage = poolSwapFeeWithDecimals(swapFeePercentage);

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
		swapFeePercentage: PoolSwapFee
	): Balance => {
		let redBalance = CmmmCalculations.readBalance(balance);
		let readWeight = poolWeightWithDecimals(weight);
		let readLpAmountIn = CmmmCalculations.readBalance(lpAmountIn);
		let readLpTotalSupply = CmmmCalculations.readBalance(lpTotalSupply);
		let readSwapFeePercentage =
			CmmmCalculations.readBalance(swapFeePercentage);

		/****************************************************************************************
    // exact_lp_in_for_token_out                                                            //
    // a = amountOut                                                                        //
    // b = balance                     /      /     totalLp - lp_in        \  (1 / w)  \    //
    // lp_in = lpAmountIn      a = b * |  1 - | -------------------------- | ^         |    //
    // lp = totalLp                    \      \        totalLp             /           /    //
    // w = weight                                                                           //
    *****************************************************************************************/

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

		/*********************************************************************************************
    // exact_lp_in_for_tokens_out                                                                //
    // (per token)                                                                               //
    // aO = amountOut                   /        lp_in          \                                //
    // b = balance             a0 = b * | --------------------- |                                //
    // lp_in = lpAmountIn               \       totalLp         /                                //
    // LP = totalLp                                                                              //
    **********************************************************************************************/

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

	/*
	 * @dev Calculate the amount of LP which should be minted when adding a new token to the Pool.
	 *
	 * Note that weight is set that it corresponds to the desired weight of this token *after* adding it.
	 * i.e. For a two token 50:50 pool which we want to turn into a 33:33:33 pool, we use a normalized weight of 33%
	 * @param total_supply - the total supply of the Pool's LP.
	 * @param weight - the normalized weight of the token to be added (normalized relative to final weights)
	 */
	public static calcLpOutAddToken = (
		totalSupply: Balance,
		weight: PoolWeight
	): Balance => {
		let readTotalSupply = CmmmCalculations.readBalance(totalSupply);
		let readWeight = poolWeightWithDecimals(weight);

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
		poolWeightWithDecimals(weightIn) /
		(CmmmCalculations.readBalance(balanceOut) /
			poolWeightWithDecimals(weightOut));

	// Cheaper to calculate ideal swap ratio but does not consider price_impact. Does consider trading fees.
	public static calcIdealOutGivenIn = (
		balanceIn: Balance,
		weightIn: PoolWeight,
		balanceOut: Balance,
		weightOut: PoolWeight,
		amountIn: Balance,
		swapFee: PoolSwapFee
	): Balance => {
		let readAmountIn = CmmmCalculations.readBalance(amountIn);
		let readSwapFee = poolSwapFeeWithDecimals(swapFee);

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
		swapFee: PoolSwapFee
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
	};
}

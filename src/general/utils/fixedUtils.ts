import { Balance, DecimalsScalar, NormalizedBalance } from "../../types";

/**
 * The `FixedUtils` class provides utilities for fixed-point arithmetic
 * with a standard 18-decimal precision, along with some convenience
 * methods for normalizing/un-normalizing amounts based on token decimals.
 */
export class FixedUtils {
	/**
	 * Represents 1.0 in 18-decimal fixed math as a float: 1_000_000_000_000_000_000.
	 */
	public static readonly fixedOneN: number = 1_000_000_000_000_000_000;

	/**
	 * Represents 1.0 in 18-decimal fixed math as a bigint: 1000000000000000000n.
	 */
	public static readonly fixedOneB: bigint = BigInt("1000000000000000000");

	/**
	 * Represents 1.0 in 9-decimal fixed math as a float: 1_000_000_000.
	 */
	public static readonly fixedOneN9 = 1_000_000_000;

	/**
	 * Represents 1.0 in 9-decimal fixed math as a bigint: 1000000000n.
	 */
	public static readonly fixedOneB9 = BigInt(1_000_000_000);

	// These methods relate to direct cast/un-cast logic for on-chain usage:

	/**
	 * Directly convert an on-chain `u64` (stored as a bigint) into a float, effectively no scaling.
	 *
	 * @param n - The on-chain number as a bigint.
	 * @returns The converted number as a float.
	 */
	public static readonly convertFromInt = (n: OnChainNumber): LocalNumber =>
		Number(n);

	/**
	 * Convert a floating number back to an on-chain integer (bigint),
	 * truncating decimals.
	 *
	 * @param n - The local float.
	 * @returns The truncated bigint.
	 */
	public static readonly convertToInt = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n));

	/**
	 * Converts a fixed-18 on-chain number to a floating local number by dividing by `fixedOneN`.
	 *
	 * @param n - The on-chain 18-decimal fixed number (as a bigint).
	 * @returns A float representing the unscaled value.
	 */
	public static readonly directCast = (n: OnChainNumber): LocalNumber =>
		Number(n) / FixedUtils.fixedOneN;

	/**
	 * Converts a floating local number to an on-chain 18-decimal fixed bigint by multiplying by `fixedOneN`.
	 *
	 * @param n - The local float to be scaled.
	 * @returns The scaled 18-decimal fixed as a bigint.
	 */
	public static readonly directUncast = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n * FixedUtils.fixedOneN));

	/**
	 * Returns the complement of the number in `[0,1]`, i.e., `1 - n`.
	 * If `n` is negative, it's treated as zero; if `n` > 1, also treated as zero for the complement.
	 *
	 * @param n - The local float in [0,1].
	 * @returns The complement of `n` in [0,1].
	 */
	public static readonly complement = (n: LocalNumber) =>
		Math.max(0, 1 - Math.max(0, n));

	/**
	 * Multiplies a raw integer `amount` by a `decimalsScalar` to produce
	 * a "normalized" form. E.g., if decimals = 9, we store it as 10^9 scale.
	 *
	 * @param decimalsScalar - The scale factor for the coin (e.g., 1e9).
	 * @param amount - The raw integer (balance) to be scaled.
	 * @returns The scaled (normalized) amount as a `number`.
	 */
	public static readonly normalizeAmount = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): NormalizedBalance => amount * decimalsScalar;

	/**
	 * Divides a normalized amount by the `decimalsScalar` to get back the
	 * raw on-chain integer. This is typically used after floating computations.
	 *
	 * @param decimalsScalar - The scale factor for the coin (e.g., 1e9).
	 * @param normalizedAmount - The scaled amount to reduce.
	 * @returns The raw integer balance.
	 */
	public static readonly unnormalizeAmount = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: NormalizedBalance
	): Balance => normalizedAmount / decimalsScalar;

	/**
	 * Directly cast a `Balance` to an 18-decimal float, factoring in token decimals.
	 *
	 * @param decimalsScalar - The token's decimal scale factor.
	 * @param amount - The raw integer `Balance`.
	 * @returns A float representing the 18-decimal scale cast.
	 */
	public static readonly castAndNormalize = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): LocalNumber =>
		FixedUtils.directCast(
			FixedUtils.normalizeAmount(decimalsScalar, amount)
		);

	/**
	 * Reverse the cast of a normalized float back to a raw `Balance`,
	 * factoring in the token decimals.
	 *
	 * @param decimalsScalar - The token's decimal scale factor.
	 * @param normalizedAmount - A local float in 18-decimal domain.
	 * @returns A raw integer `Balance`.
	 */
	public static readonly uncastAndUnnormalize = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: LocalNumber
	): Balance =>
		FixedUtils.unnormalizeAmount(
			decimalsScalar,
			FixedUtils.directUncast(normalizedAmount)
		);
}

// Distinguishes on-chain numeric usage in the codebase.

/**
 * A numeric type used on chain, typically fixed 18 decimals or direct u64.
 */
export type OnChainNumber = bigint;
/**
 * A local floating value for user calculations or UI representation.
 */
export type LocalNumber = number;
/**
 * A scalar is any fixed 18-point number. They are stored on chain as a u128 and are always directly cast.
 */
export type OnChainScalar = OnChainNumber;

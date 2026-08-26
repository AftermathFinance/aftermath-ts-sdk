import type { Balance, DecimalsScalar, NormalizedBalance } from "../../types";

/**
 * Provides fixed-point conversions and token-decimal normalization.
 *
 * Direct fixed-point conversions use an 18-decimal scale. Normalization uses
 * the caller-supplied token decimal scalar and keeps on-chain amounts as
 * `bigint` values until a direct cast produces a JavaScript `number`.
 */
export class FixedUtils {
	/**
	 * The JavaScript-number scale for 18-decimal fixed-point values, `1e18`.
	 *
	 * JavaScript numbers do not represent every integer at this magnitude exactly.
	 */
	public static readonly fixedOneN: number = 1_000_000_000_000_000_000;

	/**
	 * The exact bigint scale for 18-decimal fixed-point values, `1000000000000000000n`.
	 */
	public static readonly fixedOneB: bigint = BigInt("1000000000000000000");

	/**
	 * The JavaScript-number scale for 9-decimal fixed-point values, `1e9`.
	 */
	public static readonly fixedOneN9 = 1_000_000_000;

	/**
	 * The exact bigint scale for 9-decimal fixed-point values, `1000000000n`.
	 */
	public static readonly fixedOneB9 = BigInt(1_000_000_000);

	// These methods relate to direct cast/un-cast logic for on-chain usage:

	/**
	 * Converts a raw on-chain bigint to a JavaScript number without scaling.
	 *
	 * Values larger than JavaScript's safe integer range can lose precision.
	 *
	 * @param n - The raw on-chain integer.
	 * @returns The raw value as a JavaScript `number`.
	 */
	public static readonly convertFromInt = (n: OnChainNumber): LocalNumber =>
		Number(n);

	/**
	 * Converts a JavaScript number to a raw on-chain bigint without scaling.
	 *
	 * The method applies `Math.floor`, so negative fractional values round toward
	 * negative infinity rather than toward zero. `NaN` and infinite values throw
	 * during the `bigint` conversion.
	 *
	 * @param n - The local number to convert.
	 * @returns The floored value as a `bigint`.
	 * @throws `RangeError` when `n` is not finite.
	 */
	public static readonly convertToInt = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n));

	/**
	 * Converts an 18-decimal fixed-point bigint to a JavaScript number.
	 *
	 * The method divides by `fixedOneN`; large values can lose precision when
	 * converted to `number`.
	 *
	 * @param n - The 18-decimal fixed-point integer.
	 * @returns The unscaled local number.
	 */
	public static readonly directCast = (n: OnChainNumber): LocalNumber =>
		Number(n) / FixedUtils.fixedOneN;

	/**
	 * Converts a JavaScript number to an 18-decimal fixed-point bigint.
	 *
	 * The method multiplies by `fixedOneN` and applies `Math.floor` before the
	 * `bigint` conversion. Negative fractional values therefore floor toward
	 * negative infinity, and JavaScript number precision applies before flooring.
	 *
	 * @param n - The local number to scale.
	 * @returns The scaled value as a `bigint`.
	 * @throws `RangeError` when the scaled value is not finite.
	 */
	public static readonly directUncast = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n * FixedUtils.fixedOneN));

	/**
	 * Returns a clamped complement of a local number.
	 *
	 * For `0 <= n <= 1`, the result is `1 - n`. Negative inputs are treated as
	 * zero before subtraction, and inputs greater than `1` produce `0` after the
	 * result is clamped. `NaN` is not validated and produces `NaN`.
	 *
	 * @param n - The local number to complement.
	 * @returns A value no less than `0` for finite inputs.
	 */
	public static readonly complement = (n: LocalNumber) =>
		Math.max(0, 1 - Math.max(0, n));

	/**
	 * Multiplies a raw balance by a token decimal scalar.
	 *
	 * For a token with 9 decimals, pass `1000000000n` as the scalar. The
	 * multiplication remains exact because both operands are `bigint` values.
	 *
	 * @param decimalsScalar - The token's scale factor, such as `1000000000n`.
	 * @param amount - The raw on-chain balance.
	 * @returns The normalized balance as a `bigint`.
	 */
	public static readonly normalizeAmount = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): NormalizedBalance => amount * decimalsScalar;

	/**
	 * Divides a normalized bigint by a token decimal scalar.
	 *
	 * Bigint division discards a remainder toward zero. A zero scalar throws a
	 * division-by-zero error.
	 *
	 * @param decimalsScalar - The token's scale factor as a bigint.
	 * @param normalizedAmount - The normalized balance.
	 * @returns The raw balance as a `bigint`.
	 * @throws `RangeError` when `decimalsScalar` is `0n`.
	 */
	public static readonly unnormalizeAmount = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: NormalizedBalance
	): Balance => normalizedAmount / decimalsScalar;

	/**
	 * Normalizes a raw balance and converts it to the 18-decimal local scale.
	 *
	 * The method multiplies `amount` by `decimalsScalar`, converts the product to
	 * a JavaScript number, and divides by `fixedOneN`. Large products can lose
	 * precision during the number conversion.
	 *
	 * @param decimalsScalar - The token's scale factor as a bigint.
	 * @param amount - The raw on-chain balance.
	 * @returns The normalized local value as a `number`.
	 */
	public static readonly castAndNormalize = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): LocalNumber =>
		FixedUtils.directCast(FixedUtils.normalizeAmount(decimalsScalar, amount));

	/**
	 * Converts an 18-decimal local value back to a raw balance.
	 *
	 * The method first multiplies by `fixedOneN` and floors to a bigint, then
	 * divides by `decimalsScalar`. The first step is subject to JavaScript number
	 * precision; the second step discards any bigint remainder toward zero.
	 *
	 * @param decimalsScalar - The token's scale factor as a bigint.
	 * @param normalizedAmount - The local value in the 18-decimal domain.
	 * @returns The raw balance as a `bigint`.
	 * @throws `RangeError` when `decimalsScalar` is `0n` or the scaled number is
	 * not finite.
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
 * A bigint used for raw on-chain integers and fixed-point values.
 */
export type OnChainNumber = bigint;
/**
 * A JavaScript number used for local calculations or display.
 */
export type LocalNumber = number;
/**
 * An on-chain scalar represented in the same 18-decimal domain as `directCast`.
 *
 * The alias does not enforce a range or a particular unsigned integer width.
 */
export type OnChainScalar = OnChainNumber;

import type { Byte, IFixed } from "../types";
import { Casting } from "./casting";

/**
 * Provides conversions for signed 18-decimal IFixed values.
 *
 * IFixed stores the magnitude in a bigint and uses bit `255` as its negative
 * sign bit. The class does not validate that inputs fit a particular serialized
 * width; it applies this sign-bit convention to the supplied bigint.
 */
export class IFixedUtils {
	/**
	 * The exact IFixed representation of `1.0`, `1000000000000000000n`.
	 */
	public static readonly ONE: IFixed = BigInt(1_000_000_000_000_000_000);

	/**
	 * Bit `255`, used as the negative sign bit in the 256-bit IFixed encoding.
	 */
	public static readonly GREATEST_BIT: IFixed = BigInt(1) << BigInt(255);

	/**
	 * A mask containing every bit below bit `255`.
	 *
	 * `neg` uses this value while flipping the IFixed sign bit.
	 */
	public static readonly NOT_GREATEST_BIT: IFixed =
		(BigInt(1) << BigInt(255)) - BigInt(1);

	/**
	 * Converts an IFixed bigint to a JavaScript number.
	 *
	 * The method reads bit `255` as the sign, divides the magnitude by `ONE`, and
	 * adds the integer and fractional parts. The final number can lose precision
	 * when the magnitude is larger than JavaScript can represent exactly.
	 *
	 * @param value - The signed 18-decimal IFixed value.
	 * @returns The decoded local number.
	 */
	public static numberFromIFixed = (value: IFixed): number => {
		const absVal = this.abs(value);
		const integerPart = Number(absVal / this.ONE);
		const decimalPart = Number(absVal % this.ONE) / Number(this.ONE);
		return this.sign(value) * (integerPart + decimalPart);
	};

	/**
	 * Converts a JavaScript number to an 18-decimal IFixed bigint.
	 *
	 * The absolute value is multiplied by `ONE` and floored. Negative inputs then
	 * receive the IFixed sign-bit encoding through `neg`. JavaScript number
	 * precision applies before the floor.
	 *
	 * @param value - The local number to encode.
	 * @returns The signed IFixed representation.
	 * @throws `RangeError` when the scaled value is not finite.
	 */
	public static iFixedFromNumber = (value: number): IFixed => {
		const newValue = BigInt(Math.floor(Math.abs(value) * Number(this.ONE)));
		if (value < 0) {
			return this.neg(newValue);
		}
		return newValue;
	};

	/**
	 * Removes the IFixed sign bit from a value's mathematical magnitude.
	 *
	 * Values greater than or equal to `GREATEST_BIT` are treated as negative and
	 * passed through `neg`; all other values are returned unchanged.
	 *
	 * @param value - The IFixed value to inspect.
	 * @returns The non-negative magnitude under the IFixed convention.
	 */
	public static abs = (value: IFixed): IFixed => {
		if (value >= this.GREATEST_BIT) {
			return this.neg(value);
		}
		return value;
	};

	/**
	 * Returns the mathematical sign under the IFixed sign-bit convention.
	 *
	 * Values greater than or equal to `GREATEST_BIT` return `-1`. Zero returns
	 * `0`. All other values return `1`.
	 *
	 * @param value - The IFixed value to inspect.
	 * @returns `-1`, `0`, or `1`.
	 */
	public static sign = (value: IFixed): number => {
		if (value >= this.GREATEST_BIT) {
			return -1;
		}
		if (value === BigInt(0)) {
			return 0;
		}
		return 1;
	};

	/**
	 * Negates an IFixed value in the sign-bit encoding.
	 *
	 * The operation flips the lower 255 bits, adds one, and flips bit `255`. It
	 * returns `0n` for `0n` and is an involution for values represented by this
	 * encoding.
	 *
	 * @param value - The IFixed value to negate.
	 * @returns The negated IFixed value.
	 */
	public static neg = (value: IFixed): IFixed => {
		return ((value ^ this.NOT_GREATEST_BIT) + BigInt(1)) ^ this.GREATEST_BIT;
	};

	/**
	 * Converts little-endian bytes to an IFixed bigint.
	 *
	 * The method delegates to `Casting.bigIntFromBytes`, so the byte order is
	 * little-endian and the input array is reversed in place. The resulting bigint
	 * is not sign-decoded; bit `255` is interpreted only when another IFixed
	 * method reads it.
	 *
	 * @param bytes - The little-endian IFixed bytes.
	 * @returns The encoded IFixed bigint.
	 * @throws When the byte array is empty or cannot be converted to a bigint.
	 */
	public static iFixedFromBytes = (bytes: Byte[]): IFixed => {
		return Casting.bigIntFromBytes(bytes);
	};

	/**
	 * Converts decimal byte strings to an IFixed bigint.
	 *
	 * Each string is first converted with `Casting.bytesFromStringBytes`, then the
	 * resulting byte array follows the little-endian and mutation behavior of
	 * `iFixedFromBytes`.
	 *
	 * @param bytes - Decimal strings such as `"255"` and `"0"`.
	 * @returns The encoded IFixed bigint.
	 * @throws When conversion or bigint construction fails.
	 */
	public static iFixedFromStringBytes = (bytes: string[]): IFixed => {
		return this.iFixedFromBytes(Casting.bytesFromStringBytes(bytes));
	};
}

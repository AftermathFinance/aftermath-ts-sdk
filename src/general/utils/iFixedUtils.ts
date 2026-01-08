import { Byte, IFixed } from "../types/index.ts";
import { Casting } from "./casting.ts";

/**
 * The `IFixedUtils` class provides support for signed 18-decimal fixed math,
 * referred to as "IFixed" in the Aftermath codebase. An `IFixed` value
 * is a bigint that includes sign bit manipulation.
 */
export class IFixedUtils {
	/**
	 * The representation of 1.0 in the IFixed format, i.e. 1e18.
	 */
	public static readonly ONE: IFixed = BigInt(1_000_000_000_000_000_000);

	/**
	 * The greatest bit in a 256-bit representation. This is used to indicate negative values in some approaches.
	 */
	public static readonly GREATEST_BIT: IFixed = BigInt(1) << BigInt(255);

	/**
	 * A mask that can be used to flip or remove the greatest bit in a 256-bit number.
	 */
	public static readonly NOT_GREATEST_BIT: IFixed =
		(BigInt(1) << BigInt(255)) - BigInt(1);

	/**
	 * Converts an IFixed bigint into a floating-point number, extracting both the integer
	 * and decimal portions. For negative values, the sign bit is checked and value is negated.
	 *
	 * @param value - The IFixed value (signed 18-decimal) as a bigint.
	 * @returns A standard JavaScript number with fractional parts intact.
	 */
	public static numberFromIFixed = (value: IFixed): number => {
		const absVal = this.abs(value);
		const integerPart = Number(absVal / this.ONE);
		const decimalPart = Number(absVal % this.ONE) / Number(this.ONE);
		return this.sign(value) * (integerPart + decimalPart);
	};

	/**
	 * Converts a floating-point number into an IFixed bigint with 18 decimals of precision.
	 * Negative numbers have the sign bit set.
	 *
	 * @param value - The JavaScript number to convert.
	 * @returns The resulting IFixed bigint in on-chain-compatible format.
	 */
	public static iFixedFromNumber = (value: number): IFixed => {
		const newValue = BigInt(Math.floor(Math.abs(value) * Number(this.ONE)));
		if (value < 0) return this.neg(newValue);
		return newValue;
	};

	/**
	 * Returns the absolute value of an IFixed number. If the value is negative,
	 * it's converted to its positive counterpart by flipping bits.
	 *
	 * @param value - The signed IFixed number as a bigint.
	 * @returns The absolute value in IFixed.
	 */
	public static abs = (value: IFixed): IFixed => {
		if (value >= this.GREATEST_BIT) return this.neg(value);
		return value;
	};

	/**
	 * Determines the sign of an IFixed number.
	 * - If >= GREATEST_BIT, it's negative (-1).
	 * - If exactly 0, sign is 0.
	 * - Otherwise, sign is +1.
	 *
	 * @param value - The IFixed number to check.
	 * @returns `-1`, `0`, or `1` based on the sign.
	 */
	public static sign = (value: IFixed): number => {
		if (value >= this.GREATEST_BIT) return -1;
		if (value === BigInt(0)) return 0;
		return 1;
	};

	/**
	 * Negates an IFixed number by flipping bits. This effectively does `-value` for the signed 18-dec representation.
	 *
	 * @param value - The IFixed number to negate.
	 * @returns The negated IFixed number as a bigint.
	 */
	public static neg = (value: IFixed): IFixed => {
		return (
			((value ^ this.NOT_GREATEST_BIT) + BigInt(1)) ^ this.GREATEST_BIT
		);
	};

	/**
	 * Constructs an IFixed number from an array of bytes in little-endian format.
	 * The sign bit might be set if the top bit is `1`.
	 *
	 * @param bytes - The byte array representing the IFixed number.
	 * @returns The IFixed bigint.
	 */
	public static iFixedFromBytes = (bytes: Byte[]): IFixed => {
		return Casting.bigIntFromBytes(bytes);
	};

	/**
	 * Constructs an IFixed number from an array of stringified bytes,
	 * each representing a decimal numeric value (e.g., `"255"`, `"0"`).
	 *
	 * @param bytes - An array of string bytes.
	 * @returns The IFixed bigint.
	 */
	public static iFixedFromStringBytes = (bytes: string[]): IFixed => {
		return this.iFixedFromBytes(Casting.bytesFromStringBytes(bytes));
	};
}

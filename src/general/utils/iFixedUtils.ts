import { IFixed } from "../types";

export class IFixedUtils {
	public static readonly ONE: IFixed = BigInt(1_000_000_000_000_000_000);
	public static readonly GREATEST_BIT: IFixed = BigInt(1) << BigInt(255);
	public static readonly NOT_GREATEST_BIT: IFixed =
		(BigInt(1) << BigInt(255)) - BigInt(1);

	public static numberFromIFixed = (value: IFixed): number => {
		const absVal = this.abs(value);
		const integerPart = Number(absVal / this.ONE);
		const decimalPart = Number(absVal % this.ONE) / Number(this.ONE);
		return this.sign(value) * (integerPart + decimalPart);
	};

	public static iFixedFromNumber = (value: number): IFixed => {
		const newValue = BigInt(Math.floor(Math.abs(value) * Number(this.ONE)));
		if (value < 0) return this.neg(newValue);
		return newValue;
	};

	public static abs = (value: IFixed): IFixed => {
		if (value >= this.GREATEST_BIT) return this.neg(value);
		return value;
	};

	public static sign = (value: IFixed): number => {
		if (value >= this.GREATEST_BIT) return -1;
		if (value === BigInt(0)) return 0;
		return 1;
	};

	public static neg = (value: IFixed): IFixed => {
		return (
			((value ^ this.NOT_GREATEST_BIT) + BigInt(1)) ^ this.GREATEST_BIT
		);
	};

	public static iFixedFromBytes = (bytes: number[]): IFixed => {
		// Convert byte array to hexadecimal string
		const hexString = bytes.reduce(
			(str, byte) => str + byte.toString(16).padStart(2, "0"),
			""
		);
		// Convert hexadecimal string to BigInt
		return BigInt("0x" + hexString);
	};
}

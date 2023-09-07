import { IFixed } from "../types";

export class IFixedUtils {
	public static readonly ONE: IFixed = BigInt(1_000_000_000_000_000_000);
	public static readonly GREATEST_BIT: IFixed = BigInt(1) << BigInt(255);
	public static readonly NOT_GREATEST_BIT: IFixed =
		(BigInt(1) << BigInt(255)) - BigInt(1);

	public static readonly numberFromIFixed = (value: IFixed): number => {
		const absVal = this.abs(value);
		const integerPart = Number(absVal / this.ONE);
		const decimalPart = Number(absVal % this.ONE) / Number(this.ONE);
		return this.sign(value) * (integerPart + decimalPart);
	};

	// TODO
	public static readonly iFixedFromNumber = (value: number): IFixed => {
		throw new Error("TODO");
	};

	public static readonly abs = (value: IFixed): IFixed => {
		if (value >= this.GREATEST_BIT)
			return (
				((value ^ this.NOT_GREATEST_BIT) + BigInt(1)) ^
				this.GREATEST_BIT
			);
		return value;
	};

	public static readonly sign = (value: IFixed): number => {
		if (value >= this.GREATEST_BIT) return -1;
		if (value === BigInt(0)) return 0;
		return 1;
	};
}

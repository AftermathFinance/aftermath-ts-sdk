import { IFixed } from "./types"

export const ONE: IFixed = BigInt(1_000_000_000_000_000_000);
export const GREATEST_BIT: IFixed = BigInt(1) << BigInt(255);
export const NOT_GREATEST_BIT: IFixed = (BigInt(1) << BigInt(255)) - BigInt(1);

export const numberFromIFixed = (value: IFixed): number => {
    const absVal = abs(value);
    const integerPart = Number(absVal / ONE);
    const decimalPart = Number(absVal % ONE) / Number(ONE);
    return sign(value) * (integerPart + decimalPart);
}

export const abs = (value: IFixed): IFixed => {
    if (value >= GREATEST_BIT) return ((value ^ NOT_GREATEST_BIT) + BigInt(1)) ^ GREATEST_BIT;
    return value;
}

export const sign = (value: IFixed): number => {
    if (value >= GREATEST_BIT) return -1;
    if (value === BigInt(0)) return 0;
    return 1;
}

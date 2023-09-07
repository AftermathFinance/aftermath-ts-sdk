import { Balance, DecimalsScalar, NormalizedBalance } from "../../types";

export class FixedUtils {
	public static readonly fixedOneN: number = 1_000_000_000_000_000_000;
	public static readonly fixedOneB: bigint = BigInt("1000000000000000000");
	public static readonly fixedOneB9 = BigInt(1_000_000_000); // 9 decimal places

	// These terms come from their on chain counterparts. They are backwards from the point of view of js.
	// On chain direct cast means e.g. taking ((x: u64) as u256).
	public static readonly convertFromInt = (n: OnChainNumber): LocalNumber =>
		Number(n);
	public static readonly convertToInt = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n));
	public static readonly directCast = (n: OnChainNumber): LocalNumber =>
		Number(n) / FixedUtils.fixedOneN;
	public static readonly directUncast = (n: LocalNumber): OnChainNumber =>
		BigInt(Math.floor(n * FixedUtils.fixedOneN));

	public static readonly complement = (n: LocalNumber) =>
		Math.max(0, 1 - Math.max(0, n));

	public static readonly normalizeAmount = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): NormalizedBalance => amount * decimalsScalar;

	public static readonly unnormalizeAmount = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: NormalizedBalance
	): Balance => normalizedAmount / decimalsScalar;

	public static readonly castAndNormalize = (
		decimalsScalar: DecimalsScalar,
		amount: Balance
	): LocalNumber =>
		FixedUtils.directCast(
			FixedUtils.normalizeAmount(decimalsScalar, amount)
		);

	public static readonly uncastAndUnnormalize = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: LocalNumber
	): Balance =>
		FixedUtils.unnormalizeAmount(
			decimalsScalar,
			FixedUtils.directUncast(normalizedAmount)
		);
}

// These are the various uses for on chain numbers.

export type OnChainNumber = bigint;
export type LocalNumber = number;

// Raw integers are always converted as opposed to directly cast.
export type OnChainRawInteger = OnChainNumber;

// A unitary parameter is a number between 0 and 1 (inclusive). They are stored on chain as a u64.
export type OnChainUnitaryParameter = OnChainNumber;

// A scalar is any fixed 18-point number. They are stored on chain as a u128 and are always directly cast.
export type OnChainScalar = OnChainNumber;

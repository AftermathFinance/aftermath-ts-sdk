import { Balance, DecimalsScalar, NormalizedBalance } from "../../types";

export type OnChainNumber = bigint;
export type LocalNumber = number;

export class Fixed {
    public static fixedOneN: number = 1_000_000_000_000_000_000;
    public static fixedOneB: bigint = BigInt("1000000000000000000");

    // These terms come from their on chain counterparts. They are backwards from the point of view of js.
    // On chain direct cast means e.g. taking ((x: u64) as u256).
    public static convertFromInt = (n: OnChainNumber): LocalNumber => Number(n);
	public static convertToInt = (n: LocalNumber): OnChainNumber => BigInt(Math.floor(n));
    public static directCast = (n: OnChainNumber): LocalNumber => Number(n) / Fixed.fixedOneN;
    public static directUncast = (n: LocalNumber): OnChainNumber => BigInt(
        Math.floor(n * Fixed.fixedOneN)
    );

    public static complement = (n: LocalNumber) => Math.max(0, 1 - Math.max(0, n));

	public static normalizeAmount = (
		decimalsScalar: DecimalsScalar,
		amount: Balance,
	): NormalizedBalance =>
		amount * decimalsScalar;
	
	public static unnormalizeAmount = (
		decimalsScalar: DecimalsScalar,
		normalizedAmount: NormalizedBalance
	 ): Balance =>
			normalizedAmount / decimalsScalar;

    public static castAndNormalize = (
        decimalsScalar: DecimalsScalar,
        amount: Balance
    ): LocalNumber => Fixed.directCast(
        Fixed.normalizeAmount(
            decimalsScalar,
            amount
        )
    )

    public static uncastAndUnnormalize = (
        decimalsScalar: DecimalsScalar,
        normalizedAmount: LocalNumber
    ): Balance => Fixed.unnormalizeAmount(
        decimalsScalar,
        Fixed.directUncast(normalizedAmount)
    )
}

// These are the various uses for on chain numbers.

// Raw integers are always converted as opposed to directly cast.
export type OnChainRawInteger = OnChainNumber;

// A unitary parameter is a number between 0 and 1 (inclusive). They are stored on chain as a u64.
export type OnChainUnitaryParameter = OnChainNumber;

// A scalar is any fixed 18-point number. They are stored on chain as a u128 and are always directly cast.
export type OnChainScalar = OnChainNumber;

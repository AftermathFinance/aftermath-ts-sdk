import { CapysApiCasting } from "../../packages/capys/api/capysApiCasting";
import { FaucetApiCasting } from "../../packages/faucet/api/faucetApiCasting";
import { NftAmmApiCasting } from "../../packages/nftAmm/api/nftAmmApiCasting";
import { PoolsApiCasting } from "../../packages/pools/api/poolsApiCasting";
import { StakingApiCasting } from "../../packages/staking/api/stakingApiCasting";
import { SuiApiCasting } from "../../packages/sui/api/suiApiCasting";
import { Byte, CallerResult } from "../types";

export class Casting {
	/////////////////////////////////////////////////////////////////////
	//// Api Casting
	/////////////////////////////////////////////////////////////////////

	public static pools = PoolsApiCasting;
	public static capys = CapysApiCasting;
	public static faucet = FaucetApiCasting;
	public static staking = StakingApiCasting;
	public static sui = SuiApiCasting;
	public static nftAmm = NftAmmApiCasting;

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fixed
	/////////////////////////////////////////////////////////////////////

	public static fixedOneBigInt: bigint = BigInt("1000000000000000000");
	public static fixedOneNumber: number = Number(this.fixedOneBigInt);
	public static u64MaxBigInt: bigint = BigInt("0xFFFFFFFFFFFFFFFF");
	public static zeroBigInt: bigint = BigInt(0);

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fixed
	/////////////////////////////////////////////////////////////////////

	public static numberToFixedBigInt = (a: number): bigint =>
		BigInt(Math.floor(a * this.fixedOneNumber));
	public static bigIntToFixedNumber = (a: bigint): number =>
		Number(a) / this.fixedOneNumber;

	public static scaleNumberByBigInt = (scalar: number, int: bigint): bigint =>
		BigInt(Math.floor(scalar * Number(int)));

	/////////////////////////////////////////////////////////////////////
	//// Misc.
	/////////////////////////////////////////////////////////////////////

	public static stringFromBytes = (bytes: Byte[]) =>
		String.fromCharCode.apply(null, bytes);

	public static bigIntFromBytes = (bytes: Byte[]) =>
		BigInt(
			"0x" +
				bytes
					.reverse()
					.map((byte) => byte.toString(16).padStart(2, "0"))
					.join("")
		);

	public static u8VectorFromString = (str: string) => {
		const textEncode = new TextEncoder();
		const encodedStr = textEncode.encode(str);

		let uint8s: number[] = [];
		for (const uint8 of encodedStr.values()) {
			uint8s.push(uint8);
		}
		return uint8s;
	};

	public static normalizeSlippageTolerance = (slippageTolerance: number) => {
		return slippageTolerance / 100;
	};

	/////////////////////////////////////////////////////////////////////
	//// Value Extraction
	/////////////////////////////////////////////////////////////////////

	// public static responseOrError = <T>(result: CallerResult<T>): T => {
	// 	const response = result?.response;
	// 	if (!response) throw new Error(result.error);
	// 	return response;
	// };
}

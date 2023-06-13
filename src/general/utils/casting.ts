import { SuiAddress, bcs } from "@mysten/sui.js";
import { SuiFrensApiCasting } from "../../packages/suiFrens/api/suiFrensApiCasting";
import { FaucetApiCasting } from "../../packages/faucet/api/faucetApiCasting";
import { NftAmmApiCasting } from "../../packages/nftAmm/api/nftAmmApiCasting";
import { PoolsApiCasting } from "../../packages/pools/api/poolsApiCasting";
import { StakingApiCasting } from "../../packages/staking/api/stakingApiCasting";
import { Byte } from "../types";
import { RouterApiCasting } from "../../packages/router/api/routerApiCasting";

export class Casting {
	// =========================================================================
	//  Api Casting
	// =========================================================================

	public static pools = PoolsApiCasting;
	public static suiFrens = SuiFrensApiCasting;
	public static faucet = FaucetApiCasting;
	public static staking = StakingApiCasting;
	public static nftAmm = NftAmmApiCasting;
	public static router = RouterApiCasting;

	// =========================================================================
	//  Constants
	// =========================================================================

	// =========================================================================
	//  Fixed
	// =========================================================================

	public static fixedOneBigInt: bigint = BigInt("1000000000000000000");
	public static fixedOneNumber: number = Number(this.fixedOneBigInt);
	public static u64MaxBigInt: bigint = BigInt("0xFFFFFFFFFFFFFFFF");
	public static u128MaxBigInt: bigint = BigInt(
		"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"
	);
	public static zeroBigInt: bigint = BigInt(0);

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Fixed
	// =========================================================================

	public static numberToFixedBigInt = (a: number): bigint =>
		BigInt(Math.floor(a * this.fixedOneNumber));
	public static bigIntToFixedNumber = (a: bigint): number =>
		Number(a) / this.fixedOneNumber;

	public static scaleNumberByBigInt = (scalar: number, int: bigint): bigint =>
		BigInt(Math.floor(scalar * Number(int)));

	// =========================================================================
	//  Bytes
	// =========================================================================

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

	public static addressFromBytes = (bytes: Byte[]): SuiAddress =>
		"0x" + bcs.de("address", new Uint8Array(bytes));

	public static unwrapDeserializedOption = (
		deserializedData: any
	): any | undefined => {
		return "Some" in deserializedData ? deserializedData.Some : undefined;
	};

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
}

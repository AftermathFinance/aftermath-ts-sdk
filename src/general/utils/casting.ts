import { BcsType, bcs } from "@mysten/sui/bcs";
import { SuiFrensApiCasting } from "../../packages/suiFrens/api/suiFrensApiCasting";
import { FaucetApiCasting } from "../../packages/faucet/api/faucetApiCasting";
import { NftAmmApiCasting } from "../../packages/nftAmm/api/nftAmmApiCasting";
import { PoolsApiCasting } from "../../packages/pools/api/poolsApiCasting";
import { StakingApiCasting } from "../../packages/staking/api/stakingApiCasting";
import { Byte, IFixed, Percentage, SuiAddress } from "../types";
import { RouterApiCasting } from "../../packages/router/api/routerApiCasting";
import { FixedUtils } from "./fixedUtils";
import { IFixedUtils } from "./iFixedUtils";
import { PerpetualsApiCasting } from "../../packages/perpetuals/api/perpetualsApiCasting";
import { FarmsApiCasting } from "../../packages/farms/api/farmsApiCasting";
import { LeveragedStakingApiCasting } from "../../packages/leveragedStaking/api/leveragedStakingApiCasting";
import { Helpers } from "../..";
import { BcsTypeName } from "../types/castingTypes";
import { SuiObjectResponse } from "@mysten/sui/client";
import { NftsApiCasting } from "../nfts/nftsApiCasting";

/**
 * Utility class for casting and conversion functions.
 * @class
 */
export class Casting {
	// =========================================================================
	//  Api Casting
	// =========================================================================

	public static pools = PoolsApiCasting;
	public static suiFrens = SuiFrensApiCasting;
	public static faucet = FaucetApiCasting;
	public static staking = StakingApiCasting;
	public static leveragedStaking = LeveragedStakingApiCasting;
	public static nftAmm = NftAmmApiCasting;
	public static router = RouterApiCasting;
	public static perpetuals = PerpetualsApiCasting;
	public static farms = FarmsApiCasting;
	public static nfts = NftsApiCasting;

	// =========================================================================
	//  Constants
	// =========================================================================

	// =========================================================================
	//  Fixed / IFixed
	// =========================================================================

	public static Fixed = FixedUtils;
	public static IFixed = IFixedUtils;

	public static u64MaxBigInt: bigint = BigInt("0xFFFFFFFFFFFFFFFF");

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Fixed
	// =========================================================================

	// TODO: only use fixed class for these functions, remove from here

	public static numberToFixedBigInt = (a: number): bigint =>
		BigInt(Math.floor(a * this.Fixed.fixedOneN));
	public static bigIntToFixedNumber = (a: bigint): number =>
		Number(a) / this.Fixed.fixedOneN;

	public static scaleNumberByBigInt = (scalar: number, int: bigint): bigint =>
		BigInt(Math.floor(scalar * Number(int)));

	// =========================================================================
	//  Fixed
	// =========================================================================

	public static percentageToBps(percentage: Percentage): bigint {
		// Convert decimal percentage to basis points
		const bps = percentage * 10000;
		// Convert basis points to bigint
		const bpsBigint = BigInt(Math.round(bps));
		return bpsBigint;
	}

	public static bpsToPercentage(bps: bigint): Percentage {
		// Convert bigint basis points to number
		const bpsNumber = Number(bps);
		// Convert basis points to decimal percentage
		const percentage = bpsNumber / 10000;
		return percentage;
	}

	// =========================================================================
	//  Bytes / BCS
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

	public static addressFromBcsBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(
			bcs.Address.parse(new Uint8Array(bytes))
		);

	public static addressFromBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(
			"0x" +
				bytes
					.map((byte) => {
						const hex = byte.toString(16);
						return hex.length === 1 ? "0" + hex : hex;
					})
					.join("")
		);

	public static addressFromStringBytes = (bytes: string[]): SuiAddress =>
		this.addressFromBytes(this.bytesFromStringBytes(bytes));

	public static bytesFromStringBytes = (bytes: string[]): Byte[] =>
		bytes.map((byte) => Number(byte));

	public static unwrapDeserializedOption = (
		deserializedData: any
	): any | undefined => {
		// return "vec" in deserializedData
		// 	? deserializedData.vec.length > 0
		// 		? deserializedData.vec[0]
		// 		: undefined
		// 	: undefined;
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

	public static castObjectBcs = <T, U>(inputs: {
		suiObjectResponse: SuiObjectResponse;
		bcsType: BcsType<U>;
		fromDeserialized: (deserialized: any) => T;
	}): T => {
		const { suiObjectResponse, bcsType, fromDeserialized } = inputs;

		const deserialized = bcsType.fromBase64(
			this.bcsBytesFromSuiObjectResponse(suiObjectResponse)
		);

		return fromDeserialized(deserialized);
	};

	public static bcsBytesFromSuiObjectResponse(
		suiObjectResponse: SuiObjectResponse
	): string {
		const rawData = suiObjectResponse.data?.bcs;
		if (rawData && "bcsBytes" in rawData) return rawData.bcsBytes;
		throw new Error(
			`no bcs bytes found on object: ${suiObjectResponse.data?.objectId}`
		);
	}
}

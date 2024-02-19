import { bcs } from "@mysten/sui.js/bcs";
import { SuiFrensApiCasting } from "../../packages/suiFrens/api/suiFrensApiCasting";
import { FaucetApiCasting } from "../../packages/faucet/api/faucetApiCasting";
import { NftAmmApiCasting } from "../../packages/nftAmm/api/nftAmmApiCasting";
import { PoolsApiCasting } from "../../packages/pools/api/poolsApiCasting";
import { StakingApiCasting } from "../../packages/staking/api/stakingApiCasting";
import { Byte, SuiAddress } from "../types";
import { RouterApiCasting } from "../../packages/router/api/routerApiCasting";
import { bcsRegistry } from "@mysten/sui.js/bcs";
import { FixedUtils } from "./fixedUtils";
import { IFixedUtils } from "./iFixedUtils";
import { PerpetualsApiCasting } from "../../packages/perpetuals/api/perpetualsApiCasting";
import { FarmsApiCasting } from "../../packages/farms/api/farmsApiCasting";
import { LeveragedStakingApiCasting } from "../../packages/leveragedStaking/api/leveragedStakingApiCasting";
import { CoinsToBalance, Helpers } from "../..";
import { BcsTypeName, IndexerSwapVolumeResponse } from "../types/castingTypes";
import { SuiObjectResponse } from "@mysten/sui.js/client";

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

	public static addressFromBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(
			"0x" + bcs.de("address", new Uint8Array(bytes))
		);

	public static unwrapDeserializedOption = (
		deserializedData: any
	): any | undefined => {
		return "vec" in deserializedData
			? deserializedData.vec.length > 0
				? deserializedData.vec[0]
				: undefined
			: undefined;
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

	public static castObjectBcs = <T>(inputs: {
		suiObjectResponse: SuiObjectResponse;
		typeName: BcsTypeName;
		fromDeserialized: (deserialized: any) => T;
		bcs: typeof bcsRegistry;
	}): T => {
		const { suiObjectResponse, typeName, fromDeserialized } = inputs;

		const deserialized = inputs.bcs.de(
			typeName,
			this.bcsBytesFromSuiObjectResponse(suiObjectResponse),
			"base64"
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

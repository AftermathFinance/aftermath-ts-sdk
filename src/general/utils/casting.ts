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
 * A central utility class for casting and conversion routines across
 * different Aftermath modules. Provides both direct numeric transformations
 * (e.g., fixed-point arithmetic) and advanced BCS-based object deserialization.
 */
export class Casting {
	// =========================================================================
	//  Api Casting
	// =========================================================================

	/**
	 * Casting utilities for pools-related data (AMM pools, liquidity, etc.).
	 */
	public static pools = PoolsApiCasting;
	/**
	 * Casting utilities for SuiFrens-related data or objects.
	 */
	public static suiFrens = SuiFrensApiCasting;
	/**
	 * Casting utilities for faucet-related data, typically for devnet or testnet tokens.
	 */
	public static faucet = FaucetApiCasting;
	/**
	 * Casting utilities for staking-related data (positions, pools, etc.).
	 */
	public static staking = StakingApiCasting;
	/**
	 * Casting utilities for leveraged staking data structures.
	 */
	public static leveragedStaking = LeveragedStakingApiCasting;
	/**
	 * Casting utilities for NFT AMM objects and events.
	 */
	public static nftAmm = NftAmmApiCasting;
	/**
	 * Casting utilities for router-based data, such as trade routes and DEX interactions.
	 */
	public static router = RouterApiCasting;
	/**
	 * Casting utilities for perpetuals/futures data.
	 */
	public static perpetuals = PerpetualsApiCasting;
	/**
	 * Casting utilities for farming data (yield farms, locked positions, etc.).
	 */
	public static farms = FarmsApiCasting;
	/**
	 * Casting utilities for NFT structures and data retrieval logic.
	 */
	public static nfts = NftsApiCasting;

	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Reference to the standard fixed-point arithmetic utilities (18 decimals).
	 */
	public static Fixed = FixedUtils;
	/**
	 * Reference to the intermediate fixed type (signed 18 decimals).
	 */
	public static IFixed = IFixedUtils;

	/**
	 * The maximum unsigned 64-bit integer value as a bigint (0xFFFFFFFFFFFFFFFF).
	 */
	public static u64MaxBigInt: bigint = BigInt("0xFFFFFFFFFFFFFFFF");

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Fixed / IFixed
	// =========================================================================

	/**
	 * Converts a floating-point number to a fixed bigint with 18 decimals.
	 * For example, `1.23` => `1230000000000000000n` if we consider 18 decimals.
	 *
	 * @param a - The number to convert.
	 * @returns A bigint representing the number in 18-decimal fixed format.
	 */
	public static numberToFixedBigInt = (a: number): bigint =>
		BigInt(Math.floor(a * this.Fixed.fixedOneN));

	/**
	 * Converts an 18-decimal fixed bigint to a floating-point number.
	 * For example, `1230000000000000000n` => `1.23`.
	 *
	 * @param a - The fixed bigint to convert.
	 * @returns A floating-point representation of the 18-decimal fixed value.
	 */
	public static bigIntToFixedNumber = (a: bigint): number =>
		Number(a) / this.Fixed.fixedOneN;

	/**
	 * Scales a bigint by a floating-point scalar. For instance, a scalar of 0.5
	 * and a bigint of 100 => 50n.
	 *
	 * @param scalar - The floating-point multiplier (e.g., 0.5).
	 * @param int - The bigint to be scaled.
	 * @returns A bigint result after scaling.
	 */
	public static scaleNumberByBigInt = (scalar: number, int: bigint): bigint =>
		BigInt(Math.floor(scalar * Number(int)));

	// =========================================================================
	//  Percentage <-> Bps
	// =========================================================================

	/**
	 * Converts a decimal percentage into basis points (bps), returned as a bigint.
	 * For example, 0.05 => 500 bps.
	 *
	 * @param percentage - The decimal percentage to convert (e.g., 0.05 for 5%).
	 * @returns A bigint representing basis points.
	 */
	public static percentageToBps(percentage: Percentage): bigint {
		// Convert decimal percentage to basis points
		const bps = percentage * 10000;
		// Convert basis points to bigint
		return BigInt(Math.round(bps));
	}

	/**
	 * Converts a bigint basis points value back to a decimal percentage.
	 * For example, 500n => 0.05 (5%).
	 *
	 * @param bps - The bigint basis points to convert (e.g., 500n).
	 * @returns The decimal percentage (0.05).
	 */
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

	/**
	 * Converts an array of bytes into a string by interpreting each byte as a character code.
	 *
	 * @param bytes - An array of bytes to convert.
	 * @returns The resulting ASCII string.
	 */
	public static stringFromBytes = (bytes: Byte[]) =>
		String.fromCharCode.apply(null, bytes as any);

	/**
	 * Interprets an array of bytes as a little-endian hex string, converting
	 * that string into a bigint. For example, `[0x01, 0x02]` => `0x0201` => `513n`.
	 *
	 * @param bytes - An array of bytes.
	 * @returns The resulting bigint from the hex.
	 */
	public static bigIntFromBytes = (bytes: Byte[]) =>
		BigInt(
			"0x" +
				bytes
					.reverse()
					.map((byte) => byte.toString(16).padStart(2, "0"))
					.join("")
		);

	/**
	 * Converts BCS-encoded address bytes into a SuiAddress (0x...) string,
	 * preserving any needed leading zeroes.
	 *
	 * @param bytes - The address bytes in BCS-encoded form.
	 * @returns A normalized Sui address string (e.g., "0x000123...").
	 */
	public static addressFromBcsBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(
			bcs.Address.parse(new Uint8Array(bytes))
		);

	/**
	 * Converts an array of bytes directly to a Sui address string in "0x..." format,
	 * adding any leading zeros if needed.
	 *
	 * @param bytes - The raw bytes for the address.
	 * @returns A normalized Sui address.
	 */
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

	/**
	 * Converts an array of hex string bytes into a Sui address. Each element of
	 * the array is a string representing a byte (e.g., `["255", "0", ...]`).
	 *
	 * @param bytes - An array of stringified bytes to convert.
	 * @returns A normalized Sui address.
	 */
	public static addressFromStringBytes = (bytes: string[]): SuiAddress =>
		this.addressFromBytes(this.bytesFromStringBytes(bytes));

	/**
	 * Converts an array of decimal-encoded string bytes (e.g., `["255", "0"]`)
	 * into a numeric `Byte[]` array.
	 *
	 * @param bytes - The string array representing decimal values.
	 * @returns A numeric array of bytes.
	 */
	public static bytesFromStringBytes = (bytes: string[]): Byte[] =>
		bytes.map((byte) => Number(byte));

	/**
	 * Unwraps a deserialized "Option" type from the BCS, returning its contents
	 * if present, or `undefined` if not.
	 *
	 * @param deserializedData - The BCS-deserialized structure that might contain `{ Some: value }` or `{ None: true }`.
	 * @returns The unwrapped data if present, or `undefined`.
	 */
	public static unwrapDeserializedOption = (
		deserializedData: any
	): any | undefined => {
		return "Some" in deserializedData ? deserializedData.Some : undefined;
	};

	/**
	 * Encodes a JavaScript string into a UTF-8 `Uint8Array`, suitable for
	 * on-chain usage or hashing.
	 *
	 * @param str - The string to encode.
	 * @returns An array of numeric bytes representing the UTF-8 encoded string.
	 */
	public static u8VectorFromString = (str: string) => {
		const textEncode = new TextEncoder();
		const encodedStr = textEncode.encode(str);

		const uint8s: number[] = [];
		for (const uint8 of encodedStr.values()) {
			uint8s.push(uint8);
		}
		return uint8s;
	};

	/**
	 * Normalizes a user-provided slippage tolerance from an integer percentage
	 * into a decimal fraction. E.g., `1 => 0.01`.
	 *
	 * @param slippageTolerance - The slippage in integer percent form (e.g., 1 for 1%).
	 * @returns A decimal fraction (e.g., 0.01).
	 */
	public static normalizeSlippageTolerance = (slippageTolerance: number) => {
		return slippageTolerance / 100;
	};

	/**
	 * Deserializes a `SuiObjectResponse`'s BCS bytes into an object of type `T` using
	 * a specified `bcsType`. Typically used for on-chain object decoding.
	 *
	 * @param inputs - The inputs including `suiObjectResponse`, `bcsType`, and a `fromDeserialized` transform function.
	 * @returns The transformed object of type `T` after BCS deserialization.
	 * @throws If no BCS bytes are found in the object.
	 */
	public static castObjectBcs = <T, U>(inputs: {
		suiObjectResponse: SuiObjectResponse;
		bcsType: BcsType<U>;
		fromDeserialized: (deserialized: U) => T;
	}): T => {
		const { suiObjectResponse, bcsType, fromDeserialized } = inputs;

		const deserialized = bcsType.fromBase64(
			this.bcsBytesFromSuiObjectResponse(suiObjectResponse)
		);

		return fromDeserialized(deserialized);
	};

	/**
	 * Extracts base64 BCS bytes from a `SuiObjectResponse` if present. Throws an error otherwise.
	 *
	 * @param suiObjectResponse - The Sui object response containing `bcsBytes`.
	 * @returns A base64 string representing the object's BCS data.
	 * @throws If the object response does not contain `bcsBytes`.
	 */
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

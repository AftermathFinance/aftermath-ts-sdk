import { type BcsType, bcs } from "@mysten/sui/bcs";
import type { SuiObjectResponse } from "@mysten/sui/jsonRpc";
import { Helpers } from "../..";
import { FarmsApiCasting } from "../../packages/farms/api/farmsApiCasting";
import { FaucetApiCasting } from "../../packages/faucet/api/faucetApiCasting";
import { NftAmmApiCasting } from "../../packages/nftAmm/api/nftAmmApiCasting";
import { PerpetualsApiCasting } from "../../packages/perpetuals/api/perpetualsApiCasting";
import { PoolsApiCasting } from "../../packages/pools/api/poolsApiCasting";
import { RouterApiCasting } from "../../packages/router/api/routerApiCasting";
import { StakingApiCasting } from "../../packages/staking/api/stakingApiCasting";
import { SuiFrensApiCasting } from "../../packages/suiFrens/api/suiFrensApiCasting";
import { NftsApiCasting } from "../nfts/nftsApiCasting";
import type { Byte, Percentage, SuiAddress } from "../types";
import { FixedUtils } from "./fixedUtils";
import { IFixedUtils } from "./iFixedUtils";

/**
 * Provides local casting and conversion routines shared by the Aftermath
 * modules.
 *
 * The class does not perform network I/O. Its methods convert numbers, bytes,
 * addresses, and BCS object responses, while its module properties expose the
 * package-specific caster namespaces.
 */
export class Casting {
	// =========================================================================
	//  Api Casting
	// =========================================================================

	/**
	 * The pools package's casting namespace for pool, coin, and pool-event shapes.
	 */
	public static pools = PoolsApiCasting;
	/**
	 * The SuiFrens package's casting namespace for SuiFren objects and events.
	 */
	public static suiFrens = SuiFrensApiCasting;
	/**
	 * The faucet package's casting namespace for faucet objects and events.
	 */
	public static faucet = FaucetApiCasting;
	/**
	 * The staking package's casting namespace for staking objects and events.
	 */
	public static staking = StakingApiCasting;

	/**
	 * The NFT AMM package's casting namespace for NFT pool objects and events.
	 */
	public static nftAmm = NftAmmApiCasting;
	/**
	 * The router package's casting namespace for routes and trade data.
	 */
	public static router = RouterApiCasting;
	/**
	 * The perpetuals package's casting namespace for market and position data.
	 */
	public static perpetuals = PerpetualsApiCasting;
	/**
	 * The farms package's casting namespace for farm objects and events.
	 */
	public static farms = FarmsApiCasting;
	/**
	 * The NFT package's casting namespace for NFT object and display data.
	 */
	public static nfts = NftsApiCasting;

	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * The standard 18-decimal fixed-point utility class.
	 */
	public static Fixed = FixedUtils;
	/**
	 * The signed 18-decimal IFixed utility class.
	 */
	public static IFixed = IFixedUtils;

	/**
	 * The maximum value of an unsigned 64-bit integer, `18446744073709551615n`.
	 */
	public static u64MaxBigInt: bigint = BigInt("0xFFFFFFFFFFFFFFFF");

	/**
	 * The maximum value of a signed 64-bit integer, `9223372036854775807n`.
	 */
	public static i64MaxBigInt: bigint = BigInt("9223372036854775807");

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Fixed / IFixed
	// =========================================================================

	/**
	 * Converts a JavaScript number to an 18-decimal fixed-point bigint.
	 *
	 * The method multiplies by `1e18`, applies `Math.floor`, and converts the
	 * result to `bigint`. Flooring also applies to negative values, so negative
	 * fractional scaled values round toward negative infinity. The conversion
	 * inherits JavaScript number precision.
	 *
	 * @param a - The number to encode. Its scaled value must be finite; the result
	 * is floored before conversion to `bigint`.
	 * @returns The 18-decimal fixed-point representation as a `bigint`.
	 * @throws `RangeError` when `a` is `NaN`, infinite, or produces an invalid
	 * bigint conversion.
	 */
	public static numberToFixedBigInt = (a: number): bigint =>
		BigInt(Math.floor(a * this.Fixed.fixedOneN));

	/**
	 * Converts an 18-decimal fixed-point bigint to a JavaScript number.
	 *
	 * The method divides by `1e18`. Large values can lose integer or fractional
	 * precision when they pass through `Number`.
	 *
	 * @param a - The 18-decimal fixed-point value.
	 * @returns The unscaled value as a JavaScript `number`.
	 */
	public static bigIntToFixedNumber = (a: bigint): number =>
		Number(a) / this.Fixed.fixedOneN;

	/**
	 * Multiplies a bigint by a JavaScript number and returns a bigint.
	 *
	 * The method first converts the bigint to `number`, multiplies by `scalar`,
	 * applies `Math.floor`, and converts the result to `bigint`. Large bigint
	 * inputs can lose precision during the `Number` conversion.
	 *
	 * @param scalar - The numeric multiplier.
	 * @param int - The bigint to multiply.
	 * @returns The floored product as a `bigint`.
	 * @throws `RangeError` when the scaled number is not finite or cannot convert
	 * to a `bigint`.
	 */
	public static scaleNumberByBigInt = (scalar: number, int: bigint): bigint =>
		BigInt(Math.floor(scalar * Number(int)));

	// =========================================================================
	//  Percentage <-> Bps
	// =========================================================================

	/**
	 * Converts a decimal fraction to basis points.
	 *
	 * One basis point is `0.0001`, so `0.05` becomes `500n` and `1` becomes
	 * `10000n`. The method rounds the product to the nearest integer basis point.
	 *
	 * @param percentage - The unscaled percentage fraction, where `0.05` means 5%.
	 * @returns The rounded basis-point count as a `bigint`.
	 */
	public static percentageToBps(percentage: Percentage): bigint {
		// Convert decimal percentage to basis points
		const bps = percentage * 10_000;
		// Convert basis points to bigint
		return BigInt(Math.round(bps));
	}

	/**
	 * Converts basis points to an unscaled percentage fraction.
	 *
	 * The method divides by `10000` after converting the bigint to `number`, so
	 * very large basis-point values can lose precision.
	 *
	 * @param bps - The basis-point count, where `500n` means 5%.
	 * @returns The unscaled percentage fraction.
	 */
	public static bpsToPercentage(bps: bigint): Percentage {
		// Convert bigint basis points to number
		const bpsNumber = Number(bps);
		// Convert basis points to decimal percentage
		const percentage = bpsNumber / 10_000;
		return percentage;
	}

	// =========================================================================
	//  Bytes / BCS
	// =========================================================================

	/**
	 * Converts each byte to a JavaScript character code and joins the characters.
	 *
	 * This is a character-code conversion, not UTF-8 decoding. The input array is
	 * not mutated.
	 *
	 * @param bytes - The byte values to convert.
	 * @returns The resulting string.
	 */
	public static stringFromBytes = (bytes: Byte[]) =>
		String.fromCharCode.apply(null, bytes as any);

	/**
	 * Converts little-endian byte values to a bigint.
	 *
	 * For example, `[0x01, 0x02]` becomes `0x0201`, or `513n`. The method calls
	 * `reverse()` on `bytes`, so it reverses the caller's array in place. It does
	 * not interpret a sign bit.
	 *
	 * @param bytes - The little-endian byte values.
	 * @returns The resulting unsigned bigint.
	 * @throws `SyntaxError` or `RangeError` when the byte array cannot form a
	 * valid bigint, including an empty array.
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
	 * Decodes a 32-byte BCS address into a zero-padded Sui address string.
	 *
	 * @param bytes - The BCS address bytes in their on-chain order.
	 * @returns A `0x`-prefixed address with 64 hexadecimal digits.
	 * @throws When the BCS address bytes are malformed or are not 32 bytes long.
	 */
	public static addressFromBcsBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(bcs.Address.parse(new Uint8Array(bytes)));

	/**
	 * Converts byte values directly to a zero-padded Sui address string.
	 *
	 * Each byte is rendered as two hexadecimal digits, concatenated after `0x`,
	 * and then left-padded to 64 hexadecimal digits. This method does not validate
	 * that the input contains exactly 32 values.
	 *
	 * @param bytes - The raw address byte values.
	 * @returns A `0x`-prefixed address with 64 hexadecimal digits when the input
	 * fits within 32 bytes.
	 * @throws When the rendered address is longer than 64 hexadecimal digits.
	 */
	public static addressFromBytes = (bytes: Byte[]): SuiAddress =>
		Helpers.addLeadingZeroesToType(
			"0x" +
				bytes
					.map((byte) => {
						const hex = byte.toString(16);
						return hex.length === 1 ? `0${hex}` : hex;
					})
					.join("")
		);

	/**
	 * Converts decimal byte strings to a zero-padded Sui address.
	 *
	 * Each string is passed to `Number` without a separate range check, then the
	 * resulting values are handled by `addressFromBytes`.
	 *
	 * @param bytes - Decimal strings such as `"255"` and `"0"`.
	 * @returns The string rendered by `addressFromBytes`; the helper does not
	 * validate that the result is hexadecimal or contains exactly 32 bytes.
	 * @throws When the rendered address is longer than 64 hexadecimal digits.
	 */
	public static addressFromStringBytes = (bytes: string[]): SuiAddress =>
		this.addressFromBytes(this.bytesFromStringBytes(bytes));

	/**
	 * Converts decimal byte strings to JavaScript numbers.
	 *
	 * The method calls `Number` for each string and does not validate the 0-255
	 * byte range, so a non-numeric string produces `NaN`.
	 *
	 * @param bytes - The decimal strings to convert.
	 * @returns A new numeric array with one value for each input string.
	 */
	public static bytesFromStringBytes = (bytes: string[]): Byte[] =>
		bytes.map((byte) => Number(byte));

	/**
	 * Returns the value of a deserialized BCS `Option`'s `Some` property.
	 *
	 * Any object without a `Some` property, including a `{ None: ... }` value,
	 * returns `undefined`. Falsy `Some` values, including `0`, `false`, `""`, and
	 * `null`, are returned unchanged.
	 *
	 * @param deserializedData - The object produced by BCS deserialization.
	 * @returns The `Some` value, or `undefined` when the property is absent.
	 * @throws `TypeError` when `deserializedData` is `null`, `undefined`, or a
	 * primitive value that cannot be used with the `in` operator.
	 */
	public static unwrapDeserializedOption = (
		deserializedData: any
	): any | undefined => {
		return "Some" in deserializedData ? deserializedData.Some : undefined;
	};

	/**
	 * Encodes a JavaScript string as UTF-8 byte values.
	 *
	 * @param str - The string to encode.
	 * @returns A new `number[]` containing the UTF-8 bytes.
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
	 * Converts an unscaled integer-percent slippage value to a fraction.
	 *
	 * The method divides by `100` without validation, so `1` becomes `0.01` and
	 * `0.5` becomes `0.005`.
	 *
	 * @param slippageTolerance - The percent value to divide by `100`.
	 * @returns The unscaled slippage fraction.
	 */
	public static normalizeSlippageTolerance = (slippageTolerance: number) => {
		return slippageTolerance / 100;
	};

	/**
	 * Deserializes a `SuiObjectResponse`'s base64 BCS bytes and maps the result.
	 *
	 * The method extracts `data.bcs.bcsBytes`, calls `bcsType.fromBase64`, and
	 * passes the decoded value to `fromDeserialized`. It performs no network I/O
	 * and does not mutate the response.
	 *
	 * @param inputs - The response, BCS schema, and decoded-value mapper.
	 * @returns The mapped value.
	 * @throws `Error` when the response has no BCS bytes. BCS decoding and mapper
	 * errors are propagated unchanged.
	 */
	public static castObjectBcs = <T, U>(inputs: {
		/** The object response containing `data.bcs.bcsBytes`. */
		suiObjectResponse: SuiObjectResponse;
		/** The BCS schema for the serialized object. */
		bcsType: BcsType<U>;
		/** Converts the decoded BCS value to the requested result. */
		fromDeserialized: (deserialized: U) => T;
	}): T => {
		const { suiObjectResponse, bcsType, fromDeserialized } = inputs;

		const deserialized = bcsType.fromBase64(
			this.bcsBytesFromSuiObjectResponse(suiObjectResponse)
		);

		return fromDeserialized(deserialized);
	};

	/**
	 * Extracts base64 BCS bytes from a Sui object response.
	 *
	 * @param suiObjectResponse - The response whose `data.bcs` field to inspect.
	 * @returns The `data.bcs.bcsBytes` base64 string.
	 * @throws `Error` when `data.bcs` is absent or does not contain `bcsBytes`.
	 */
	public static bcsBytesFromSuiObjectResponse(
		suiObjectResponse: SuiObjectResponse
	): string {
		const rawData = suiObjectResponse.data?.bcs;
		if (rawData && "bcsBytes" in rawData) {
			return rawData.bcsBytes;
		}
		throw new Error(
			`no bcs bytes found on object: ${suiObjectResponse.data?.objectId}`
		);
	}
}

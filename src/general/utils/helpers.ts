import {
	DisplayFieldsResponse,
	SuiMoveObject,
	SuiObjectResponse,
} from "@mysten/sui/client";
import {
	AnyObjectType,
	Balance,
	SuiNetwork,
	CoinsToDecimals,
	CoinsToPrice,
	ObjectId,
	Slippage,
	ModuleName,
	PackageId,
	MoveErrorCode,
	SuiAddress,
	CoinType,
	CoinGeckoChain,
} from "../../types";
import { DynamicFieldsApiHelpers } from "../apiHelpers/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../apiHelpers/eventsApiHelpers";
import { InspectionsApiHelpers } from "../apiHelpers/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../apiHelpers/objectsApiHelpers";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers";
import { Casting } from "./casting";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { MoveErrors } from "../types/moveErrorsInterface";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { decodeSuiPrivateKey, Keypair } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";

/**
 * A utility class containing various helper functions for general use across
 * the Aftermath TS ecosystem. This includes numeric operations, object field
 * extraction, array transformations, slippage adjustments, and Move error parsing.
 */
export class Helpers {
	// =========================================================================
	//  Api Helpers (Static References)
	// =========================================================================

	/**
	 * Static reference to the `DynamicFieldsApiHelpers`, providing utility methods
	 * for working with dynamic fields in Sui objects.
	 */
	public static readonly dynamicFields = DynamicFieldsApiHelpers;

	/**
	 * Static reference to the `EventsApiHelpers`, providing methods for
	 * querying and filtering Sui events.
	 */
	public static readonly events = EventsApiHelpers;

	/**
	 * Static reference to the `InspectionsApiHelpers`, used for reading
	 * Summaries or inspection data from objects.
	 */
	public static readonly inspections = InspectionsApiHelpers;

	/**
	 * Static reference to the `ObjectsApiHelpers`, providing direct
	 * retrieval or manipulation of on-chain Sui objects.
	 */
	public static readonly objects = ObjectsApiHelpers;

	/**
	 * Static reference to the `TransactionsApiHelpers`, enabling easier
	 * queries for transaction data by digest or other criteria.
	 */
	public static readonly transactions = TransactionsApiHelpers;

	// =========================================================================
	//  Type Manipulation
	// =========================================================================

	/**
	 * Removes all leading zeroes (after the '0x') from a string that represents
	 * a Sui address or object type. For instance, "0x0000123" => "0x123".
	 *
	 * @param type - The hex string to process, potentially including "::" module syntax.
	 * @returns The same string with unnecessary leading zeroes stripped out.
	 */
	public static stripLeadingZeroesFromType = (
		type: AnyObjectType
	): AnyObjectType => type.replaceAll(/x0+/g, "x");

	/**
	 * Ensures the given Sui address or object type is zero-padded to 64 hex digits
	 * after the "0x". If a "::" suffix is present, only the address portion is padded.
	 *
	 * @param type - The "0x..." string or extended type (0x..::module).
	 * @returns A new string normalized to a 64-hex-digit address or object ID.
	 * @throws If the address portion is already longer than 64 hex digits.
	 */
	public static addLeadingZeroesToType = (
		type: AnyObjectType
	): AnyObjectType => {
		const EXPECTED_TYPE_LENGTH = 64;

		let strippedType = type.replace("0x", "");
		let typeSuffix = "";

		if (strippedType.includes("::")) {
			const splitType = strippedType.replace("0x", "").split("::");
			typeSuffix = splitType
				.slice(1)
				.reduce((acc, str) => acc + "::" + str, "");
			strippedType = splitType[0];
		}

		const typeLength = strippedType.length;
		if (typeLength > EXPECTED_TYPE_LENGTH)
			throw new Error("invalid type length");

		const zerosNeeded = EXPECTED_TYPE_LENGTH - typeLength;
		const zeroString = Array(zerosNeeded).fill("0").join("");

		const newType = "0x" + zeroString + strippedType;
		return newType + typeSuffix;
	};

	/**
	 * Splits a non-SUI coin type string that may be prefixed by a chain ID for external usage,
	 * returning the chain and the coin type. If no chain is recognized, defaults to `"sui"`.
	 *
	 * @param coin - The coin string, which may look like `"bsc:0x<...>"` or just `"0x<...>"`.
	 * @returns An object with the `chain` (e.g. "bsc") and the `coinType`.
	 */
	public static splitNonSuiCoinType = (
		coin: CoinType
	): {
		chain: CoinGeckoChain;
		coinType: CoinType;
	} => {
		const [uncastChain, coinType] = coin.split(":");
		if (!uncastChain || !coinType) return { coinType: coin, chain: "sui" };
		const chain = uncastChain as Exclude<CoinGeckoChain, "sui">;
		return { chain, coinType };
	};

	// =========================================================================
	//  Numbers
	// =========================================================================

	/**
	 * Checks if a given string represents a valid number (integer or decimal).
	 *
	 * @param str - The string to test.
	 * @returns `true` if it's a valid numeric string, otherwise `false`.
	 */
	public static isNumber = (str: string): boolean => /^\d*\.?\d*$/g.test(str);

	/**
	 * Sums an array of floating-point numbers, returning the numeric total.
	 *
	 * @param arr - The array of numbers to sum.
	 * @returns The total as a float.
	 */
	public static sum = (arr: number[]) =>
		arr.reduce((prev, cur) => prev + cur, 0);

	/**
	 * Sums an array of bigints, returning the total as a bigint.
	 *
	 * @param arr - The array of bigints to sum.
	 * @returns The resulting total as a bigint.
	 */
	public static sumBigInt = (arr: bigint[]) =>
		arr.reduce((prev, cur) => prev + cur, BigInt(0));

	/**
	 * Determines if two numbers are close within a given tolerance factor,
	 * i.e., `|a - b| <= tolerance * max(a, b)`.
	 *
	 * @param a - The first number.
	 * @param b - The second number.
	 * @param tolerance - A fraction representing the max allowed difference relative to max(a, b).
	 * @returns `true` if within tolerance, otherwise `false`.
	 */
	public static closeEnough = (a: number, b: number, tolerance: number) =>
		Math.abs(a - b) <= tolerance * Math.max(a, b);

	/**
	 * Determines if two bigints are close within a given tolerance factor,
	 * by casting them to numbers internally.
	 *
	 * @param a - First bigint.
	 * @param b - Second bigint.
	 * @param tolerance - A fraction representing the max allowed difference relative to max(a, b).
	 * @returns `true` if within tolerance, otherwise `false`.
	 */
	public static closeEnoughBigInt = (
		a: bigint,
		b: bigint,
		tolerance: number
	) => Helpers.closeEnough(Number(a), Number(b), tolerance);

	/**
	 * Checks whether the integer divisions of `a` and `b` (by `fixedOne`) differ
	 * by at most 1. Typically used in fixed math scenarios to see if two scaled
	 * values are "very close."
	 *
	 * @param a - First number (scaled).
	 * @param b - Second number (scaled).
	 * @param fixedOne - The scaling factor representing 1.0 in the same scale as `a` and `b`.
	 * @returns `true` if the integer parts differ by <= 1, otherwise `false`.
	 */
	public static veryCloseInt = (a: number, b: number, fixedOne: number) =>
		Math.abs(Math.floor(a / fixedOne) - Math.floor(b / fixedOne)) <= 1;

	/**
	 * A small object containing "blended" math operations that handle
	 * mixed numeric types (number vs. bigint). This is primarily for
	 * internal usage in advanced math scenarios.
	 */
	public static blendedOperations = {
		/**
		 * Multiply two floating-point numbers.
		 */
		mulNNN: (a: number, b: number): number => a * b,
		/**
		 * Multiply a float and a bigint, returning a bigint (floor).
		 */
		mulNNB: (a: number, b: number): bigint => BigInt(Math.floor(a * b)),
		/**
		 * Multiply a float and a bigint, returning a float.
		 */
		mulNBN: (a: number, b: bigint): number => a * Number(b),
		/**
		 * Multiply a float and a bigint, returning a bigint (floor).
		 */
		mulNBB: (a: number, b: bigint): bigint =>
			BigInt(Math.floor(a * Number(b))),
		/**
		 * Multiply two bigints, returning a float.
		 */
		mulBBN: (a: bigint, b: bigint): number => Number(a * b),
		/**
		 * Multiply two bigints, returning a bigint.
		 */
		mulBBB: (a: bigint, b: bigint): bigint => a * b,
	};

	/**
	 * Returns the maximum of multiple bigints.
	 *
	 * @param args - The bigints to compare.
	 * @returns The largest bigint.
	 */
	public static maxBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e > m ? e : m));

	/**
	 * Returns the minimum of multiple bigints.
	 *
	 * @param args - The bigints to compare.
	 * @returns The smallest bigint.
	 */
	public static minBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e < m ? e : m));

	/**
	 * Returns the absolute value of a bigint.
	 *
	 * @param num - The input bigint.
	 * @returns A bigint representing the absolute value of `num`.
	 */
	public static absBigInt = (num: bigint) => (num < BigInt(0) ? -num : num);

	// =========================================================================
	//  Display
	// =========================================================================

	/**
	 * Capitalizes only the first letter of a string, making the rest lowercase.
	 * E.g., "HELLO" => "Hello".
	 *
	 * @param str - The input string to transform.
	 * @returns The resulting string with the first character in uppercase and the rest in lowercase.
	 */
	public static capitalizeOnlyFirstLetter = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

	// =========================================================================
	//  JSON
	// =========================================================================

	/**
	 * Parses a JSON string containing potential BigInt values.
	 * By default, it only converts strings ending in 'n' (like `"123n"`) to BigInts.
	 *
	 * @param json - The JSON string to parse.
	 * @param unsafeStringNumberConversion - If `true`, all numeric strings (e.g., "123") will also become BigInts.
	 * @returns The parsed JSON object with BigInt conversions where applicable.
	 */
	public static parseJsonWithBigint = (
		json: string,
		unsafeStringNumberConversion = false
	) =>
		JSON.parse(json, (key, value) => {
			// handles bigint casting
			if (typeof value === "string" && /^-?\d+n$/.test(value)) {
				return BigInt(value.slice(0, -1));
			}

			if (
				unsafeStringNumberConversion &&
				typeof value === "string" &&
				this.isNumber(value)
			) {
				return BigInt(value);
			}
			return value;
		});

	// =========================================================================
	//  General
	// =========================================================================

	/**
	 * Creates a deep copy of the given target, handling nested arrays and objects.
	 * Dates are cloned by their timestamp.
	 *
	 * @param target - The data to clone deeply.
	 * @returns A new object/array/date structure mirroring `target`.
	 */
	public static deepCopy = <T>(target: T): T => {
		if (target === null) {
			return target;
		}
		if (target instanceof Date) {
			return new Date(target.getTime()) as any;
		}
		if (Array.isArray(target)) {
			const cp = [] as any[];
			(target as any[]).forEach((v) => {
				cp.push(v);
			});
			return cp.map((n: any) => this.deepCopy<any>(n)) as any;
		}
		if (typeof target === "object") {
			const cp = { ...(target as { [key: string]: any }) } as {
				[key: string]: any;
			};
			Object.keys(cp).forEach((k) => {
				cp[k] = this.deepCopy<any>(cp[k]);
			});
			return cp as T;
		}
		return target;
	};

	/**
	 * Finds the index of the maximum value in an array. Returns -1 if the array is empty.
	 *
	 * @param arr - The input array.
	 * @returns The index of the maximum value, or -1 if the array is empty.
	 */
	public static indexOfMax = (arr: any[]) => {
		if (arr.length === 0) return -1;

		let max = arr[0];
		let maxIndex = 0;

		for (let i = 1; i < arr.length; i++) {
			if (arr[i] > max) {
				maxIndex = i;
				max = arr[i];
			}
		}

		return maxIndex;
	};

	private static uniqueObjectArray<T>(arr: T[]): T[] {
		const seen = new Set<string>();
		return arr.filter((obj) => {
			const str = JSON.stringify(obj);
			if (seen.has(str)) {
				return false;
			}
			seen.add(str);
			return true;
		});
	}

	/**
	 * Returns a new array with unique elements from the input array,
	 * preserving the order of first occurrences.
	 *
	 * @param arr - The original array.
	 * @returns An array of unique items.
	 */
	public static uniqueArray = <T>(arr: T[]): T[] =>
		arr.length <= 0
			? []
			: typeof arr[0] === "object"
			? Helpers.uniqueObjectArray(arr)
			: [...new Set(arr)];

	/**
	 * Returns a Promise that resolves after a specified number of milliseconds.
	 *
	 * @param ms - The delay time in milliseconds.
	 * @returns A promise that resolves after `ms` milliseconds.
	 */
	public static sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	/**
	 * Creates a unique ID-like string by combining the current timestamp and random base36 digits.
	 *
	 * @returns A short random string (base36) that can serve as a unique identifier.
	 */
	public static createUid = () =>
		Date.now().toString(36) + Math.random().toString(36).substring(2);

	/**
	 * Splits an array into two groups: those for which `func` returns `true` (or truthy),
	 * and those for which it returns `false`. The result is returned as a tuple `[trues, falses]`.
	 *
	 * @param array - The array to filter.
	 * @param func - The function used to test each element.
	 * @returns A tuple containing two arrays: `[elements that pass, elements that fail]`.
	 */
	public static bifilter = <ArrayType>(
		array: ArrayType[],
		func: (item: ArrayType, index: number, arr: ArrayType[]) => boolean
	): [trues: ArrayType[], falses: ArrayType[]] => {
		return array.reduce(
			([T, F], x, i, arr) => {
				if (func(x, i, arr) === false) return [T, [...F, x]];
				else return [[...T, x], F];
			},
			[[], []] as [ArrayType[], ArrayType[]]
		);
	};

	/**
	 * An async version of `bifilter`, returning a tuple of `[trues, falses]`.
	 * Each element is tested asynchronously in parallel via `func`.
	 *
	 * @param array - The array to filter.
	 * @param func - An async function returning `true` or `false`.
	 * @returns A tuple `[trues, falses]` after asynchronous evaluation.
	 */
	public static bifilterAsync = async <ArrayType>(
		array: ArrayType[],
		func: (
			item: ArrayType,
			index: number,
			arr: ArrayType[]
		) => Promise<boolean>
	): Promise<[trues: ArrayType[], falses: ArrayType[]]> => {
		const predicates = await Promise.all(array.map(func));
		return this.bifilter(array, (_, index) => predicates[index]);
	};

	/**
	 * Filters the entries of an object based on a predicate function,
	 * returning a new object with only those entries for which `predicate`
	 * returns `true`.
	 *
	 * @param obj - The original object to filter.
	 * @param predicate - A function taking `(key, value)` and returning a boolean.
	 * @returns A new object with only the entries that pass the predicate.
	 */
	public static filterObject = <Value>(
		obj: Record<string, Value>,
		predicate: (key: string, value: Value) => boolean
	): Record<string, Value> =>
		Object.keys(obj).reduce((acc, key) => {
			const val = obj[key];
			if (!predicate(key, val)) return acc;
			return {
				...acc,
				[key]: val,
			};
		}, {} as Record<string, Value>);

	/**
	 * Applies downward slippage to a bigint amount by subtracting `slippage * amount`.
	 * For instance, for 1% slippage, we reduce the amount by 1%.
	 *
	 * @param amount - The original bigint amount.
	 * @param slippage - An integer percent (e.g., 1 => 1%).
	 * @returns The adjusted bigint after subtracting the slippage portion.
	 */
	public static applySlippageBigInt = (
		amount: Balance,
		slippage: Slippage
	) => {
		return (
			amount -
			BigInt(
				Math.floor(
					Casting.normalizeSlippageTolerance(slippage) *
						Number(amount)
				)
			)
		);
	};

	/**
	 * Applies downward slippage to a floating-point amount. E.g., for 1% slippage,
	 * reduce by 1% of `amount`.
	 *
	 * @param amount - The original float value.
	 * @param slippage - An integer percent (e.g., 1 => 1%).
	 * @returns The float after applying slippage.
	 */
	public static applySlippage = (amount: number, slippage: Slippage) => {
		return amount - Casting.normalizeSlippageTolerance(slippage) * amount;
	};

	/**
	 * Combines two arrays into a single array of pairs. The result length is the
	 * minimum of the two input arrays' lengths.
	 *
	 * @param firstCollection - The first array.
	 * @param lastCollection - The second array.
	 * @returns An array of `[firstCollection[i], lastCollection[i]]` pairs.
	 */
	public static zip<S1, S2>(
		firstCollection: Array<S1>,
		lastCollection: Array<S2>
	): Array<[S1, S2]> {
		const length = Math.min(firstCollection.length, lastCollection.length);
		const zipped: Array<[S1, S2]> = [];
		for (let index = 0; index < length; index++) {
			zipped.push([firstCollection[index], lastCollection[index]]);
		}
		return zipped;
	}

	/**
	 * Removes circular references from an object or array, returning a JSON-safe structure.
	 * Any cyclic references are replaced with `undefined`.
	 *
	 * @param obj - The object or array to remove circular references from.
	 * @param seen - Internal usage to track references that have already been visited.
	 * @returns A structure that can be safely JSON-stringified.
	 */
	public static removeCircularReferences<T>(
		obj: T,
		seen: WeakSet<object> = new WeakSet()
	): T | undefined {
		type AnyObject = { [key: string]: any };

		if (obj && typeof obj === "object") {
			if (seen.has(obj as object)) {
				return undefined;
			}
			seen.add(obj as object);

			if (Array.isArray(obj)) {
				return obj.map((item) =>
					this.removeCircularReferences(item, seen)
				) as unknown as T;
			} else {
				const entries = Object.entries(obj as AnyObject).map(
					([key, value]) => [
						key,
						this.removeCircularReferences(value, seen),
					]
				);
				return Object.fromEntries(entries) as unknown as T;
			}
		}
		return obj;
	}

	// =========================================================================
	//  Type Checking
	// =========================================================================

	/**
	 * Checks if an unknown value is an array of strings.
	 *
	 * @param value - The value to check.
	 * @returns `true` if `value` is a string array, otherwise `false`.
	 */
	public static isArrayOfStrings(value: unknown): value is string[] {
		return (
			Array.isArray(value) &&
			value.every((item) => typeof item === "string")
		);
	}

	/**
	 * Roughly checks if a string is a valid Sui type (e.g., "0x2::sui::SUI").
	 * This is not guaranteed to be perfect, but covers common cases.
	 *
	 * @param str - The string to validate.
	 * @returns `true` if it meets the minimum structure, otherwise `false`.
	 */
	public static isValidType = (str: string): boolean => {
		// TODO: use regex
		const trimmedStr = str.trim();
		return (
			trimmedStr.startsWith("0x") &&
			trimmedStr.length >= 9 &&
			trimmedStr.indexOf("::") >= 3 &&
			trimmedStr.lastIndexOf("::") >= 6 &&
			!trimmedStr.endsWith(":")
		);
	};

	/**
	 * Checks if a string is a valid hex representation, optionally prefixed with "0x".
	 *
	 * @param hexString - The string to check.
	 * @returns `true` if `hexString` is a valid hex, otherwise `false`.
	 */
	public static isValidHex = (hexString: string): boolean => {
		const hexPattern = /^(0x)?[0-9A-F]+$/i;
		return hexPattern.test(hexString);
	};

	// =========================================================================
	//  Sui Object Parsing
	// =========================================================================

	/**
	 * Extracts the fully qualified type (e.g., "0x2::coin::Coin<...>") from a `SuiObjectResponse`,
	 * normalizing it with leading zeroes if necessary.
	 *
	 * @param data - The object response from Sui.
	 * @returns The normalized object type string.
	 * @throws If the type is not found.
	 */
	public static getObjectType(data: SuiObjectResponse): ObjectId {
		const objectType = data.data?.type;
		if (objectType) return Helpers.addLeadingZeroesToType(objectType);

		throw new Error("no object type found on " + data.data?.objectId);
	}

	/**
	 * Extracts the object ID from a `SuiObjectResponse`, normalizing it with leading zeroes.
	 *
	 * @param data - The object response from Sui.
	 * @returns A zero-padded `ObjectId`.
	 * @throws If the objectId is not found.
	 */
	public static getObjectId(data: SuiObjectResponse): ObjectId {
		const objectId = data.data?.objectId;
		if (objectId) return Helpers.addLeadingZeroesToType(objectId);

		throw new Error("no object id found on " + data.data?.type);
	}

	/**
	 * Retrieves the fields of a Move object from a `SuiObjectResponse`.
	 *
	 * @param data - The Sui object response containing a Move object.
	 * @returns A record of fields for that object.
	 * @throws If no fields are found.
	 */
	public static getObjectFields(
		data: SuiObjectResponse
	): Record<string, any> {
		try {
			const content = data.data?.content as SuiMoveObject;
			return content.fields;
		} catch (e) {
			throw new Error("no object fields found on " + data.data?.objectId);
		}
	}

	/**
	 * Retrieves display metadata from a Sui object response, if present.
	 *
	 * @param data - The Sui object response.
	 * @returns The display fields for that object.
	 * @throws If display fields are not found.
	 */
	public static getObjectDisplay(
		data: SuiObjectResponse
	): DisplayFieldsResponse {
		const display = data.data?.display;
		if (display) return display;
		throw new Error("no object display found on " + data.data?.objectId);
	}

	// =========================================================================
	//  Tx Command Input Construction
	// =========================================================================

	/**
	 * Utility for building transaction commands with either a string-based
	 * `ObjectId` or an existing transaction object argument. If it's a string,
	 * it's converted via `tx.object(...)`; if already a `TransactionObjectArgument`,
	 * it's returned as-is.
	 *
	 * @param tx - The current `Transaction` block to add the object to.
	 * @param object - Either an `ObjectId` or a `TransactionObjectArgument`.
	 * @returns A `TransactionObjectArgument` referencing the provided object.
	 */
	public static addTxObject = (
		tx: Transaction,
		object: ObjectId | TransactionObjectArgument
	): TransactionObjectArgument => {
		return typeof object === "string" ? tx.object(object) : object;
	};

	// =========================================================================
	//  Sui Address / Key Checking
	// =========================================================================

	/**
	 * Checks if a given string is a valid Sui address by normalizing it to a
	 * 64-hex-digit form and calling `isValidSuiAddress`.
	 *
	 * @param address - The Sui address to validate.
	 * @returns `true` if valid, `false` otherwise.
	 */
	public static isValidSuiAddress = (address: SuiAddress) =>
		isValidSuiAddress(
			(() => {
				if (!address.startsWith("0x") || address.length < 3) return "";
				try {
					return Helpers.addLeadingZeroesToType(address);
				} catch (e) {
					return "";
				}
			})()
		);

	// =========================================================================
	//  Error Parsing
	// =========================================================================

	/**
	 * Parses a MoveAbort error message from Sui into a possible `(errorCode, packageId, module)`,
	 * if the message follows a known pattern. Otherwise returns undefined.
	 *
	 * @param inputs - The object containing the raw `errorMessage` from Sui.
	 * @returns A partial structure of the error details or undefined.
	 */
	public static parseMoveErrorMessage(inputs: { errorMessage: string }):
		| {
				errorCode: MoveErrorCode;
				packageId: ObjectId;
				module: ModuleName;
		  }
		| undefined {
		const { errorMessage } = inputs;
		if (!errorMessage.toLowerCase().includes("moveabort")) return undefined;

		/*
			MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2

			MoveAbort(MoveLocation { module: ModuleId { address: 7c995f9c0c0553c0f3bfac7cf3c8b85716f0ca522305586bd0168ca20aeed277, name: Identifier("clearing_house") }, function: 37, instruction: 17, function_name: Some("place_limit_order") }, 1) in command 1
		*/

		const moveErrorCode = (inputs: {
			errorMessage: string;
		}): MoveErrorCode | undefined => {
			const { errorMessage } = inputs;
			const startIndex = errorMessage.lastIndexOf(",");
			const endIndex = errorMessage.lastIndexOf(")");
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex)
				return undefined;

			try {
				const errorCode = parseInt(
					errorMessage.slice(startIndex + 1, endIndex)
				);
				if (Number.isNaN(errorCode)) return undefined;
				return errorCode;
			} catch {
				return undefined;
			}
		};

		const moveErrorPackageId = (inputs: {
			errorMessage: string;
		}): PackageId | undefined => {
			const { errorMessage } = inputs;

			const startIndex = errorMessage.toLowerCase().indexOf("address:");
			const endIndex = errorMessage.indexOf(", name:");
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex)
				return undefined;

			try {
				const pkgStr = errorMessage
					.slice(startIndex + 8, endIndex)
					.trim()
					.replaceAll("0x", "");
				const packageId = Helpers.addLeadingZeroesToType("0x" + pkgStr);
				if (!this.isValidHex(packageId)) return undefined;
				return packageId;
			} catch {
				return undefined;
			}
		};

		const moveErrorModule = (inputs: {
			errorMessage: string;
		}): ModuleName | undefined => {
			const { errorMessage } = inputs;

			const startIndex = errorMessage
				.toLowerCase()
				.indexOf('identifier("');
			const endIndex = errorMessage.indexOf('")');
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex)
				return undefined;

			try {
				return errorMessage.slice(startIndex + 12, endIndex).trim();
			} catch {
				return undefined;
			}
		};

		const errorCode = moveErrorCode({ errorMessage });
		const packageId = moveErrorPackageId({ errorMessage });
		const module = moveErrorModule({ errorMessage });
		if (errorCode === undefined || !packageId || !module) return undefined;

		return { errorCode, packageId, module };
	}

	/**
	 * Translates a Move abort error message into a known error string if it matches
	 * entries in a given `moveErrors` table. This is used to map on-chain error codes
	 * to user-friendly messages.
	 *
	 * @param inputs - Includes the raw `errorMessage` and a `moveErrors` object keyed by package, module, and code.
	 * @returns A structure with `errorCode`, `packageId`, `module`, and a human-readable `error` string, or `undefined`.
	 */
	public static translateMoveErrorMessage(inputs: {
		errorMessage: string;
		moveErrors: MoveErrors;
	}):
		| {
				errorCode: MoveErrorCode;
				packageId: ObjectId;
				module: ModuleName;
				error: string;
		  }
		| undefined {
		const { errorMessage, moveErrors } = inputs;

		const parsed = this.parseMoveErrorMessage({ errorMessage });
		if (!parsed || !(parsed.packageId in moveErrors)) return undefined;

		let error: string;
		if (
			parsed.module in moveErrors[parsed.packageId] &&
			parsed.errorCode in moveErrors[parsed.packageId][parsed.module]
		) {
			error =
				moveErrors[parsed.packageId][parsed.module][parsed.errorCode];
		} else if (
			"ANY" in moveErrors[parsed.packageId] &&
			parsed.errorCode in moveErrors[parsed.packageId]["ANY"]
		) {
			error = moveErrors[parsed.packageId]["ANY"][parsed.errorCode];
		} else return undefined;

		return {
			...parsed,
			error,
		};
	}

	// =========================================================================
	//  Keypair
	// =========================================================================

	/**
	 * Constructs a `Keypair` instance from a private key string. The `privateKey`
	 * may indicate the signing scheme (ED25519, Secp256k1, or Secp256r1) via prefix,
	 * as recognized by `decodeSuiPrivateKey`.
	 *
	 * @param privateKey - The full private key string (e.g., "0x<64_hex_chars>").
	 * @returns A new `Keypair` instance for signing transactions.
	 * @throws If the schema is unsupported.
	 */
	public static keypairFromPrivateKey = (privateKey: string): Keypair => {
		const parsedKeypair = decodeSuiPrivateKey(privateKey);
		switch (parsedKeypair.schema) {
			case "ED25519":
				return Ed25519Keypair.fromSecretKey(parsedKeypair.secretKey);
			case "Secp256k1":
				return Secp256k1Keypair.fromSecretKey(parsedKeypair.secretKey);
			case "Secp256r1":
				return Secp256r1Keypair.fromSecretKey(parsedKeypair.secretKey);
			default:
				throw new Error(
					`unsupported schema \`${parsedKeypair.schema}\``
				);
		}
	};
}

import { decodeSuiPrivateKey, type Keypair } from "@mysten/sui/cryptography";
import type { DisplayFieldsResponse } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Secp256k1Keypair } from "@mysten/sui/keypairs/secp256k1";
import { Secp256r1Keypair } from "@mysten/sui/keypairs/secp256r1";
import type {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import type {
	AnyObjectType,
	Balance,
	CoinGeckoChain,
	CoinType,
	ModuleName,
	MoveErrorCode,
	ObjectId,
	PackageId,
	Slippage,
	SuiAddress,
} from "../../types";
import { DynamicFieldsApiHelpers } from "../apiHelpers/dynamicFieldsApiHelpers";
import { GrpcCasting, type SuiObjectView } from "./grpcCasting";
import { EventsApiHelpers } from "../apiHelpers/eventsApiHelpers";
import { InspectionsApiHelpers } from "../apiHelpers/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../apiHelpers/objectsApiHelpers";
import { TransactionsApiHelpers } from "../apiHelpers/transactionsApiHelpers";
import type {
	MoveErrors,
	ParsedMoveError,
	TranslatedMoveError,
} from "../types/moveErrorsInterface";

const NUMERIC_STRING_REGEX = /^\d*\.?\d*$/;
const BIGINT_STRING_REGEX = /^-?\d+n$/;
const HEX_STRING_REGEX = /^(0x)?[0-9A-F]+$/i;

/**
 * A utility class containing various helper functions for general use across
 * the Aftermath TS ecosystem. This includes numeric operations, object field
 * extraction, array transformations, slippage adjustments, and Move error parsing.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: public API — used as `Helpers.x(...)` across many consumers; converting to a namespace would be a breaking change
export class Helpers {
	// =========================================================================
	//  Api Helpers (Static References)
	// =========================================================================

	/**
	 * Static reference to the `DynamicFieldsApiHelpers`, providing utility methods
	 * for working with dynamic fields in Sui objects.
	 */
	static readonly dynamicFields = DynamicFieldsApiHelpers;

	/**
	 * Static reference to the `EventsApiHelpers`, providing methods for
	 * querying and filtering Sui events.
	 */
	static readonly events = EventsApiHelpers;

	/**
	 * Static reference to the `InspectionsApiHelpers`, used for reading
	 * Summaries or inspection data from objects.
	 */
	static readonly inspections = InspectionsApiHelpers;

	/**
	 * Static reference to the `ObjectsApiHelpers`, providing direct
	 * retrieval or manipulation of on-chain Sui objects.
	 */
	static readonly objects = ObjectsApiHelpers;

	/**
	 * Static reference to the `TransactionsApiHelpers`, enabling easier
	 * queries for transaction data by digest or other criteria.
	 */
	static readonly transactions = TransactionsApiHelpers;

	// =========================================================================
	//  Type Manipulation
	// =========================================================================

	/**
	 * Removes zeroes from every `x0...` sequence in a type string.
	 *
	 * For example, `"0x0000123"` becomes `"0x123"`. The replacement also
	 * affects addresses inside generic type arguments, and it does not validate
	 * the rest of the string.
	 *
	 * @param type - The address or Move type string to process.
	 * @returns A new string with those zero runs removed.
	 */
	static stripLeadingZeroesFromType = (type: AnyObjectType): AnyObjectType =>
		type.replaceAll(/x0+/g, "x");

	/**
	 * Left-pads the first type segment to 64 characters after `0x`.
	 *
	 * When `type` contains `::`, the text after the first separator is appended
	 * unchanged apart from the helper's existing removal of the next `0x` while
	 * it splits the suffix. The method does not validate hexadecimal characters.
	 *
	 * @param type - The address or extended Move type string.
	 * @returns A string whose first segment has 64 characters after `0x`.
	 * @throws `Error` when the first segment is longer than 64 characters.
	 */
	static addLeadingZeroesToType = (type: AnyObjectType): AnyObjectType => {
		const EXPECTED_TYPE_LENGTH = 64;

		let strippedType = type.replace("0x", "");
		let typeSuffix = "";

		if (strippedType.includes("::")) {
			const splitType = strippedType.replace("0x", "").split("::");
			typeSuffix = splitType
				.slice(1)
				.reduce((acc, str) => `${acc}::${str}`, "");
			strippedType = splitType[0];
		}

		const typeLength = strippedType.length;
		if (typeLength > EXPECTED_TYPE_LENGTH) {
			throw new Error("invalid type length");
		}

		const zerosNeeded = EXPECTED_TYPE_LENGTH - typeLength;
		const zeroString = "0".repeat(zerosNeeded);

		const newType = `0x${zeroString}${strippedType}`;
		return newType + typeSuffix;
	};

	/**
	 * Splits a coin string at colons for external coin-price lookups.
	 *
	 * When both the first and second segments are non-empty, the method returns
	 * those two segments and discards later segments. When either segment is
	 * empty or absent, it returns the original string with `chain: "sui"`.
	 * The chain value is not validated against the `CoinGeckoChain` union at
	 * runtime.
	 *
	 * @param coin - The coin string, which may look like `"bsc:0x<...>"` or just `"0x<...>"`.
	 * @returns An object with the `chain` (e.g. "bsc") and the `coinType`.
	 */
	static splitNonSuiCoinType = (
		coin: CoinType
	): {
		/** The prefix before the first colon, or `"sui"` for an unsplit value. */
		chain: CoinGeckoChain;
		/** The text between the first and second colon when a prefix exists. */
		coinType: CoinType;
	} => {
		const [uncastChain, coinType] = coin.split(":");
		if (!(uncastChain && coinType)) {
			return { coinType: coin, chain: "sui" };
		}
		const chain = uncastChain as Exclude<CoinGeckoChain, "sui">;
		return { chain, coinType };
	};

	// =========================================================================
	//  Numbers
	// =========================================================================

	/**
	 * Checks whether a string matches the helper's unsigned decimal pattern.
	 *
	 * The pattern accepts digits with at most one decimal point, including an
	 * empty string, a leading point such as `.5`, and a trailing point such as
	 * `5.`. It rejects signs, exponents, and other characters.
	 *
	 * @param str - The string to test.
	 * @returns `true` when `str` matches that pattern.
	 */
	static isNumber = (str: string): boolean => NUMERIC_STRING_REGEX.test(str);

	/**
	 * Adds the numbers in an array from left to right.
	 *
	 * @param arr - The array of numbers to sum.
	 * @returns The numeric total, or `0` for an empty array.
	 */
	static sum = (arr: number[]) => arr.reduce((prev, cur) => prev + cur, 0);

	/**
	 * Adds the bigints in an array from left to right.
	 *
	 * @param arr - The array of bigints to sum.
	 * @returns The bigint total, or `0n` for an empty array.
	 */
	static sumBigInt = (arr: bigint[]) =>
		arr.reduce((prev, cur) => prev + cur, BigInt(0));

	/**
	 * Checks whether two numbers differ by at most a relative tolerance.
	 *
	 * The exact comparison is `Math.abs(a - b) <= tolerance * Math.max(a, b)`.
	 * The method does not clamp `tolerance` or use absolute values for the
	 * operands in the right-hand side.
	 *
	 * @param a - The first number.
	 * @param b - The second number.
	 * @param tolerance - The multiplier applied to `Math.max(a, b)`.
	 * @returns `true` when the comparison passes.
	 */
	static closeEnough = (a: number, b: number, tolerance: number) =>
		Math.abs(a - b) <= tolerance * Math.max(a, b);

	/**
	 * Checks bigint closeness after converting both operands to numbers.
	 *
	 * The comparison is therefore subject to JavaScript number precision and uses
	 * the same formula as `closeEnough`.
	 *
	 * @param a - First bigint.
	 * @param b - Second bigint.
	 * @param tolerance - The multiplier passed to `closeEnough`.
	 * @returns `true` when the numeric comparison passes.
	 */
	static closeEnoughBigInt = (a: bigint, b: bigint, tolerance: number) =>
		Helpers.closeEnough(Number(a), Number(b), tolerance);

	/**
	 * Compares the floored scale buckets of two numbers.
	 *
	 * The method computes `Math.floor(a / fixedOne)` and
	 * `Math.floor(b / fixedOne)`, then checks whether their absolute difference
	 * is at most `1`.
	 *
	 * @param a - First number (scaled).
	 * @param b - Second number (scaled).
	 * @param fixedOne - The scale divisor shared by `a` and `b`.
	 * @returns `true` when the bucket difference is at most `1`.
	 */
	static veryCloseInt = (a: number, b: number, fixedOne: number) =>
		Math.abs(Math.floor(a / fixedOne) - Math.floor(b / fixedOne)) <= 1;

	/**
	 * Mixed `number` and `bigint` multiplication helpers.
	 *
	 * The suffix describes the argument and return types: `N` is `number` and
	 * `B` is `bigint`. Helpers that return `bigint` apply `Math.floor` before the
	 * conversion. Converting a bigint product to `number` can lose precision.
	 */
	static blendedOperations = {
		/**
		 * Multiplies two numbers and returns a number.
		 */
		mulNNN: (a: number, b: number): number => a * b,
		/**
		 * Multiplies two numbers, floors the product, and returns a bigint.
		 */
		mulNNB: (a: number, b: number): bigint => BigInt(Math.floor(a * b)),
		/**
		 * Multiplies a number by a bigint after converting the bigint to a number.
		 */
		mulNBN: (a: number, b: bigint): number => a * Number(b),
		/**
		 * Multiplies a number by a bigint after converting the bigint to a number,
		 * floors the product, and returns a bigint.
		 */
		mulNBB: (a: number, b: bigint): bigint => BigInt(Math.floor(a * Number(b))),
		/**
		 * Multiplies two bigints and converts the product to a number.
		 */
		mulBBN: (a: bigint, b: bigint): number => Number(a * b),
		/**
		 * Multiplies two bigints and returns the exact bigint product.
		 */
		mulBBB: (a: bigint, b: bigint): bigint => a * b,
	};

	/**
	 * Returns the largest bigint in the argument list.
	 *
	 * @param args - The bigints to compare.
	 * @returns The largest argument.
	 * @throws `TypeError` when no arguments are supplied.
	 */
	static maxBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e > m ? e : m));

	/**
	 * Returns the smallest bigint in the argument list.
	 *
	 * @param args - The bigints to compare.
	 * @returns The smallest argument.
	 * @throws `TypeError` when no arguments are supplied.
	 */
	static minBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e < m ? e : m));

	/**
	 * Returns the non-negative absolute value of a bigint.
	 *
	 * @param num - The input bigint.
	 * @returns `num` when it is non-negative, or `-num` otherwise.
	 */
	static absBigInt = (num: bigint) => (num < BigInt(0) ? -num : num);

	// =========================================================================
	//  Display
	// =========================================================================

	/**
	 * Uppercases the first character and lowercases the remaining characters.
	 *
	 * For example, `"HELLO"` becomes `"Hello"`. An empty string remains empty.
	 *
	 * @param str - The input string to transform.
	 * @returns The transformed string.
	 */
	static capitalizeOnlyFirstLetter = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

	// =========================================================================
	//  JSON
	// =========================================================================

	/**
	 * Parses JSON while applying the SDK's bigint and null conversions.
	 *
	 * Every string containing an optional minus sign, decimal digits, and a trailing
	 * `n` becomes a `bigint` after that suffix is removed. Every JSON `null` becomes
	 * `undefined`, including nested values.
	 * With `unsafeStringNumberConversion: true`, strings accepted by `isNumber`
	 * are also passed to `BigInt`; this can convert decimal-looking strings only
	 * when `BigInt` accepts them and can throw for strings that match the loose
	 * pattern but are not valid bigint input.
	 *
	 * @param json - A valid JSON string.
	 * @param unsafeStringNumberConversion - Whether to convert strings accepted by
	 * `isNumber` to `bigint` as well.
	 * @returns The parsed value after recursive reviver conversion. Top-level
	 * `null` becomes `undefined`.
	 * @throws `SyntaxError` for invalid JSON or a bigint conversion error from the
	 * reviver.
	 */
	static parseJsonWithBigint = (
		json: string,
		unsafeStringNumberConversion = false
	) =>
		JSON.parse(json, (_key, value) => {
			// convert null -> undefined everywhere
			if (value === null) {
				return undefined;
			}

			// handles bigint casting
			if (typeof value === "string" && BIGINT_STRING_REGEX.test(value)) {
				return BigInt(value.slice(0, -1));
			}

			if (
				unsafeStringNumberConversion &&
				typeof value === "string" &&
				Helpers.isNumber(value)
			) {
				return BigInt(value);
			}
			return value;
		});

	// =========================================================================
	//  General
	// =========================================================================

	/**
	 * Recursively copies arrays, enumerable object properties, and `Date` values.
	 *
	 * Dates are cloned from their timestamp. Other objects become plain objects
	 * containing their enumerable string-keyed properties. Primitive values are
	 * returned unchanged, and cyclic input is not supported.
	 *
	 * @param target - The data to clone deeply.
	 * @returns A copied structure with the same generic type.
	 */
	static deepCopy = <T>(target: T): T => {
		if (target === null) {
			return target;
		}
		if (target instanceof Date) {
			return new Date(target.getTime()) as T;
		}
		if (Array.isArray(target)) {
			return target.map((v) => Helpers.deepCopy(v)) as T;
		}
		if (typeof target === "object") {
			const cp: Record<string, unknown> = {};
			for (const k of Object.keys(target)) {
				cp[k] = Helpers.deepCopy((target as Record<string, unknown>)[k]);
			}
			return cp as T;
		}
		return target;
	};

	/**
	 * Finds the first index containing the maximum comparable value.
	 *
	 * @param arr - The input array.
	 * @returns The first maximum index, or `-1` when the array is empty.
	 */
	static indexOfMax = <T extends number | bigint | string | Date>(
		arr: T[]
	): number => {
		if (arr.length === 0) {
			return -1;
		}

		let maxIndex = 0;
		for (let i = 1; i < arr.length; i++) {
			if (arr[i] > arr[maxIndex]) {
				maxIndex = i;
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
	 * Returns a new array with duplicate elements removed.
	 *
	 * If the first element is an object, the method compares every element by its
	 * `JSON.stringify` result. Otherwise it uses `Set` equality. Both paths keep
	 * the first occurrence's order, and the input array is not mutated.
	 *
	 * @param arr - The original array.
	 * @returns An array of unique items.
	 * @throws When the object path cannot serialize an element, such as a bigint.
	 */
	static uniqueArray = <T>(arr: T[]): T[] => {
		if (arr.length === 0) {
			return [];
		}
		if (typeof arr[0] === "object") {
			return Helpers.uniqueObjectArray(arr);
		}
		return [...new Set(arr)];
	};

	/**
	 * Returns a promise that resolves after a timer delay.
	 *
	 * @param ms - The delay passed to `setTimeout`, in milliseconds.
	 * @returns A promise that resolves with `undefined` after the timer fires.
	 */
	static sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	/**
	 * Creates a timestamp-and-random base36 identifier string.
	 *
	 * The value combines `Date.now().toString(36)` with the random suffix from
	 * `Math.random().toString(36)`. It is not guaranteed to be globally unique.
	 *
	 * @returns The generated base36 string.
	 */
	static createUid = () =>
		Date.now().toString(36) + Math.random().toString(36).substring(2);

	/**
	 * Splits an array according to a synchronous predicate.
	 *
	 * Truthy predicate results go to the first array and falsy results go to the
	 * second. The method preserves input order and passes the item, index, and
	 * original array to the predicate.
	 *
	 * @param array - The array to filter.
	 * @param func - The predicate to call for each item.
	 * @returns A tuple of `[truthyItems, falsyItems]`.
	 */
	static bifilter = <ArrayType>(
		array: ArrayType[],
		func: (item: ArrayType, index: number, arr: ArrayType[]) => boolean
	): [trues: ArrayType[], falses: ArrayType[]] => {
		const trues: ArrayType[] = [];
		const falses: ArrayType[] = [];

		for (let index = 0; index < array.length; index++) {
			const item = array[index];
			if (func(item, index, array)) {
				trues[trues.length] = item;
			} else {
				falses[falses.length] = item;
			}
		}

		return [trues, falses];
	};

	/**
	 * Splits an array according to asynchronous predicate results.
	 *
	 * The method invokes the predicate for every item before awaiting
	 * `Promise.all`, so the checks run in parallel. It preserves input order and
	 * rejects if any predicate promise rejects.
	 *
	 * @param array - The array to filter.
	 * @param func - An async predicate receiving the item, index, and original array.
	 * @returns A promise for `[truthyItems, falsyItems]`.
	 */
	static bifilterAsync = async <ArrayType>(
		array: ArrayType[],
		func: (item: ArrayType, index: number, arr: ArrayType[]) => Promise<boolean>
	): Promise<[trues: ArrayType[], falses: ArrayType[]]> => {
		const predicates = await Promise.all(array.map(func));
		return Helpers.bifilter(array, (_, index) => predicates[index]);
	};

	/**
	 * Returns an object containing only entries accepted by a predicate.
	 *
	 * The method examines the object's enumerable own string-keyed entries and
	 * returns a new object. It does not mutate `obj`.
	 *
	 * @param obj - The original object to filter.
	 * @param predicate - A function taking a key and value and returning a boolean.
	 * @returns A new object with the accepted entries.
	 */
	static filterObject = <Value>(
		obj: Record<string, Value>,
		predicate: (key: string, value: Value) => boolean
	): Record<string, Value> =>
		Object.fromEntries(
			Object.entries(obj).filter(([key, value]) => predicate(key, value))
		);

	/**
	 * Applies a percent reduction to a bigint amount.
	 *
	 * The method computes `amount - floor((slippage / 100) * Number(amount))`.
	 * Converting the amount to `number` can lose precision before the reduction is
	 * converted back to bigint. It does not clamp the result or validate the
	 * percent input.
	 *
	 * @param amount - The original amount.
	 * @param slippage - The percent value, where `1` means 1%.
	 * @returns The reduced amount as a `bigint`.
	 * @throws `RangeError` when the computed reduction cannot be converted to a
	 * `bigint`, such as for a non-finite result.
	 */
	static applySlippageBigInt = (amount: Balance, slippage: Slippage) => {
		return amount - BigInt(Math.floor((slippage / 100) * Number(amount)));
	};

	/**
	 * Applies a percent reduction to a JavaScript number.
	 *
	 * The method returns `amount - (slippage / 100) * amount` without clamping or
	 * validating the input.
	 *
	 * @param amount - The original numeric amount.
	 * @param slippage - The percent value, where `1` means 1%.
	 * @returns The reduced amount as a `number`.
	 */
	static applySlippage = (amount: number, slippage: Slippage) => {
		return amount - (slippage / 100) * amount;
	};

	/**
	 * Pairs corresponding elements from two arrays.
	 *
	 * The result stops at the shorter input and does not mutate either array.
	 *
	 * @param firstCollection - The first collection.
	 * @param lastCollection - The second collection.
	 * @returns An array of `[firstCollection[i], lastCollection[i]]` pairs.
	 */
	static zip<S1, S2>(firstCollection: S1[], lastCollection: S2[]): [S1, S2][] {
		const length = Math.min(firstCollection.length, lastCollection.length);
		const zipped: [S1, S2][] = [];
		for (let index = 0; index < length; index++) {
			zipped.push([firstCollection[index], lastCollection[index]]);
		}
		return zipped;
	}

	/**
	 * Copies an object or array while replacing repeated references with `undefined`.
	 *
	 * The `seen` set tracks every object visited during this call. A cycle and a
	 * later occurrence of an already visited shared object both become
	 * `undefined`. The method returns new arrays and plain objects without
	 * mutating the input, but it mutates the supplied `seen` set.
	 *
	 * @param obj - The object or array to remove circular references from.
	 * @param seen - The reference set used to track visited objects.
	 * @returns A copied structure, or `undefined` for a repeated object reference.
	 */
	static removeCircularReferences<T>(
		obj: T,
		seen: WeakSet<object> = new WeakSet()
	): T | undefined {
		if (obj && typeof obj === "object") {
			if (seen.has(obj as object)) {
				return undefined;
			}
			seen.add(obj as object);

			if (Array.isArray(obj)) {
				return obj.map((item) =>
					Helpers.removeCircularReferences(item, seen)
				) as unknown as T;
			}
			const entries = Object.entries(obj as Record<string, unknown>).map(
				([key, value]) => [key, Helpers.removeCircularReferences(value, seen)]
			);
			return Object.fromEntries(entries) as unknown as T;
		}
		return obj;
	}

	// =========================================================================
	//  Type Checking
	// =========================================================================

	/**
	 * Checks whether an unknown value is an array whose items are all strings.
	 *
	 * @param value - The value to check.
	 * @returns `true` for an empty or string-only array, otherwise `false`.
	 */
	static isArrayOfStrings(value: unknown): value is string[] {
		return (
			Array.isArray(value) && value.every((item) => typeof item === "string")
		);
	}

	/**
	 * Applies the helper's minimum-shape check for a Sui Move type.
	 *
	 * After trimming whitespace, the string must start with lowercase `0x`, have
	 * length at least `9`, contain `::` at index `3` or later and again at index
	 * `6` or later, and not end with `:`. The method does not validate the full
	 * address, module, or type grammar.
	 *
	 * @param str - The string to validate.
	 * @returns `true` when the minimum shape passes.
	 */
	static isValidType = (str: string): boolean => {
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
	 * Checks whether a string contains one or more hexadecimal digits.
	 *
	 * The string may begin with `0x` or `0X`. Whitespace, signs, and an empty
	 * `0x` prefix are rejected.
	 *
	 * @param hexString - The string to check.
	 * @returns `true` when the string matches the hexadecimal pattern.
	 */
	static isValidHex = (hexString: string): boolean =>
		HEX_STRING_REGEX.test(hexString);

	// =========================================================================
	//  Sui Object Parsing
	// =========================================================================

	/**
	 * Returns the object type after applying `addLeadingZeroesToType`.
	 *
	 * The helper pads the outer address segment. Generic arguments keep their
	 * source padding and spacing, so equivalent gRPC and JSON-RPC generic type
	 * strings can remain textually different.
	 *
	 * @param data - The gRPC object view.
	 * @returns The normalized fully qualified object type.
	 * @throws `Error` when `data.type` is absent or empty, or when its first type
	 * segment is too long.
	 */
	static getObjectType(data: SuiObjectView): ObjectId {
		const objectType = data?.type;
		if (objectType) {
			return Helpers.addLeadingZeroesToType(objectType);
		}

		throw new Error(`no object type found on ${data?.objectId}`);
	}

	/**
	 * Returns the object ID after applying `addLeadingZeroesToType`.
	 *
	 * @param data - The gRPC object view.
	 * @returns A zero-padded `ObjectId` string.
	 * @throws `Error` when `data.objectId` is absent or empty, or when the ID is
	 * longer than 64 hexadecimal characters.
	 */
	static getObjectId(data: SuiObjectView): ObjectId {
		const objectId = data?.objectId;
		if (objectId) {
			return Helpers.addLeadingZeroesToType(objectId);
		}

		throw new Error(`no object id found on ${data?.type}`);
	}

	/**
	 * Returns the Move fields from a gRPC object view.
	 *
	 * The value is the gRPC `json` view, not JSON-RPC `content.fields`. Nested
	 * structs can be bare, `vector<u8>` fields can be base64 strings, and `UID`
	 * fields can be bare object IDs. Use the corresponding `GrpcCasting` helpers
	 * before reading those shapes. The returned record is dynamic and is not
	 * statically checked field by field.
	 *
	 * `json` is `undefined` unless `include: { json: true }` was passed at the
	 * fetch site.
	 *
	 * @param data - The object view containing the requested `json` fields.
	 * @returns The dynamic Move field record.
	 * @throws `Error` when `data.json` is absent or falsy.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Move fields are dynamic — callers access nested properties directly; typing as `unknown` would cascade casts through dozens of call sites
	static getObjectFields(data: SuiObjectView): Record<string, any> {
		const fields = data?.json;
		if (fields) {
			return fields;
		}
		throw new Error(`no object fields found on ${data?.objectId}`);
	}

	/**
	 * Returns display metadata from a gRPC object view in JSON-RPC shape.
	 *
	 * Reshaped onto JSON-RPC's `DisplayFieldsResponse` so the display casters are
	 * unaffected by the transport change; see
	 * {@link GrpcCasting.displayFieldsResponseFromGrpcDisplay} for the two
	 * semantic differences that reshape absorbs.
	 *
	 * `display` is `undefined` when it was not requested and `null` when the
	 * object's type has no Display template. A non-null value is reshaped by
	 * `GrpcCasting.displayFieldsResponseFromGrpcDisplay`.
	 *
	 * @param data - The object view containing display data.
	 * @returns The JSON-RPC-shaped display response.
	 * @throws `Error` when `data.display` is `undefined`, which indicates that
	 * display data was not requested or was not returned.
	 */
	static getObjectDisplay(data: SuiObjectView): DisplayFieldsResponse {
		const display = data?.display;
		if (display === undefined) {
			throw new Error(`no object display found on ${data?.objectId}`);
		}
		return GrpcCasting.displayFieldsResponseFromGrpcDisplay(display);
	}

	// =========================================================================
	//  Tx Command Input Construction
	// =========================================================================

	/**
	 * Converts an object ID into a transaction object argument when needed.
	 *
	 * A string calls `tx.object(object)`, which adds an input to the transaction.
	 * An existing `TransactionObjectArgument` is returned by identity and does
	 * not call the transaction.
	 *
	 * @param tx - The transaction to update when `object` is a string.
	 * @param object - An object ID or an existing transaction object argument.
	 * @returns A transaction object argument for `object`.
	 */
	static addTxObject = (
		tx: Transaction,
		object: ObjectId | TransactionObjectArgument
	): TransactionObjectArgument => {
		return typeof object === "string" ? tx.object(object) : object;
	};

	// =========================================================================
	//  Sui Address / Key Checking
	// =========================================================================

	/**
	 * Checks whether a string is a valid Sui address.
	 *
	 * Lowercase-`0x` addresses of up to 64 hexadecimal characters are padded to
	 * 64 characters before validation. Invalid prefixes, lengths, characters, and
	 * address strings longer than 64 characters return `false`; normalization
	 * errors are caught rather than thrown.
	 *
	 * @param address - The address string to validate.
	 * @returns `true` when the normalized value passes Sui address validation.
	 */
	static isValidSuiAddress = (address: SuiAddress) =>
		isValidSuiAddress(
			(() => {
				if (!address.startsWith("0x") || address.length < 3) {
					return "";
				}
				try {
					return Helpers.addLeadingZeroesToType(address);
				} catch {
					return "";
				}
			})()
		);

	// =========================================================================
	//  Error Parsing
	// =========================================================================

	/**
	 * Extracts a Move abort code, package ID, and module from a Sui error message.
	 *
	 * The message must contain `MoveAbort` and the parser must find an integer
	 * after the last comma, an `address: ... , name:` package segment, and an
	 * `Identifier("...")` module segment. The package ID is normalized to 64
	 * hexadecimal characters. An empty address segment is accepted by the current
	 * padding logic and becomes the zero address. If any other required part is
	 * missing or invalid, the method returns `undefined`.
	 *
	 * @param inputs - The raw Sui error message.
	 * @param inputs.errorMessage - The error text to parse.
	 * @returns The parsed error details, or `undefined` when the message does not
	 * match the supported shape.
	 */
	static parseMoveErrorMessage(
		inputs: { errorMessage: string }
	): ParsedMoveError | undefined {
		const { errorMessage } = inputs;
		if (!errorMessage.toLowerCase().includes("moveabort")) {
			return undefined;
		}

		/*
			MoveAbort(MoveLocation { module: ModuleId { address: 8d8946c2a433e2bf795414498d9f7b32e04aca8dbf35a20257542dc51406242b, name: Identifier("orderbook") }, function: 11, instruction: 117, function_name: Some("fill_market_order") }, 3005) in command 2

			MoveAbort(MoveLocation { module: ModuleId { address: 7c995f9c0c0553c0f3bfac7cf3c8b85716f0ca522305586bd0168ca20aeed277, name: Identifier("clearing_house") }, function: 37, instruction: 17, function_name: Some("place_limit_order") }, 1) in command 1
		*/

		const moveErrorCode = (errorMsg: string): MoveErrorCode | undefined => {
			const startIndex = errorMsg.lastIndexOf(",");
			const endIndex = errorMsg.lastIndexOf(")");
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
				return undefined;
			}

			try {
				const errorCode = Number.parseInt(
					errorMsg.slice(startIndex + 1, endIndex),
					10
				);
				if (Number.isNaN(errorCode)) {
					return undefined;
				}
				return errorCode;
			} catch {
				return undefined;
			}
		};

		const moveErrorPackageId = (errorMsg: string): PackageId | undefined => {
			const startIndex = errorMsg.toLowerCase().indexOf("address:");
			const endIndex = errorMsg.indexOf(", name:");
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
				return undefined;
			}

			try {
				const pkgStr = errorMsg
					.slice(startIndex + 8, endIndex)
					.trim()
					.replaceAll("0x", "");
				const packageId = Helpers.addLeadingZeroesToType(`0x${pkgStr}`);
				if (!Helpers.isValidHex(packageId)) {
					return undefined;
				}
				return packageId;
			} catch {
				return undefined;
			}
		};

		const moveErrorModule = (errorMsg: string): ModuleName | undefined => {
			const startIndex = errorMsg.toLowerCase().indexOf('identifier("');
			const endIndex = errorMsg.indexOf('")');
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex) {
				return undefined;
			}

			try {
				return errorMsg.slice(startIndex + 12, endIndex).trim();
			} catch {
				return undefined;
			}
		};

		const errorCode = moveErrorCode(errorMessage);
		const packageId = moveErrorPackageId(errorMessage);
		const module = moveErrorModule(errorMessage);
		if (errorCode === undefined || !packageId || !module) {
			return undefined;
		}

		return { errorCode, packageId, module };
	}

	/**
	 * Maps a parsed Move abort to a message in a package error table.
	 *
	 * The method first requires a package entry. It then prefers an exact module
	 * and error-code entry, and falls back to the package's `ANY` table. It returns
	 * `undefined` when parsing fails, the package is absent, or neither table has
	 * the error code.
	 *
	 * @param inputs - The error text and lookup table.
	 * @returns The parsed details with the translated message, or `undefined`.
	 */
	static translateMoveErrorMessage(inputs: {
		/** The raw Sui Move abort message. */
		errorMessage: string;
		/** The package, module, and error-code message table. */
		moveErrors: MoveErrors;
	}): TranslatedMoveError | undefined {
		const { errorMessage, moveErrors } = inputs;

		const parsed = Helpers.parseMoveErrorMessage({ errorMessage });
		if (!(parsed && parsed.packageId in moveErrors)) {
			return undefined;
		}

		let error: string;
		if (
			parsed.module in moveErrors[parsed.packageId] &&
			parsed.errorCode in moveErrors[parsed.packageId][parsed.module]
		) {
			error = moveErrors[parsed.packageId][parsed.module][parsed.errorCode];
		} else if (
			"ANY" in moveErrors[parsed.packageId] &&
			parsed.errorCode in moveErrors[parsed.packageId].ANY
		) {
			error = moveErrors[parsed.packageId].ANY[parsed.errorCode];
		} else {
			return undefined;
		}

		return {
			...parsed,
			error,
		};
	}

	// =========================================================================
	//  Keypair
	// =========================================================================

	/**
	 * Constructs a Sui keypair from an encoded private key.
	 *
	 * `decodeSuiPrivateKey` selects the scheme from the encoded key. This method
	 * supports `ED25519`, `Secp256k1`, and `Secp256r1` and returns the matching
	 * keypair implementation. It performs no network I/O.
	 *
	 * @param privateKey - The encoded private key accepted by
	 * `decodeSuiPrivateKey`.
	 * @returns A new keypair for signing.
	 * @throws When the key is malformed, unsupported, or cannot be decoded by the
	 * underlying cryptography library.
	 */
	static keypairFromPrivateKey = (privateKey: string): Keypair => {
		const parsedKeypair = decodeSuiPrivateKey(privateKey);
		switch (parsedKeypair.scheme) {
			case "ED25519":
				return Ed25519Keypair.fromSecretKey(parsedKeypair.secretKey);
			case "Secp256k1":
				return Secp256k1Keypair.fromSecretKey(parsedKeypair.secretKey);
			case "Secp256r1":
				return Secp256r1Keypair.fromSecretKey(parsedKeypair.secretKey);
			default:
				throw new Error(`unsupported scheme \`${parsedKeypair.scheme}\``);
		}
	};
}

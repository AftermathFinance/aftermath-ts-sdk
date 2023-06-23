import { AnyObjectType, Balance, Slippage } from "../../types";
import { DynamicFieldsApiHelpers } from "../api/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../api/eventsApiHelpers";
import { InspectionsApiHelpers } from "../api/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../api/objectsApiHelpers";
import { RpcApiHelpers } from "../api/rpcApiHelpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";
import { Casting } from "./casting";

export class Helpers {
	// =========================================================================
	//  Api Helpers
	// =========================================================================

	public static readonly dynamicFields = DynamicFieldsApiHelpers;
	public static readonly events = EventsApiHelpers;
	public static readonly inspections = InspectionsApiHelpers;
	public static readonly objects = ObjectsApiHelpers;
	public static readonly rpc = RpcApiHelpers;
	public static readonly transactions = TransactionsApiHelpers;

	// =========================================================================
	//  Type Manipulation
	// =========================================================================

	public static stripLeadingZeroesFromType = (
		type: AnyObjectType
	): AnyObjectType => type.replaceAll(/x0+/g, "x");

	public static addLeadingZeroesToType = (
		type: AnyObjectType
	): AnyObjectType => {
		const expectedTypeLength = 64;

		const splitType = type.replace("0x", "").split("::");

		const typeSuffix = "::" + splitType[1] + "::" + splitType[2];

		const strippedType = splitType[0];
		const typeLength = strippedType.length;

		if (typeLength > expectedTypeLength)
			throw new Error("invalid type length");

		const zeros = Array(expectedTypeLength - typeLength)
			.fill("0")
			.reduce((acc, val) => acc + val, "");
		const newType = "0x" + zeros + strippedType;

		return newType + typeSuffix;
	};

	// =========================================================================
	//  Numbers
	// =========================================================================

	public static isNumber = (str: string): boolean => /^\d*\.?\d*$/g.test(str);

	public static sum = (arr: number[]) =>
		arr.reduce((prev, cur) => prev + cur, 0);

	public static sumBigInt = (arr: bigint[]) =>
		arr.reduce((prev, cur) => prev + cur, BigInt(0));

	public static closeEnough = (a: number, b: number, tolerance: number) =>
		Math.abs(a - b) <= tolerance * Math.max(a, b);

	public static closeEnoughBigInt = (
		a: bigint,
		b: bigint,
		tolerance: number
	) => Helpers.closeEnough(Number(a), Number(b), tolerance);

	public static veryCloseInt = (a: number, b: number, fixedOne: number) =>
		Math.abs(Math.floor(a / fixedOne) - Math.floor(b / fixedOne)) <= 1;

	public static blendedOperations = {
		mulNNN: (a: number, b: number): number => a * b,
		mulNNB: (a: number, b: number): bigint => BigInt(Math.floor(a * b)),
		mulNBN: (a: number, b: bigint): number => a * Number(b),
		mulNBB: (a: number, b: bigint): bigint =>
			BigInt(Math.floor(a * Number(b))),
		mulBBN: (a: bigint, b: bigint): number => Number(a * b),
		mulBBB: (a: bigint, b: bigint): bigint => a * b,
	};

	// =========================================================================
	//  Display
	// =========================================================================

	public static capitalizeOnlyFirstLetter = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

	// =========================================================================
	//  JSON
	// =========================================================================

	public static parseJsonWithBigint = (
		json: string,
		unsafeStringNumberConversion = false
	) =>
		JSON.parse(json, (key, value) => {
			// handles bigint casting
			if (typeof value === "string" && /^\d+n$/.test(value)) {
				return BigInt(value.slice(0, value.length - 1));
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

	public static deepCopy = <T>(target: T): T => {
		if (target === null) {
			return target;
		}
		if (target instanceof Date) {
			return new Date(target.getTime()) as any;
		}
		if (target instanceof Array) {
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

	public static uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)];

	public static sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

	public static createUid = () =>
		Date.now().toString(36) + Math.random().toString(36).substring(2);

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

	public static applySlippage = (amount: number, slippage: Slippage) => {
		return amount - Casting.normalizeSlippageTolerance(slippage) * amount;
	};

	// =========================================================================
	//  Type Checking
	// =========================================================================

	public static isArrayOfStrings(value: unknown): value is string[] {
		return (
			Array.isArray(value) &&
			value.every((item) => typeof item === "string")
		);
	}
}

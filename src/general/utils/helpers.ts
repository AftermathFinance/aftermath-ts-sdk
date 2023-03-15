import { AnyObjectType } from "../../types";
import { DynamicFieldsApiHelpers } from "../api/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../api/eventsApiHelpers";
import { InspectionsApiHelpers } from "../api/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../api/objectsApiHelpers";
import { RpcApiHelpers } from "../api/rpcApiHelpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";

export class Helpers {
	/////////////////////////////////////////////////////////////////////
	//// Api Helpers
	/////////////////////////////////////////////////////////////////////

	public static dynamicFields = DynamicFieldsApiHelpers;
	public static events = EventsApiHelpers;
	public static inspections = InspectionsApiHelpers;
	public static objects = ObjectsApiHelpers;
	public static rpc = RpcApiHelpers;
	public static transactions = TransactionsApiHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Type Manipulation
	/////////////////////////////////////////////////////////////////////

	public static stripLeadingZeroesFromType = (
		type: AnyObjectType
	): AnyObjectType => type.replaceAll(/x0+/g, "x");

	/////////////////////////////////////////////////////////////////////
	//// Numbers
	/////////////////////////////////////////////////////////////////////

	public static sum = (arr: number[]) =>
		arr.reduce((prev, cur) => prev + cur, 0);

	public static sumBigInt = (arr: bigint[]) =>
		arr.reduce((prev, cur) => prev + cur, BigInt(0));

	public static isNumber = (str: string): boolean => /^\d*\.?\d*$/g.test(str);

	/////////////////////////////////////////////////////////////////////
	//// Display
	/////////////////////////////////////////////////////////////////////

	public static capitalizeOnlyFirstLetter = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

	/////////////////////////////////////////////////////////////////////
	//// JSON
	/////////////////////////////////////////////////////////////////////

	public static parseJsonWithBigint = (
		json: string,
		unsafeStringNumberConversion = false
	): string =>
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

	/////////////////////////////////////////////////////////////////////
	//// General
	/////////////////////////////////////////////////////////////////////

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
}

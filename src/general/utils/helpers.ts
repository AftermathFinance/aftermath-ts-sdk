import { AnyObjectType } from "../../types";

export class Helpers {
	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static stripLeadingZeroesFromType = (
		type: AnyObjectType
	): AnyObjectType => type.replaceAll(/x0+/g, "x");

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
			return cp.map((n: any) => Helpers.deepCopy<any>(n)) as any;
		}
		if (typeof target === "object") {
			const cp = { ...(target as { [key: string]: any }) } as {
				[key: string]: any;
			};
			Object.keys(cp).forEach((k) => {
				cp[k] = Helpers.deepCopy<any>(cp[k]);
			});
			return cp as T;
		}
		return target;
	};

	public static sum = (arr: number[]) =>
		arr.reduce((prev, cur) => prev + cur, 0);

	public static sumBigInt = (arr: bigint[]) =>
		arr.reduce((prev, cur) => prev + cur, BigInt(0));

	public static capitalizeOnlyFirstLetter = (str: string) =>
		str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

import {
	DisplayFieldsResponse,
	SuiMoveObject,
	SuiObjectResponse,
} from "@mysten/sui/client";
import {
	AnyObjectType,
	Balance,
	ScallopProviders,
	SuiNetwork,
	CoinsToDecimals,
	CoinsToPrice,
	ObjectId,
	Slippage,
	ModuleName,
	PackageId,
	MoveErrorCode,
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
import { Scallop } from "@scallop-io/sui-scallop-sdk";
import { NetworkType } from "@scallop-io/sui-kit";
import { IndexerSwapVolumeResponse } from "../types/castingTypes";
import { Coin } from "../..";

/**
 * A utility class containing various helper functions for general use.
 */
export class Helpers {
	// =========================================================================
	//  Api Helpers
	// =========================================================================

	public static readonly dynamicFields = DynamicFieldsApiHelpers;
	public static readonly events = EventsApiHelpers;
	public static readonly inspections = InspectionsApiHelpers;
	public static readonly objects = ObjectsApiHelpers;
	public static readonly transactions = TransactionsApiHelpers;

	// =========================================================================
	//  Type Manipulation
	// =========================================================================

	/**
	 * Removes leading zeroes from the hexadecimal representation of a given object type.
	 * @param type - The object type to strip leading zeroes from.
	 * @returns The object type with leading zeroes removed from its hexadecimal representation.
	 */
	public static stripLeadingZeroesFromType = (
		type: AnyObjectType
	): AnyObjectType => type.replaceAll(/x0+/g, "x");

	/**
	 * Adds leading zeroes to a given `AnyObjectType` until it reaches a length of 64 characters.
	 * If the input type already has a length greater than 64, an error is thrown.
	 * @param type - The `AnyObjectType` to add leading zeroes to.
	 * @returns The modified `AnyObjectType` with leading zeroes added.
	 * @throws An error if the input type has a length greater than 64.
	 */
	public static addLeadingZeroesToType = (
		type: AnyObjectType
	): AnyObjectType => {
		const expectedTypeLength = 64;

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

	public static maxBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e > m ? e : m));

	public static minBigInt = (...args: bigint[]) =>
		args.reduce((m, e) => (e < m ? e : m));

	public static absBigInt = (num: bigint) => (num < BigInt(0) ? -num : num);

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

	// =========================================================================
	//  Type Checking
	// =========================================================================

	public static isArrayOfStrings(value: unknown): value is string[] {
		return (
			Array.isArray(value) &&
			value.every((item) => typeof item === "string")
		);
	}

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

	public static isValidHex = (hexString: string): boolean => {
		const hexPattern = /^(0x)?[0-9A-F]+$/i;
		return hexPattern.test(hexString);
	};

	// =========================================================================
	//  Sui Object Parsing
	// =========================================================================

	public static getObjectType(data: SuiObjectResponse): ObjectId {
		const objectType = data.data?.type;
		// NOTE: should `Helpers.addLeadingZeroesToType` be used here ?
		if (objectType) return objectType;

		throw new Error("no object type found on " + data.data?.objectId);
	}

	public static getObjectId(data: SuiObjectResponse): ObjectId {
		const objectId = data.data?.objectId;
		if (objectId) return Helpers.addLeadingZeroesToType(objectId);

		throw new Error("no object id found on " + data.data?.type);
	}

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

	// TODO: use this everywhere in api for tx command creation
	public static addTxObject = (
		tx: Transaction,
		object: ObjectId | TransactionObjectArgument
	): TransactionObjectArgument => {
		return typeof object === "string" ? tx.object(object) : object;
	};

	// =========================================================================
	//  Constructors
	// =========================================================================

	public static async createScallopProviders(inputs: {
		network: SuiNetwork;
	}): Promise<ScallopProviders> {
		const network = inputs.network.toLowerCase();
		const networkType =
			network === "local"
				? "localnet"
				: network !== "mainnet" &&
				  network !== "testnet" &&
				  network !== "localnet"
				? undefined
				: network;
		if (!networkType)
			throw new Error(`network \`${inputs.network}\` not found`);

		const Main = new Scallop({
			networkType,
		});
		const [Builder, Query] = await Promise.all([
			Main.createScallopBuilder(),
			Main.createScallopQuery(),
		]);
		// await Promise.all([Builder.init(), Query.init()]);
		return {
			Main,
			Builder,
			Query,
		};
	}

	// =========================================================================
	//  Indexer Calculations
	// =========================================================================

	/**
	 * Calculates the total volume in USD.
	 *
	 * @param inputs - The input parameters for the calculation.
	 * @param inputs.volumes - Swap volumes.
	 * @param inputs.coinsToPrice - The mapping of coin types to their respective prices.
	 * @param inputs.coinsToDecimals - The mapping of coin types to their respective decimal places.
	 * @returns The total volume in USD.
	 */
	public static calcIndexerVolumeUsd = (inputs: {
		volumes: IndexerSwapVolumeResponse;
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
	}): number => {
		const { volumes, coinsToPrice, coinsToDecimals } = inputs;
		return volumes.reduce((acc, data) => {
			const coinInPrice = coinsToPrice[data.coinTypeIn];
			if (coinInPrice > 0) {
				const decimals = coinsToDecimals[data.coinTypeIn];
				const tradeAmount = Coin.balanceWithDecimals(
					data.totalAmountIn,
					decimals
				);

				const amountUsd = tradeAmount * coinInPrice;
				return acc + amountUsd;
			}

			const coinOutPrice = coinsToPrice[data.coinTypeOut];
			const decimals = coinsToDecimals[data.coinTypeOut];
			const tradeAmount = Coin.balanceWithDecimals(
				data.totalAmountOut,
				decimals
			);

			const amountUsd = coinInPrice < 0 ? 0 : tradeAmount * coinOutPrice;
			return acc + amountUsd;
		}, 0);
	};

	// =========================================================================
	//  Error Parsing
	// =========================================================================

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
			} catch (e) {
				return undefined;
			}
		};

		const moveErrorPackageId = (inputs: {
			errorMessage: string;
		}): PackageId | undefined => {
			const { errorMessage } = inputs;

			const startIndex = errorMessage.toLowerCase().indexOf("address:");
			const endIndex = errorMessage.indexOf(",");
			if (startIndex <= 0 || endIndex <= 0 || startIndex >= endIndex)
				return undefined;

			try {
				const packageId = Helpers.addLeadingZeroesToType(
					"0x" +
						errorMessage
							.slice(startIndex + 8, endIndex)
							.trim()
							.replaceAll("0x", "")
				);
				if (!this.isValidHex(packageId)) return undefined;

				return packageId;
			} catch (e) {
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
			} catch (e) {
				return undefined;
			}
		};

		try {
			const errorCode = moveErrorCode({
				errorMessage,
			});
			const packageId = moveErrorPackageId({
				errorMessage,
			});
			const module = moveErrorModule({
				errorMessage,
			});
			if (errorCode === undefined || !packageId || !module)
				return undefined;

			return {
				errorCode,
				packageId,
				module,
			};
		} catch (e) {
			return undefined;
		}
	}

	public static translateMoveErrorMessage(inputs: {
		errorMessage: string;
		moveErrors: Record<ModuleName, Record<MoveErrorCode, string>>;
	}): string | undefined {
		const { errorMessage, moveErrors } = inputs;

		const parsed = this.parseMoveErrorMessage({ errorMessage });
		if (
			!parsed ||
			!(parsed.module in moveErrors) ||
			!(parsed.errorCode in moveErrors[parsed.module])
		)
			return undefined;

		return moveErrors[parsed.module][parsed.errorCode];
	}
}

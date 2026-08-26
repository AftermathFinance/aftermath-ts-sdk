import type { SuiClientTypes } from "@mysten/sui/client";
import type {
	CoinStruct,
	DisplayFieldsResponse,
	DynamicFieldInfo,
	SuiObjectResponse,
} from "@mysten/sui/jsonRpc";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

/**
 * The gRPC object view consumed by the SDK's object casters.
 *
 * Request `json` and `display` with the corresponding gRPC `include` flags.
 * Without those flags, the runtime response can contain `undefined` even
 * though this type requires the fields for casters that read them.
 *
 * `display` is nullable when the object type has no Display template. Use
 * `Helpers.getObjectDisplay` only after requesting display data; it throws when
 * the field is `undefined`.
 */
export type SuiObjectView = SuiClientTypes.Object<{
	/** The gRPC request include flag for the Move `json` object view. */
	json: true;
	/** The gRPC request include flag for Display v2 output. */
	display: true;
}>;

/**
 * Adapts `SuiGrpcClient` response shapes to the JSON-RPC-shaped types exposed by
 * this SDK.
 *
 * These methods only reshape values. They do not perform network I/O or mutate
 * their inputs. Fields that gRPC cannot supply are omitted or represented by
 * the documented compatibility value.
 */
export class GrpcCasting {
	// =========================================================================
	//  Coins
	// =========================================================================

	/**
	 * Reshapes a gRPC `Coin` into a JSON-RPC-shaped `CoinStruct`.
	 *
	 * `coinType` is the substring between the first `<` and the last `>` in
	 * `coin.type`. A non-generic `type` is returned unchanged, and any address
	 * padding inside the extracted type is preserved. The gRPC coin does not
	 * provide `previousTransaction`, so the returned field is always `""`.
	 *
	 * @param coin - The gRPC coin to reshape.
	 * @returns A JSON-RPC-shaped coin struct. The input is not mutated.
	 */
	public static coinStructFromGrpcCoin = (
		coin: SuiClientTypes.Coin
	): CoinStruct => ({
		coinType: GrpcCasting.innerCoinTypeFromCoinObjectType(coin.type),
		coinObjectId: coin.objectId,
		version: coin.version,
		digest: coin.digest,
		balance: coin.balance,
		previousTransaction: "",
	});

	/**
	 * Extracts the inner type from a generic object type.
	 *
	 * The method takes the text after the first `<` and before the last `>`, so
	 * nested generic arguments remain part of the result. It returns `objectType`
	 * unchanged when either delimiter is absent or out of order.
	 */
	private static innerCoinTypeFromCoinObjectType = (
		objectType: string
	): string => {
		const start = objectType.indexOf("<");
		const end = objectType.lastIndexOf(">");
		if (start < 0 || end < start) {
			return objectType;
		}
		return objectType.slice(start + 1, end);
	};

	// =========================================================================
	//  Dynamic Fields
	// =========================================================================

	/**
	 * Reshapes a gRPC `DynamicFieldEntry` into a JSON-RPC-shaped `DynamicFieldInfo`.
	 *
	 * Field mapping (verified live against a real parent object):
	 * - `fieldId` -> `objectId`
	 * - `valueType` -> `objectType`
	 * - `$kind` -> `type` (`"DynamicField"` | `"DynamicObject"`)
	 * - `name.bcs` -> `bcsName` (base64), `bcsEncoding: "base64"`
	 *
	 * `name.value` and `bcsName` contain the base64 encoding of `name.bcs`; gRPC
	 * does not provide the parsed JSON value. `version` and `digest` are omitted
	 * because the list response does not provide them.
	 *
	 * @param entry - The gRPC dynamic-field entry to reshape.
	 * @returns The JSON-RPC-shaped dynamic-field information.
	 */
	public static dynamicFieldInfoFromGrpcEntry = (
		entry: SuiClientTypes.DynamicFieldEntry
	): DynamicFieldInfo =>
		({
			name: {
				type: entry.name.type,
				value: toBase64(entry.name.bcs),
			},
			bcsEncoding: "base64",
			bcsName: toBase64(entry.name.bcs),
			type: entry.$kind,
			objectType: entry.valueType,
			objectId: entry.fieldId,
		}) as unknown as DynamicFieldInfo;

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Builds a `SuiObjectResponse` from a gRPC object's BCS content.
	 *
	 * The returned `data.bcs.bcsBytes` is the base64 encoding of `content`, which
	 * is the field consumed by `Casting.castObjectBcs`. The result includes the
	 * object's ID, version, digest, type, owner, and a `moveObject` BCS record.
	 * `hasPublicTransfer` is omitted because gRPC does not provide it.
	 *
	 * @param object - A gRPC object requested with `include.content: true`.
	 * @returns A JSON-RPC-shaped object response containing the BCS bytes.
	 */
	public static suiObjectResponseFromGrpcObjectBcs = (
		object: SuiClientTypes.Object<{ content: true }>
	): SuiObjectResponse =>
		({
			data: {
				objectId: object.objectId,
				version: object.version,
				digest: object.digest,
				type: object.type,
				owner: object.owner,
				bcs: {
					dataType: "moveObject",
					type: object.type,
					version: object.version,
					bcsBytes: toBase64(object.content),
				},
			},
		}) as unknown as SuiObjectResponse;

	/**
	 * Reshapes a gRPC `Display` into a JSON-RPC-shaped display response.
	 *
	 * String values in `output` become `data` fields. Non-string values are
	 * dropped. Per-field entries in `errors` do not populate the whole-object
	 * `error` while `output` exists. When `output` is absent, all error entries
	 * are joined as `field: message` pairs in an error with code `displayError`.
	 * A null or undefined display returns `{ data: null, error: null }`.
	 *
	 * @param display - The gRPC display response, or `null` or `undefined` when
	 * no display template or display data is available.
	 * @returns The JSON-RPC-shaped display response.
	 */
	public static displayFieldsResponseFromGrpcDisplay = (
		display: SuiClientTypes.Display | null | undefined
	): DisplayFieldsResponse => {
		const output = display?.output ?? null;
		if (output === null) {
			const errors = display?.errors ?? null;
			return {
				data: null,
				error: errors
					? {
							code: "displayError",
							error: Object.entries(errors)
								.map(([field, message]) => `${field}: ${message}`)
								.join("; "),
						}
					: null,
			};
		}

		const data: Record<string, string> = {};
		for (const [key, value] of Object.entries(output)) {
			if (typeof value === "string") {
				data[key] = value;
			}
		}
		return { data, error: null };
	};

	// =========================================================================
	//  Move Field Shapes
	// =========================================================================

	/**
	 * Decodes a `vector<u8>` Move field into a number array.
	 *
	 * gRPC's `json` view base64-encodes byte vectors (`"CQk="`), where JSON-RPC
	 * returned a number array (`[9, 9]`). Indexing the gRPC form directly yields
	 * a one-character `string`, so `Number(...)` of it is `NaN`, a silently wrong
	 * value rather than an error. Always route a byte vector through here.
	 *
	 * A number array or `Uint8Array` is copied with `Array.from`, so JSON-RPC-shaped
	 * fixtures work without sharing the input array.
	 *
	 * @param value - A gRPC base64 string or an already decoded byte collection.
	 * @returns A new array of byte numbers.
	 * @throws When a base64 string cannot be decoded.
	 */
	public static bytesFieldToNumbers = (
		value: string | number[] | Uint8Array
	): number[] => {
		if (typeof value === "string") {
			return Array.from(fromBase64(value));
		}
		return Array.from(value);
	};

	/**
	 * Unwraps a nested Move struct out of JSON-RPC's `{ type, fields }` envelope.
	 *
	 * gRPC's `json` view returns nested structs bare, such as `{ value: "..." }`, where
	 * JSON-RPC returned
	 * `{ type: "0x2::balance::Supply<…>", fields: { value: "…" } }`. The `type`
	 * gRPC drops is not recoverable from the nested value itself; where a caster
	 * needs it, take it from the enclosing object's own type parameters via
	 * `Helpers.getObjectType`.
	 *
	 * Any non-null object with a `fields` property whose value is not `undefined`
	 * is unwrapped. Bare structs, primitives, `null`, and envelopes with an
	 * undefined `fields` value pass through unchanged.
	 *
	 * @param value - The bare struct or JSON-RPC-shaped envelope.
	 * @returns The nested fields or the original value.
	 */
	public static unwrapStructField = <T>(value: T | { fields: T }): T => {
		if (
			value !== null &&
			typeof value === "object" &&
			"fields" in value &&
			(value as { fields: T }).fields !== undefined
		) {
			return (value as { fields: T }).fields;
		}
		return value as T;
	};

	/**
	 * Reads a Move `UID` as a bare object id.
	 *
	 * gRPC's `json` view flattens `UID` to a plain string, where JSON-RPC nested
	 * it as `{ id: "0x…" }` (and, one level up, `{ id: { id: "0x…" } }`).
	 * The method recursively follows `id` properties until it reaches a string.
	 * It does not normalize the address or validate malformed runtime values.
	 *
	 * @param value - A bare ID or a one- or two-level UID envelope.
	 * @returns The extracted object ID.
	 */
	public static unwrapUid = (
		value: string | { id: string } | { id: { id: string } }
	): string => {
		if (typeof value === "string") {
			return value;
		}
		if (value !== null && typeof value === "object" && "id" in value) {
			return GrpcCasting.unwrapUid(value.id);
		}
		return value as unknown as string;
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Reads the transaction out of a gRPC `simulateTransaction` /
	 * `executeTransaction` result.
	 *
	 * The result is a `$kind`-discriminated union: a simulation that fails
	 * on-chain still returns effects, but under `FailedTransaction` rather
	 * than `Transaction`. Reading only the success arm silently drops the gas
	 * estimate exactly when the caller most needs it. The method returns the arm
	 * selected by `$kind` and does not clone or mutate the transaction result.
	 *
	 * @param result - The `$kind`-discriminated gRPC transaction result.
	 * @returns The successful or failed transaction arm.
	 */
	public static transactionFromResult = <
		Include extends SuiClientTypes.SimulateTransactionInclude,
	>(
		result: SuiClientTypes.SimulateTransactionResult<Include>
	): SuiClientTypes.Transaction<Include> =>
		result.$kind === "Transaction"
			? result.Transaction
			: result.FailedTransaction;

	// =========================================================================
	//  Bytes
	// =========================================================================

	/**
	 * Decodes a base64 string into BCS bytes.
	 *
	 * @param base64 - The base64-encoded byte string.
	 * @returns A new `Uint8Array` containing the decoded bytes.
	 * @throws When `base64` is not valid base64.
	 */
	public static bytesFromBase64 = (base64: string): Uint8Array =>
		fromBase64(base64);
}

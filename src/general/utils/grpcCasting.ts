import type { SuiClientTypes } from "@mysten/sui/client";
import type {
	CoinStruct,
	DisplayFieldsResponse,
	DynamicFieldInfo,
	SuiObjectResponse,
} from "@mysten/sui/jsonRpc";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

/**
 * The gRPC object view every `objectFromSuiObjectResponse` caster in this SDK
 * consumes: the object's identity/type plus its Move contents rendered as the
 * gRPC `json` view, plus its Display v2 output.
 *
 * ⚠️ **`include` is load-bearing.** gRPC returns `json` and `display` as
 * `undefined` unless the corresponding `include` flag was set on the request
 * (measured against both the Aftermath and public mainnet fullnodes). A caster
 * that starts reading a new part of the object must also widen the `include` at
 * the `ObjectsApiHelpers` call site that feeds it, or the field silently reads
 * `undefined` rather than erroring.
 *
 * `display` is typed as present because {@link Helpers.getObjectDisplay} throws
 * when it is missing — exactly as it did for JSON-RPC's optional
 * `data.display` — but the fetch helpers only request it when asked to, so do
 * not read it without having passed `withDisplay`.
 */
export type SuiObjectView = SuiClientTypes.Object<{
	json: true;
	display: true;
}>;

/**
 * Adapters from `SuiGrpcClient` response shapes onto the JSON-RPC-shaped types
 * this SDK exposes to its consumers.
 *
 * These exist so migrating the transport from `SuiJsonRpcClient` to
 * `SuiGrpcClient` stays **protocol-only**: same inputs, same outputs. Every
 * function here is a pure reshape — where gRPC genuinely cannot supply a field
 * that JSON-RPC did, that is called out in the function's docs rather than
 * silently faked with a plausible-looking value.
 */
export class GrpcCasting {
	// =========================================================================
	//  Coins
	// =========================================================================

	/**
	 * Reshapes a gRPC `Coin` into JSON-RPC's `CoinStruct`.
	 *
	 * Differences that callers may observe:
	 * - `coinType` is derived from the coin object's `type`
	 *   (`0x2::coin::Coin<T>` -> `T`) and is therefore fully zero-padded, where
	 *   JSON-RPC echoed the node's abbreviated form (e.g. `0x2::sui::SUI`).
	 *   Compare coin types through `Helpers.addLeadingZeroesToType` — as this
	 *   SDK already does everywhere — and the two are equal.
	 * - `previousTransaction` is **not returned by `listCoins`** and is set to
	 *   the empty string. Nothing in this SDK reads it. Fetch the object with
	 *   `include: { previousTransaction: true }` if you need it.
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
	 * Extracts `T` from a `0x2::coin::Coin<T>` object type. Returns the input
	 * unchanged when it is not a generic type.
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
	 * Reshapes a gRPC `DynamicFieldEntry` into JSON-RPC's `DynamicFieldInfo`.
	 *
	 * Field mapping (verified live against a real parent object):
	 * - `fieldId` -> `objectId`
	 * - `valueType` -> `objectType`
	 * - `$kind` -> `type` (`"DynamicField"` | `"DynamicObject"`)
	 * - `name.bcs` -> `bcsName` (base64), `bcsEncoding: "base64"`
	 *
	 * Differences that callers may observe:
	 * - `name.value` was the **parsed** field name under JSON-RPC. gRPC returns
	 *   only its BCS bytes and this SDK does not carry Move type layouts, so
	 *   `name.value` is the base64 of those bytes. `name.type` is unchanged.
	 * - `version` and `digest` are **not returned by `listDynamicFields`**.
	 *   They are omitted rather than zero-filled. Nothing in this SDK reads
	 *   them; fetch the field object if you need them.
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
	 * Builds a `SuiObjectResponse` carrying only the fields available from a
	 * gRPC `getObject({ include: { content: true } })` — enough for
	 * {@link Casting.castObjectBcs}, which reads `data.bcs.bcsBytes`.
	 *
	 * The BCS bytes gRPC returns under `content` were verified byte-identical
	 * to JSON-RPC's `bcs.bcsBytes` for every object probed (a `SuiSystemState`,
	 * three Aftermath pools and three `Coin<SUI>` objects).
	 *
	 * `hasPublicTransfer` is not returned by gRPC. It is omitted; nothing in
	 * this SDK reads it.
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
	 * Reshapes a gRPC `Display` into JSON-RPC's `DisplayFieldsResponse`, so the
	 * NFT/SuiFren display casters keep reading `.data` / `.error` unchanged.
	 *
	 * Two shape differences are reconciled here:
	 * - `output` values are typed `unknown` (Display v2 templates can render
	 *   structured JSON), where `data` was `Record<string, string>`. Non-string
	 *   values are dropped rather than stringified — a caster that assigned an
	 *   object into a `string` field would produce `"[object Object]"` in the UI.
	 * - `errors` is **per-field**, where `error` was whole-object. Surfacing a
	 *   single bad field as a whole-object error would blank out an NFT's entire
	 *   display, so `error` is only populated when `output` is absent entirely.
	 *   Per-field failures simply do not appear in `data`.
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
	 * a one-character **string**, so `Number(...)` of it is `NaN` — a silently
	 * wrong value rather than an error. Always route a byte vector through here.
	 *
	 * Total by design: a number array (or `Uint8Array`) passes through unchanged,
	 * so a caster that has been ported still works when handed a JSON-RPC-shaped
	 * fixture.
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
	 * gRPC's `json` view returns nested structs bare — `{ value: "…" }` where
	 * JSON-RPC returned
	 * `{ type: "0x2::balance::Supply<…>", fields: { value: "…" } }`. The `type`
	 * gRPC drops is not recoverable from the nested value itself; where a caster
	 * needs it, take it from the **enclosing object's** own type parameters via
	 * {@link Helpers.getObjectType}.
	 *
	 * Total by design: a bare struct passes through unchanged.
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
	 * Resolves either shape, recursively, so it is total across both protocols.
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
	 * The result is a `$kind`-discriminated union: a simulation that **fails
	 * on-chain** still returns effects, but under `FailedTransaction` rather
	 * than `Transaction`. Reading only the success arm silently drops the gas
	 * estimate exactly when the caller most needs it, so always go through
	 * this helper.
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

	/** Decodes base64 BCS bytes, for symmetry with {@link toBase64}. */
	public static bytesFromBase64 = (base64: string): Uint8Array =>
		fromBase64(base64);
}

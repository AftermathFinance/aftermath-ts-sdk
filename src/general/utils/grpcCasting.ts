import type { SuiClientTypes } from "@mysten/sui/client";
import type {
	CoinStruct,
	DynamicFieldInfo,
	SuiObjectResponse,
} from "@mysten/sui/jsonRpc";
import { fromBase64, toBase64 } from "@mysten/sui/utils";

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

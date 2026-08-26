import type { BcsType } from "@mysten/sui/bcs";
import type { SuiClientTypes } from "@mysten/sui/client";
import type { SuiObjectResponse } from "@mysten/sui/jsonRpc";
import type {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type {
	AnyObjectType,
	ObjectId,
	PackageId,
	SuiAddress,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting, type SuiObjectView } from "../utils/grpcCasting";
import { Helpers } from "../utils/helpers";

/**
 * What to ask gRPC for when fetching an object destined for a caster.
 *
 * ⚠️ **Load-bearing.** gRPC returns `json` and `display` as `undefined` unless
 * the flag is set — a missing flag surfaces as `undefined` downstream, not as an
 * error. A caster that starts reading a new part of the object must widen this.
 */
const casterInclude = (withDisplay?: boolean) =>
	({
		json: true,
		display: withDisplay === true,
	}) as { json: true; display: true };

/**
 * Fetches, paginates, casts, and builds transactions around Sui objects.
 *
 * Object reads use the configured `SuiGrpcClient` and therefore perform
 * network I/O unless a method is explicitly described as a local transaction
 * builder. gRPC object views expose JSON under `json`; request `withDisplay`
 * when a caster reads the object's Display output. The helper keeps the SDK's
 * JSON-RPC-shaped return types where the public API requires them and documents
 * the conversions on those methods.
 */
export class ObjectsApiHelpers {
	// =========================================================================
	//  Private Static Constants
	// =========================================================================

	private static readonly constants = {
		maxObjectFetchingLimit: 50,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an object helper for a configured `AftermathApi`.
	 *
	 * @param api - The API instance whose gRPC client performs object requests.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	/**
	 * Checks whether an object or package can be fetched from the gRPC fullnode.
	 *
	 * This method performs network I/O through `getObject`. It returns `false`
	 * for any fetch error, including a missing object and an unavailable node, so
	 * it does not distinguish absence from transport failure.
	 *
	 * @param objectId - The Sui object ID or published package ID to check.
	 * @returns `true` when `getObject` succeeds, otherwise `false`.
	 */
	public fetchDoesObjectExist = async (objectId: ObjectId | PackageId) => {
		// @dev: JSON-RPC answered a missing object with `{ error: { code:
		// "notExists" } }`; gRPC **throws**. Verified live against both the
		// Aftermath and public fullnodes.
		try {
			await this.api.client.getObject({ objectId });
			return true;
		} catch (_e) {
			return false;
		}
	};

	/**
	 * Checks whether an object is owned by an address owner or an object owner.
	 *
	 * The method performs network I/O by fetching the object through gRPC. It
	 * returns `false` when the object has no supported owner arm or when its
	 * owner differs from `walletAddress`.
	 *
	 * @param inputs - The object ID and wallet or parent-object address to
	 * compare with the object's owner.
	 * @returns `true` when either gRPC owner form equals `walletAddress`.
	 * @throws An `Error` when the object fetch fails.
	 */
	public fetchIsObjectOwnedByAddress = async (inputs: {
		objectId: ObjectId;
		walletAddress: SuiAddress;
	}) => {
		const { objectId, walletAddress } = inputs;

		const object = await this.fetchObject({ objectId });

		// @dev: gRPC's owner is a `$kind`-discriminated union carrying the same
		// `AddressOwner` / `ObjectOwner` keys JSON-RPC used, so the checks below
		// are unchanged — only the path to it is (`data.owner` -> `owner`).
		const objectOwner = object.owner;
		if (!objectOwner || typeof objectOwner !== "object") {
			return false;
		}

		if (
			"AddressOwner" in objectOwner &&
			objectOwner.AddressOwner === walletAddress
		) {
			return true;
		}
		if (
			"ObjectOwner" in objectOwner &&
			objectOwner.ObjectOwner === walletAddress
		) {
			return true;
		}

		return false;
	};

	/**
	 * Fetches all objects of one Move type owned by an address.
	 *
	 * This method performs paginated gRPC network I/O through
	 * `listOwnedObjects`. It is the typed wrapper around `fetchOwnedObjects` and
	 * uses the fixed object-type filter supplied in `objectType`. The helper
	 * always requests the JSON view and sets the display flag from
	 * `withDisplay`; the `include` field is accepted for compatibility but is
	 * not used to replace those caster flags.
	 *
	 * @param inputs - The owner address, exact Move object type, optional display
	 * request, and compatibility include value. `withDisplay` controls whether
	 * gRPC returns Display output.
	 * @returns All matching object views across every page.
	 * @throws Errors from the gRPC client.
	 */
	public fetchObjectsOfTypeOwnedByAddress = async (inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView[]> => {
		// @dev: JSON-RPC's `filter: { StructType }` becomes gRPC's `type`. The
		// leading-zero strip is gone: gRPC accepts the padded and the abbreviated
		// form and was measured to return identical results for both, including
		// inside generic parameters.
		return this.fetchOwnedObjects(inputs);
	};

	/**
	 * Fetches every object owned by an address, optionally filtered by Move type.
	 *
	 * The method performs paginated gRPC network I/O. Each request uses a limit
	 * of 50 objects and follows the returned cursor while `hasNextPage` is true.
	 * An empty page, a false `hasNextPage`, or a missing cursor ends pagination.
	 * The helper requests `json: true` and requests `display` only when
	 * `withDisplay` is `true`; the optional `include` value is not used to
	 * override these flags.
	 *
	 * @param inputs - The owner address, optional exact Move type filter, display
	 * flag, and compatibility include value.
	 * @returns All object views returned by the fullnode in page order.
	 * @throws Errors from the gRPC client.
	 */
	public fetchOwnedObjects = async (inputs: {
		walletAddress: SuiAddress;
		objectType?: AnyObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView[]> => {
		const { walletAddress, withDisplay, objectType } = inputs;

		let allObjectData: SuiObjectView[] = [];
		let cursor: string | null | undefined;
		do {
			// @dev: `res.data` -> `res.objects`, `res.nextCursor` -> `res.cursor`.
			// Neither rename is a typecheck or lint failure when botched — reading
			// `nextCursor` off this response yields `undefined`, which silently ends
			// pagination after the first page. Covered in `tests/grpcMigration.test.ts`.
			const paginatedObjects = await this.api.client.listOwnedObjects({
				owner: walletAddress,
				type: objectType,
				include: casterInclude(withDisplay),
				limit: ObjectsApiHelpers.constants.maxObjectFetchingLimit,
				cursor,
			});

			allObjectData = [...allObjectData, ...paginatedObjects.objects];

			if (
				paginatedObjects.objects.length === 0 ||
				!paginatedObjects.hasNextPage ||
				!paginatedObjects.cursor
			) {
				return allObjectData;
			}

			cursor = paginatedObjects.cursor;
		} while (true);
	};

	/**
	 * Fetches one object with the JSON view required by SDK casters.
	 *
	 * This method performs gRPC network I/O through `getObject`. It always asks
	 * for `json: true` and requests Display output only when `withDisplay` is
	 * `true`. The helper wraps a fullnode error in a new `Error` whose message
	 * starts with `an error occured fetching object:`.
	 *
	 * @param inputs - The object ID and optional Display flag.
	 * @returns The gRPC object view. A caster that reads Display fields requires
	 * `withDisplay: true`.
	 * @throws An `Error` when the fullnode cannot return the object.
	 */
	public fetchObject = async (inputs: {
		objectId: ObjectId;
		withDisplay?: boolean;
	}): Promise<SuiObjectView> => {
		const { objectId, withDisplay } = inputs;
		return await this.fetchObjectGeneral({
			objectId,
			include: casterInclude(withDisplay),
		});
	};

	/**
	 * Fetches one object with caller-selected gRPC include flags.
	 *
	 * This method performs gRPC network I/O through `getObject`. When `include`
	 * is omitted, it requests the JSON view and no Display output. Include flags
	 * that a caster reads must be present in the request; missing JSON or Display
	 * data is returned as `undefined` by gRPC rather than synthesized locally.
	 * Fullnode failures are wrapped in an `Error` with the same
	 * `an error occured fetching object:` prefix as `fetchObject`.
	 *
	 * @param inputs - The object ID and optional gRPC include flags.
	 * @returns The object view returned by gRPC.
	 * @throws An `Error` when the fullnode cannot return the object.
	 */
	public fetchObjectGeneral = async (inputs: {
		objectId: ObjectId;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView> => {
		const { objectId, include } = inputs;

		// @dev: JSON-RPC answered a missing object with `{ error: { code } }`;
		// gRPC **throws**. The message is rebuilt so callers that matched on the
		// old prefix keep working.
		try {
			const { object } = await this.api.client.getObject({
				objectId,
				include: (include ?? casterInclude()) as ReturnType<
					typeof casterInclude
				>,
			});
			return object as SuiObjectView;
		} catch (e) {
			throw new Error(
				`an error occured fetching object: ${e instanceof Error ? e.message : String(e)}`
			);
		}
	};

	/**
	 * Fetches one object and converts it with a caller-provided caster.
	 *
	 * The fetch performs gRPC network I/O through `fetchObject`. The caster runs
	 * locally after the request and receives the gRPC object view, not the old
	 * JSON-RPC `SuiObjectResponse` envelope.
	 *
	 * @param inputs - The object ID, caster, and optional Display flag.
	 * @returns The value produced by `objectFromSuiObjectResponse`.
	 * @throws Errors from the gRPC fetch or the caster.
	 */
	public fetchCastObject = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		withDisplay?: boolean;
	}): Promise<ObjectType> => {
		return inputs.objectFromSuiObjectResponse(await this.fetchObject(inputs));
	};

	/**
	 * Fetches one object with custom include flags and converts it with a caster.
	 *
	 * The fetch performs gRPC network I/O through `fetchObjectGeneral`. The
	 * caster runs locally and receives the gRPC object view returned by that
	 * method.
	 *
	 * @param inputs - The object ID, caster, and gRPC include flags.
	 * @returns The value produced by `objectFromSuiObjectResponse`.
	 * @throws Errors from the gRPC fetch or the caster.
	 */
	public fetchCastObjectGeneral = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<ObjectType> => {
		const { objectId, objectFromSuiObjectResponse, include } = inputs;
		return objectFromSuiObjectResponse(
			await this.fetchObjectGeneral({ objectId, include })
		);
	};

	/**
	 * Fetches objects in gRPC batches of at most 50 IDs.
	 *
	 * This method performs network I/O through `getObjects`. Requests run in
	 * parallel by batch. Each per-object `Error` arm is dropped, while a request
	 * failure for an entire batch rejects the method. When `include` is omitted,
	 * the helper requests `json: true` and sets `display` from `withDisplay`.
	 *
	 * @remarks gRPC's `getObjects` returns `(Object | Error)[]` — a **per-object
	 * error arm JSON-RPC's `multiGetObjects` did not have**, delivered as real
	 * `Error` instances. Those entries are dropped rather than handed to a caster:
	 * spreading one into `objectFromSuiObjectResponse` would throw deep inside the
	 * cast with a message that names neither the batch nor the missing id.
	 *
	 * This is a deliberate behaviour change and the more forgiving one. Previously
	 * a single missing object in a batch threw from inside the caster and lost the
	 * whole batch; now the surviving objects are returned. `nftsFromSuiObjects`
	 * already filtered its input, so the app-visible result is unchanged.
	 *
	 * @param inputs - The object IDs and optional gRPC include or Display flags.
	 * `objectIds` are split into requests of 50 IDs or fewer.
	 * @returns Successful object views in batch and server order. Missing or
	 * otherwise failed individual objects are absent from the result.
	 * @throws Errors when a batch request fails.
	 */
	public fetchObjectBatch = async (inputs: {
		objectIds: ObjectId[];
		include?: SuiClientTypes.ObjectInclude;
		withDisplay?: boolean;
	}): Promise<SuiObjectView[]> => {
		const { objectIds, include, withDisplay } = inputs;

		const objectIdsBatches: ObjectId[][] = [];
		let endIndex = 0;
		while (true) {
			const newEndIndex =
				endIndex + ObjectsApiHelpers.constants.maxObjectFetchingLimit;
			if (newEndIndex >= objectIds.length) {
				objectIdsBatches.push(objectIds.slice(endIndex, objectIds.length));
				break;
			}

			objectIdsBatches.push(objectIds.slice(endIndex, newEndIndex));

			endIndex = newEndIndex;
		}

		const objectBatches = await Promise.all(
			objectIdsBatches.map((batchIds) =>
				this.api.client.getObjects({
					objectIds: batchIds,
					include: (include ?? casterInclude(withDisplay)) as ReturnType<
						typeof casterInclude
					>,
				})
			)
		);

		return objectBatches.flatMap((batch) =>
			batch.objects.filter(
				(object): object is SuiObjectView => !(object instanceof Error)
			)
		);
	};

	/**
	 * Fetches an object batch and casts each successful object locally.
	 *
	 * The fetch performs parallel gRPC network I/O through `fetchObjectBatch`.
	 * Per-object errors dropped by that method never reach the caster.
	 *
	 * @param inputs - The object IDs, caster, and optional gRPC include or Display
	 * flags.
	 * @returns The caster output for each object returned by gRPC.
	 * @throws Errors from a batch request or the caster.
	 */
	public fetchCastObjectBatch = async <ObjectType>(inputs: {
		objectIds: ObjectId[];
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		include?: SuiClientTypes.ObjectInclude;
		withDisplay?: boolean;
	}): Promise<ObjectType[]> => {
		return (await this.fetchObjectBatch(inputs)).map((object) =>
			inputs.objectFromSuiObjectResponse(object)
		);
	};

	/**
	 * Fetches all owned objects of a Move type and casts them locally.
	 *
	 * The fetch performs paginated gRPC network I/O through
	 * `fetchObjectsOfTypeOwnedByAddress`. The caster receives each successful
	 * gRPC object view in page order.
	 *
	 * @param inputs - The owner address, exact Move type, caster, and optional
	 * Display or compatibility include flags.
	 * @returns The caster output for every matching owned object.
	 * @throws Errors from the gRPC client or the caster.
	 */
	public fetchCastObjectsOwnedByAddressOfType = async <ObjectType>(inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<ObjectType[]> => {
		return (await this.fetchObjectsOfTypeOwnedByAddress(inputs)).map((object) =>
			inputs.objectFromSuiObjectResponse(object)
		);
	};

	// =========================================================================
	//  BCS
	// =========================================================================

	/**
	 * Fetches an object's Move contents as BCS and reshapes the response to the
	 * SDK's JSON-RPC `SuiObjectResponse` type.
	 *
	 * This method performs gRPC network I/O through `getObject({ content: true })`.
	 * The returned BCS payload is base64 in `data.bcs.bcsBytes`; it is not a
	 * decoded JavaScript value. gRPC errors are wrapped in an `Error` whose
	 * message starts with `an error occured fetching object:`.
	 *
	 * @param objectId - The object ID to read.
	 * @returns A JSON-RPC-shaped response containing the object's identity, owner,
	 * Move type, version, and base64 BCS bytes.
	 * @throws An `Error` when the fullnode cannot return BCS content.
	 */
	public fetchObjectBcs = async (
		objectId: ObjectId
	): Promise<SuiObjectResponse> => {
		// @dev: `options: { showBcs: true }` -> `include: { content: true }`. The
		// bytes are the BCS of the object's Move struct in both protocols and were
		// verified byte-identical across a `SuiSystemState`, three Aftermath pools
		// and three `Coin<SUI>` objects. gRPC throws instead of returning
		// `{ error }`, so the error message is rebuilt here.
		try {
			const { object } = await this.api.client.getObject({
				objectId,
				include: { content: true },
			});
			return GrpcCasting.suiObjectResponseFromGrpcObjectBcs(object);
		} catch (e) {
			throw new Error(
				`an error occured fetching object: ${e instanceof Error ? e.message : String(e)}`
			);
		}
	};

	/**
	 * Fetches an object's BCS bytes and converts them with a caller-provided BCS
	 * type and deserializer.
	 *
	 * The method performs gRPC network I/O through `fetchObjectBcs`. It decodes
	 * the base64 payload with `bcsType.fromBase64` and then calls
	 * `fromDeserialized` locally.
	 *
	 * @example
	 * ```typescript
	 * import { bcs } from "@mysten/sui/bcs";
	 * import { AftermathApi } from "aftermath-ts-sdk";
	 *
	 * declare const api: AftermathApi;
	 * const objectId = "0x0000000000000000000000000000000000000000000000000000000000000002";
	 * const value = await api.Objects().fetchCastObjectBcs({
	 *	objectId,
	 *	bcsType: bcs.u64(),
	 *	fromDeserialized: (amount) => amount,
	 * });
	 * ```
	 *
	 * @param inputs - The object ID, BCS schema, and conversion callback. `U`
	 * is the value produced by `bcsType`; `T` is the public result.
	 * @returns The value returned by `fromDeserialized`.
	 * @throws Errors from the gRPC fetch, BCS decoding, or the conversion
	 * callback.
	 */
	public fetchCastObjectBcs = async <T, U>(inputs: {
		objectId: ObjectId;
		bcsType: BcsType<U>;
		fromDeserialized: (deserialized: U) => T;
	}): Promise<T> => {
		const { objectId } = inputs;
		const suiObjectResponse = await this.api.Objects().fetchObjectBcs(objectId);
		const { Casting } = await import("../utils/casting.js");
		return Casting.castObjectBcs({
			...inputs,
			suiObjectResponse,
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	/**
	 * Adds a transaction command that transfers an object to the zero address.
	 *
	 * This is a local transaction builder and performs no network I/O. It mutates
	 * `tx`; the caller must still set gas details, sign, and execute the returned
	 * transaction. The object is transferred to `0x0`, which is the SDK's burn
	 * destination.
	 *
	 * @param inputs - The transaction being built and the object argument to
	 * burn.
	 * @returns The transaction argument returned by `transferObjects`.
	 * @throws Errors from the Sui transaction builder when the object argument is
	 * invalid.
	 */
	public burnObjectTx = async (inputs: {
		tx: Transaction;
		object: TransactionObjectArgument;
	}): Promise<TransactionObjectArgument> => {
		const { tx, object } = inputs;

		return tx.transferObjects(
			[object],
			// not using constants because of strange build bug on frontend otherwise
			// tx.pure(Sui.constants.addresses.zero)
			"0x0"
		);
	};

	/**
	 * Adds a `0x2::transfer::public_share_object` Move call to a transaction.
	 *
	 * This is a local transaction builder and performs no network I/O. It mutates
	 * `tx`; the caller must sign and execute the transaction. `objectType` is
	 * passed as the call's single Move type argument.
	 *
	 * @param inputs - The transaction, object argument, and fully qualified Move
	 * type of the object.
	 * @returns The transaction argument returned by `moveCall`.
	 * @throws Errors from the Sui transaction builder when the object or type is
	 * invalid.
	 */
	public publicShareObjectTx = async (inputs: {
		tx: Transaction;
		object: TransactionObjectArgument;
		objectType: AnyObjectType;
	}): Promise<TransactionObjectArgument> => {
		const { tx, object, objectType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				// not using constants because of strange build bug on frontend otherwise
				// Sui.constants.addresses.suiPackageId,
				"0x2",
				"transfer",
				"public_share_object"
			),
			typeArguments: [objectType],
			arguments: [object],
		});
	};
}

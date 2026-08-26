import type { SuiClientTypes } from "@mysten/sui/client";
import type { DynamicFieldInfo } from "@mysten/sui/jsonRpc";
import type {
	AnyObjectType,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	DynamicFieldsWithCursor,
	ObjectId,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting, type SuiObjectView } from "../utils/grpcCasting";

/**
 * Reads and paginates Sui dynamic fields through the configured gRPC client.
 *
 * Methods that list fields perform network I/O through
 * `AftermathApi.client.listDynamicFields`. Casting methods also call the
 * caller-provided object loader for the field object IDs. Cursors are Sui
 * object IDs and `null` means that the server returned the last page.
 */
export class DynamicFieldsApiHelpers {
	// =========================================================================
	//  Private Static Constants
	// =========================================================================

	private static readonly constants = {
		defaultLimitStepSize: 256,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a dynamic-field helper for a configured `AftermathApi`.
	 *
	 * @param api - The API instance whose `SuiGrpcClient` performs the requests.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Dynamic Fields
	// =========================================================================

	/**
	 * Lists one page of dynamic fields, filters the page, and loads the matching
	 * field objects with the caller-provided caster or loader.
	 *
	 * The method performs gRPC network I/O for the field list and whatever I/O
	 * `objectsFromObjectIds` performs. Filtering happens after the gRPC page is
	 * fetched, so `nextCursor` advances past fields that do not match
	 * `dynamicFieldType`. The returned `dynamicFieldObjects` contains only the
	 * objects loaded from the matching field IDs in that page.
	 *
	 * @param inputs - The parent object, page options, optional type filter, and
	 * object loader. `limit` is a number of fields, not a byte size.
	 * @returns The loaded objects and the cursor for the next page. `nextCursor`
	 * is `null` when the gRPC service has no next page.
	 * @throws Errors from the gRPC client or `objectsFromObjectIds`.
	 */
	public fetchCastDynamicFieldsOfTypeWithCursor = async <ObjectType>(inputs: {
		parentObjectId: ObjectId;
		objectsFromObjectIds: (objectIds: ObjectId[]) => Promise<ObjectType[]>;
		dynamicFieldType?: AnyObjectType | ((objectType: AnyObjectType) => boolean);
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<ObjectType>> => {
		const { dynamicFields, nextCursor } =
			await this.fetchDynamicFieldsOfTypeWithCursor(inputs);

		const dynamicFieldObjectIds = dynamicFields.map((field) => field.objectId);
		const dynamicFieldObjects = await inputs.objectsFromObjectIds(
			dynamicFieldObjectIds
		);

		return {
			dynamicFieldObjects,
			nextCursor,
		};
	};

	/**
	 * Fetches every page of dynamic fields for a parent object and returns the
	 * fields that match the optional type filter.
	 *
	 * This method performs gRPC network I/O until it receives an empty page or a
	 * `null` cursor. It uses `limitStepSize` for every request and defaults to
	 * 256 fields per request. The result does not include a cursor because this
	 * method consumes the complete listing. When a type filter removes every
	 * field from a page, the implementation treats that filtered page as empty
	 * and stops even if the service returned another cursor.
	 *
	 * @param inputs - The parent object, optional type filter, and page size.
	 * @returns All matching `DynamicFieldInfo` values in page order.
	 * @throws Errors from `AftermathApi.client.listDynamicFields`.
	 */
	public fetchAllDynamicFieldsOfType = async (inputs: {
		parentObjectId: ObjectId;
		dynamicFieldType?: AnyObjectType | ((objectType: AnyObjectType) => boolean);
		limitStepSize?: number;
	}) => {
		let allDynamicFields: DynamicFieldInfo[] = [];
		let cursor: ObjectId | undefined;
		do {
			const dynamicFieldsWithCursor: DynamicFieldsWithCursor =
				await this.fetchDynamicFieldsOfTypeWithCursor({
					...inputs,
					cursor,
					limit:
						inputs.limitStepSize ??
						DynamicFieldsApiHelpers.constants.defaultLimitStepSize,
				});
			const dynamicFields = dynamicFieldsWithCursor.dynamicFields;
			allDynamicFields = [...allDynamicFields, ...dynamicFields];

			if (
				dynamicFields.length === 0 ||
				dynamicFieldsWithCursor.nextCursor === null
			) {
				return allDynamicFields;
			}
			cursor = dynamicFieldsWithCursor.nextCursor;
		} while (true);
	};

	/**
	 * Fetches every matching dynamic field and loads all field objects in one
	 * call to `objectsFromObjectIds`.
	 *
	 * The field listing performs gRPC network I/O. The loader receives the full
	 * list of IDs after pagination, so it can issue one batch request or apply a
	 * custom local mapping. `limitStepSize` controls each list request and
	 * defaults to 256 fields. It inherits the filtered-page stop behavior of
	 * `fetchAllDynamicFieldsOfType`.
	 *
	 * @param inputs - The parent object, object loader, optional type filter, and
	 * page size. The loader may return its result synchronously or as a promise.
	 * @returns The loaded objects in the order returned by the object loader.
	 * @throws Errors from the gRPC client or `objectsFromObjectIds`.
	 */
	public fetchCastAllDynamicFieldsOfType = async <ObjectType>(inputs: {
		parentObjectId: ObjectId;
		objectsFromObjectIds: (
			objectIds: ObjectId[]
		) => ObjectType[] | Promise<ObjectType[]>;
		dynamicFieldType?: AnyObjectType | ((objectType: AnyObjectType) => boolean);
		limitStepSize?: number;
	}) => {
		const dynamicFields = await this.fetchAllDynamicFieldsOfType(inputs);
		const dynamicFieldObjectIds = dynamicFields.map((field) => field.objectId);
		const dynamicFieldObjects = await inputs.objectsFromObjectIds(
			dynamicFieldObjectIds
		);
		return dynamicFieldObjects;
	};

	/**
	 * Repeatedly fetches dynamic-field objects until a caller-defined condition
	 * is met or the source is exhausted.
	 *
	 * This helper does not call a network client directly. `fetchFunc` decides
	 * whether each page comes from gRPC, JSON-RPC, or another source. Pages use
	 * `limitStepSize`, which defaults to 256. The method stops on an empty page,
	 * a `null` cursor, or the first page for which `isComplete` returns `true`.
	 * When the predicate stops the loop, the returned cursor still points to the
	 * first unprocessed page.
	 *
	 * @param inputs - The page fetcher, completion predicate, optional starting
	 * cursor, and page size.
	 * @returns All objects fetched so far and the cursor returned with the page
	 * that ended the loop.
	 * @throws Errors from `fetchFunc` or `isComplete`.
	 */
	public fetchDynamicFieldsUntil = async <ObjectType>(inputs: {
		fetchFunc: (
			dynamicFieldsInputs: DynamicFieldsInputs
		) => Promise<DynamicFieldObjectsWithCursor<ObjectType>>;
		isComplete: (dynamicFieldObjects: ObjectType[]) => boolean;
		cursor?: ObjectId;
		limitStepSize?: number;
	}): Promise<DynamicFieldObjectsWithCursor<ObjectType>> => {
		const { fetchFunc, isComplete, cursor, limitStepSize } = inputs;

		let allDynamicFields: ObjectType[] = [];
		let currentCursor = cursor ?? null;

		do {
			const dynamicFieldsWithCursor = await fetchFunc({
				cursor: currentCursor ?? undefined,
				limit:
					limitStepSize ??
					DynamicFieldsApiHelpers.constants.defaultLimitStepSize,
			});
			const fetchedDynamicFields = dynamicFieldsWithCursor.dynamicFieldObjects;
			const nextCursor = dynamicFieldsWithCursor.nextCursor;

			allDynamicFields = [...allDynamicFields, ...fetchedDynamicFields];

			if (fetchedDynamicFields.length === 0 || nextCursor === null) {
				return {
					dynamicFieldObjects: allDynamicFields,
					nextCursor,
				};
			}

			if (isComplete(allDynamicFields)) {
				return {
					dynamicFieldObjects: allDynamicFields,
					nextCursor,
				};
			}

			currentCursor = dynamicFieldsWithCursor.nextCursor;
		} while (true);
	};

	/**
	 * Lists one page of dynamic fields from the configured gRPC client.
	 *
	 * The method performs network I/O through `listDynamicFields` and reshapes
	 * each gRPC entry into the SDK's `DynamicFieldInfo` shape. The returned field
	 * name contains the original BCS bytes as base64 in `name.value` and
	 * `bcsName`; the SDK does not decode the Move field name. A type string is an
	 * exact comparison, while a predicate receives each field's `objectType`.
	 *
	 * @param inputs - The parent object, optional cursor, page limit, and type
	 * filter. `limit` is a number of fields. `cursor` is the last field object ID
	 * from the previous page.
	 * @returns A page of `DynamicFieldInfo` values and a nullable next cursor.
	 * @throws Errors from `AftermathApi.client.listDynamicFields`.
	 */
	public fetchDynamicFieldsOfTypeWithCursor = async (
		inputs: {
			parentObjectId: ObjectId;
			dynamicFieldType?:
				| AnyObjectType
				| ((objectType: AnyObjectType) => boolean);
		} & DynamicFieldsInputs
	): Promise<DynamicFieldsWithCursor> => {
		const { parentObjectId, dynamicFieldType } = inputs;

		// @dev: `getDynamicFields` -> `listDynamicFields`. `res.data` ->
		// `res.dynamicFields`, `res.nextCursor` -> `res.cursor`, and each entry is
		// reshaped by `GrpcCasting` (`fieldId` -> `objectId`, `valueType` ->
		// `objectType`).
		const dynamicFieldsResponse = await this.api.client.listDynamicFields({
			cursor: inputs.cursor,
			limit:
				inputs.limit ?? DynamicFieldsApiHelpers.constants.defaultLimitStepSize,
			parentId: parentObjectId,
		});

		const allDynamicFields = dynamicFieldsResponse.dynamicFields.map(
			GrpcCasting.dynamicFieldInfoFromGrpcEntry
		);

		const dynamicFields =
			dynamicFieldType === undefined
				? allDynamicFields
				: allDynamicFields.filter((dynamicField: DynamicFieldInfo) =>
						typeof dynamicFieldType === "string"
							? dynamicField.objectType === dynamicFieldType
							: dynamicFieldType(dynamicField.objectType)
					);

		const nextCursor = dynamicFieldsResponse.cursor;
		return {
			dynamicFields,
			nextCursor,
		};
	};

	// =========================================================================
	//  Dynamic Field Objects
	// =========================================================================

	/**
	 * Fetches the object stored in one dynamic object field.
	 *
	 * This method performs gRPC network I/O through
	 * `client.core.getDynamicObjectField` and requests both the JSON and display
	 * views required by object casters. The `name.bcs` value must contain the
	 * field name's BCS bytes. JSON-RPC callers cannot pass the parsed
	 * `{ type, value }` form here.
	 *
	 * @param inputs - The parent object ID and the Move-typed dynamic-field name.
	 * @returns The gRPC object view for the dynamic field value.
	 * @throws Errors from the gRPC client, including a missing field object.
	 *
	 * @remarks Ported to `client.core.getDynamicObjectField`.
	 *
	 * ⚠️ **Not** gRPC's `getDynamicField`, which is the obvious-looking target and
	 * the wrong one: it returns the field's value as `{ type, bcs }` only — no
	 * `json` view and no `objectId` — so it cannot feed an object caster.
	 * `getDynamicObjectField` returns `{ object }` in the same shape as
	 * `getObject`, which can. (It lives on `client.core`, not on the client root,
	 * which is why an earlier pass recorded it as unavailable.)
	 *
	 * The return type changes from `SuiObjectResponse` to {@link SuiObjectView},
	 * in step with every other object fetcher here. This helper has **zero
	 * internal callers**, so nothing inside the SDK is affected.
	 */
	public fetchDynamicFieldObject = async (inputs: {
		parentId: ObjectId;
		/**
		 * ⚠️ gRPC's `DynamicFieldName` requires the name's **BCS bytes**
		 * (`{ type, bcs }`) where JSON-RPC's took its parsed JSON value
		 * (`{ type, value }`). The SDK does not carry Move type layouts, so it
		 * cannot convert one to the other — callers must supply the bytes. Both
		 * `listDynamicFields` and `GrpcCasting.dynamicFieldInfoFromGrpcEntry`
		 * expose them (as `bcsName`, base64).
		 */
		name: SuiClientTypes.DynamicFieldName;
	}): Promise<SuiObjectView> => {
		const { object } = await this.api.client.core.getDynamicObjectField({
			parentId: inputs.parentId,
			name: inputs.name,
			include: { json: true, display: true },
		});
		return object;
	};
}

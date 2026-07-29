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

	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Dynamic Fields
	// =========================================================================

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

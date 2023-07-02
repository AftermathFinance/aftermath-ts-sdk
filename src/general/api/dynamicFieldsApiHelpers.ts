import { DynamicFieldInfo, ObjectId } from "@mysten/sui.js";
import {
	AnyObjectType,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsInputs,
	DynamicFieldsWithCursor,
} from "../../types";
import { AftermathApi } from "../providers/aftermathApi";

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

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchCastDynamicFieldsOfTypeWithCursor = async <ObjectType>(inputs: {
		parentObjectId: ObjectId;
		objectsFromObjectIds: (objectIds: ObjectId[]) => Promise<ObjectType[]>;
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean);
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<ObjectType>> => {
		const { dynamicFields, nextCursor } =
			await this.fetchDynamicFieldsOfTypeWithCursor(inputs);

		const dynamicFieldObjectIds = dynamicFields.map(
			(field) => field.objectId
		);
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
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean);
		limitStepSize?: number;
	}) => {
		let allDynamicFields: DynamicFieldInfo[] = [];
		let cursor: ObjectId | undefined = undefined;
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
			)
				return allDynamicFields;
			cursor = dynamicFieldsWithCursor.nextCursor;
		} while (true);
	};

	public fetchCastAllDynamicFieldsOfType = async <ObjectType>(inputs: {
		parentObjectId: ObjectId;
		objectsFromObjectIds: (
			objectIds: ObjectId[]
		) => ObjectType[] | Promise<ObjectType[]>;
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean);
		limitStepSize?: number;
	}) => {
		const dynamicFields = await this.fetchAllDynamicFieldsOfType(inputs);
		const dynamicFieldObjectIds = dynamicFields.map(
			(field) => field.objectId
		);
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
			const fetchedDynamicFields =
				dynamicFieldsWithCursor.dynamicFieldObjects;
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

		const dynamicFieldsResponse =
			await this.Provider.provider.getDynamicFields({
				...inputs,
				limit:
					inputs.limit ??
					DynamicFieldsApiHelpers.constants.defaultLimitStepSize,
				parentId: parentObjectId,
			});

		const dynamicFields =
			dynamicFieldType === undefined
				? dynamicFieldsResponse.data
				: dynamicFieldsResponse.data.filter((dynamicField) =>
						typeof dynamicFieldType === "string"
							? dynamicField.objectType === dynamicFieldType
							: dynamicFieldType(dynamicField.objectType)
				  );

		const nextCursor = dynamicFieldsResponse.nextCursor;
		return {
			dynamicFields,
			nextCursor,
		};
	};
}

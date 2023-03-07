import { ObjectId } from "@mysten/sui.js";
import {
	AnyObjectType,
	DynamicField,
	DynamicFieldObjectsWithCursor,
	DynamicFieldsWithCursor,
} from "../../types";
import { AftermathApi } from "../providers/aftermathApi";

export class DynamicFieldsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchCastDynamicFieldsOfTypeWithCursor = async <ObjectType>(
		parentObjectId: ObjectId,
		objectsFromObjectIds: (objectIds: ObjectId[]) => Promise<ObjectType[]>,
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean),
		cursor?: ObjectId,
		limit?: number
	) => {
		const { dynamicFields, nextCursor } =
			await this.fetchDynamicFieldsOfTypeWithCursor(
				parentObjectId,
				dynamicFieldType,
				cursor,
				limit
			);

		const dynamicFieldObjectIds = dynamicFields.map(
			(field) => field.objectId
		);
		const dynamicFieldObjects = await objectsFromObjectIds(
			dynamicFieldObjectIds
		);

		return {
			dynamicFieldObjects,
			nextCursor,
		} as DynamicFieldObjectsWithCursor<ObjectType>;
	};

	public fetchAllDynamicFieldsOfType = async (
		parentObjectId: ObjectId,
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean),
		limitStepSize: number = 500
	) => {
		let allDynamicFields: DynamicField[] = [];
		let cursor: ObjectId | undefined = undefined;
		do {
			const dynamicFieldsWithCursor: DynamicFieldsWithCursor =
				await this.fetchDynamicFieldsOfTypeWithCursor(
					parentObjectId,
					dynamicFieldType,
					cursor,
					limitStepSize
				);
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

	public fetchCastAllDynamicFieldsOfType = async <ObjectType>(
		parentObjectId: ObjectId,
		objectsFromObjectIds: (objectIds: ObjectId[]) => Promise<ObjectType[]>,
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean),
		limitStepSize: number = 500
	) => {
		const dynamicFields = await this.fetchAllDynamicFieldsOfType(
			parentObjectId,
			dynamicFieldType,
			limitStepSize
		);
		const dynamicFieldObjectIds = dynamicFields.map(
			(field) => field.objectId
		);
		const dynamicFieldObjects = await objectsFromObjectIds(
			dynamicFieldObjectIds
		);
		return dynamicFieldObjects;
	};

	public fetchDynamicFieldsUntil = async <ObjectType>(
		fetchFunc: (
			cursor?: ObjectId,
			limit?: number
		) => Promise<DynamicFieldObjectsWithCursor<ObjectType>>,
		isComplete: (dynamicFieldObjects: ObjectType[]) => boolean,
		cursor?: ObjectId,
		limitStepSize: number = 500
	): Promise<DynamicFieldObjectsWithCursor<ObjectType>> => {
		let allDynamicFields: ObjectType[] = [];
		let currentCursor = cursor ?? null;

		do {
			const dynamicFieldsWithCursor = await fetchFunc(
				currentCursor ?? undefined,
				limitStepSize
			);
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
		parentObjectId: ObjectId,
		dynamicFieldType?:
			| AnyObjectType
			| ((objectType: AnyObjectType) => boolean),
		cursor?: ObjectId,
		limit?: number
	) => {
		const dynamicFieldsResponse =
			await this.Provider.provider.getDynamicFields(
				parentObjectId,
				cursor,
				limit
			);

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
		} as DynamicFieldsWithCursor;
	};
}

import {
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	getObjectOwner,
} from "@mysten/sui.js";
import { AftermathApi } from "../providers/aftermathApi";
import { AnyObjectType, PackageId } from "../../types";

export class ObjectsApiHelpers {
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

	public fetchDoesObjectExist = async (objectId: ObjectId | PackageId) => {
		const object = await this.Provider.provider.getObject({ id: objectId });
		return object.error === undefined;
	};

	public fetchIsObjectOwnedByAddress = async (
		objectId: ObjectId,
		address: SuiAddress
	) => {
		const object = await this.fetchObject(objectId);
		const objectOwner = getObjectOwner(object);

		if (!objectOwner || typeof objectOwner !== "object") return false;

		if (
			"AddressOwner" in objectOwner &&
			objectOwner.AddressOwner === address
		)
			return true;
		if ("ObjectOwner" in objectOwner && objectOwner.ObjectOwner === address)
			return true;

		return false;
	};

	public fetchObjectsOfTypeOwnedByAddress = async (
		walletAddress: SuiAddress,
		objectType: AnyObjectType
	): Promise<SuiObjectResponse[]> => {
		const objectsOwnedByAddress =
			await this.Provider.provider.getOwnedObjects({
				owner: walletAddress,
				filter: {
					StructType: objectType,
				},
			});

		return objectsOwnedByAddress.data;
	};

	public fetchObject = async (
		objectId: ObjectId
	): Promise<SuiObjectResponse> => {
		const object = await this.Provider.provider.getObject({
			id: objectId,
			options: {
				showContent: true,
				// showDisplay: true,
				showOwner: true,
				showType: true,
			},
		});
		if (object.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${object.error?.tag}`
			);
		return object;
	};

	public fetchCastObject = async <ObjectType>(
		objectId: ObjectId,
		castFunc: (SuiObjectResponse: SuiObjectResponse) => ObjectType
	): Promise<ObjectType> => {
		return castFunc(await this.fetchObject(objectId));
	};

	public fetchObjectBatch = async (
		objectIds: ObjectId[]
	): Promise<SuiObjectResponse[]> => {
		const objectBatch = await this.Provider.provider.multiGetObjects({
			ids: objectIds,
			options: {
				showContent: true,
				// showDisplay: true,
				showOwner: true,
				showType: true,
			},
		});
		// const objectDataResponses = objectBatch.filter(
		// 	(data) => data.error !== undefined
		// );

		if (objectBatch.length <= 0)
			throw new Error("no existing objects found with fetchObjectBatch");
		// REVIEW: throw error on any objects that don't exist ?
		// or don't throw any errors and return empty array ?
		return objectBatch;
	};

	public fetchCastObjectBatch = async <ObjectType>(
		objectIds: ObjectId[],
		objectFromSuiObjectResponse: (data: SuiObjectResponse) => ObjectType
	): Promise<ObjectType[]> => {
		return (await this.fetchObjectBatch(objectIds)).map(
			(SuiObjectResponse: SuiObjectResponse) => {
				return objectFromSuiObjectResponse(SuiObjectResponse);
			}
		);
	};

	public fetchCastObjectsOwnedByAddressOfType = async <ObjectType>(
		walletAddress: SuiAddress,
		objectType: AnyObjectType,
		objectFromSuiObjectResponse: (
			SuiObjectResponse: SuiObjectResponse
		) => ObjectType
	): Promise<ObjectType[]> => {
		// i. obtain all owned object IDs
		const objects = (
			await this.fetchObjectsOfTypeOwnedByAddress(
				walletAddress,
				objectType
			)
		).map((SuiObjectResponse: SuiObjectResponse) => {
			return objectFromSuiObjectResponse(SuiObjectResponse);
		});

		return objects;
	};
}

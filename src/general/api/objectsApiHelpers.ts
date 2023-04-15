import {
	DisplayFieldsResponse,
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	getObjectDisplay,
	getObjectOwner,
} from "@mysten/sui.js";
import { AftermathApi } from "../providers/aftermathApi";
import { AnyObjectType, NftDisplay, PackageId } from "../../types";

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
		objectType: AnyObjectType,
		withDisplay?: boolean
	): Promise<SuiObjectResponse[]> => {
		const objectsOwnedByAddress =
			await this.Provider.provider.getOwnedObjects({
				owner: walletAddress,
				filter: {
					StructType: objectType,
				},
				options: {
					showContent: true,
					showDisplay: withDisplay,
					showOwner: true,
					showType: true,
				},
			});

		return objectsOwnedByAddress.data;
	};

	public fetchObject = async (
		objectId: ObjectId,
		withDisplay?: boolean
	): Promise<SuiObjectResponse> => {
		const object = await this.Provider.provider.getObject({
			id: objectId,
			options: {
				showContent: true,
				showDisplay: withDisplay,
				showOwner: true,
				showType: true,
			},
		});
		if (object.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${object.error.error}`
			);
		return object;
	};

	public fetchCastObject = async <ObjectType>(
		objectId: ObjectId,
		castFunc: (SuiObjectResponse: SuiObjectResponse) => ObjectType,
		withDisplay?: boolean
	): Promise<ObjectType> => {
		return castFunc(await this.fetchObject(objectId, withDisplay));
	};

	public fetchObjectBatch = async (
		objectIds: ObjectId[],
		withDisplay?: boolean
	): Promise<SuiObjectResponse[]> => {
		const objectBatch = await this.Provider.provider.multiGetObjects({
			ids: objectIds,
			options: {
				showContent: true,
				showDisplay: withDisplay,
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
		objectFromSuiObjectResponse: (data: SuiObjectResponse) => ObjectType,
		withDisplay?: boolean
	): Promise<ObjectType[]> => {
		return (await this.fetchObjectBatch(objectIds, withDisplay)).map(
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
		) => ObjectType,
		withDisplay?: boolean
	): Promise<ObjectType[]> => {
		// i. obtain all owned object IDs
		const objects = (
			await this.fetchObjectsOfTypeOwnedByAddress(
				walletAddress,
				objectType,
				withDisplay
			)
		).map((SuiObjectResponse: SuiObjectResponse) => {
			return objectFromSuiObjectResponse(SuiObjectResponse);
		});

		return objects;
	};
}

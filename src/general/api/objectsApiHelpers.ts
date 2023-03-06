import {
	GetObjectDataResponse,
	ObjectId,
	SuiAddress,
	SuiObjectInfo,
	getObjectOwner,
} from "@mysten/sui.js";
import { RpcProvider } from "../providers/rpcProvider";
import { PackageId } from "../../types";

export class ObjectsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly rpcProvider: RpcProvider) {
		this.rpcProvider = rpcProvider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchDoesObjectExist = async (
		address: ObjectId | SuiAddress | PackageId
	) => {
		const object = await this.rpcProvider.provider.getObject(address);
		return ObjectsApiHelpers.objectExists(object);
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

	public fetchObjectsOwnedByAddress = async (
		walletAddress: SuiAddress,
		filter?: (suiObjectInfo: SuiObjectInfo) => boolean
	): Promise<SuiObjectInfo[]> => {
		const objectsOwnedByAddress =
			await this.rpcProvider.provider.getObjectsOwnedByAddress(
				walletAddress
			);

		return filter
			? objectsOwnedByAddress.filter((object) => filter(object))
			: objectsOwnedByAddress;
	};

	public fetchObject = async (
		objectId: ObjectId
	): Promise<GetObjectDataResponse> => {
		const object = await this.rpcProvider.provider.getObject(objectId);
		if (object.status !== "Exists")
			throw new Error("object does not exist");
		return object;
	};

	public fetchCastObject = async <ObjectType>(
		objectId: ObjectId,
		castFunc: (getObjectDataResponse: GetObjectDataResponse) => ObjectType
	): Promise<ObjectType> => {
		return castFunc(await this.fetchObject(objectId));
	};

	public fetchObjectBatch = async (
		objectIds: ObjectId[]
	): Promise<GetObjectDataResponse[]> => {
		const objectBatch = await this.rpcProvider.provider.getObjectBatch(
			objectIds
		);
		const objectDataResponses = objectBatch.filter(
			(data) => data.status === "Exists"
		);

		if (objectDataResponses.length <= 0)
			throw new Error("no existing objects found with fetchObjectBatch");
		// REVIEW: throw error on any objects that don't exist ?
		// or don't throw any errors and return empty array ?
		return objectDataResponses;
	};

	public fetchCastObjectBatch = async <ObjectType>(
		objectIds: ObjectId[],
		objectFromGetObjectDataResponse: (
			getObjectDataResponse: GetObjectDataResponse
		) => ObjectType
	): Promise<ObjectType[]> => {
		return (await this.rpcProvider.provider.getObjectBatch(objectIds)).map(
			(getObjectDataResponse: GetObjectDataResponse) => {
				return objectFromGetObjectDataResponse(getObjectDataResponse);
			}
		);
	};

	public fetchFilterAndCastObjectBatch = async <ObjectType>(
		objectIds: ObjectId[],
		filterGetObjectDataResponse: (data: GetObjectDataResponse) => boolean,
		objectFromGetObjectDataResponse: (
			data: GetObjectDataResponse
		) => ObjectType
	): Promise<ObjectType[]> => {
		return (await this.rpcProvider.provider.getObjectBatch(objectIds))
			.filter((data) => filterGetObjectDataResponse(data))
			.map((getObjectDataResponse: GetObjectDataResponse) => {
				return objectFromGetObjectDataResponse(getObjectDataResponse);
			});
	};

	public fetchFilterAndCastObjectsOwnedByAddress = async <ObjectType>(
		walletAddress: SuiAddress,
		filter: (suiObjectInfo: SuiObjectInfo) => boolean,
		fetchObjectsFromObjectIds: (
			objectIds: ObjectId[]
		) => Promise<ObjectType[]>
	): Promise<ObjectType[]> => {
		// i. obtain all owned object IDs
		const objectIds = (
			await this.fetchObjectsOwnedByAddress(walletAddress, filter)
		).map((suiObjectInfo) => suiObjectInfo.objectId);

		// ii. obtain a object from each ObjectId
		const objects = fetchObjectsFromObjectIds(objectIds);

		return objects;
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static objectExists = (data: GetObjectDataResponse) =>
		data.status === "Exists";
}

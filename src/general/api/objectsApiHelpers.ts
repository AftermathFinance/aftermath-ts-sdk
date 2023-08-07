import { BCS, TypeName } from "@mysten/bcs";
import {
	ObjectId,
	SuiAddress,
	SuiObjectDataOptions,
	SuiObjectResponse,
	getObjectOwner,
    SuiRawMoveObject,
} from "@mysten/sui.js";
import { AftermathApi } from "../providers/aftermathApi";
import { AnyObjectType, PackageId } from "../../types";
import { Helpers } from "../utils";

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

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchDoesObjectExist = async (objectId: ObjectId | PackageId) => {
		const object = await this.Provider.provider.getObject({ id: objectId });
		return object.error === undefined;
	};

	public fetchIsObjectOwnedByAddress = async (inputs: {
		objectId: ObjectId;
		walletAddress: SuiAddress;
	}) => {
		const { objectId, walletAddress } = inputs;

		const object = await this.fetchObject({ objectId });
		const objectOwner = getObjectOwner(object);

		if (!objectOwner || typeof objectOwner !== "object") return false;

		if (
			"AddressOwner" in objectOwner &&
			objectOwner.AddressOwner === walletAddress
		)
			return true;
		if (
			"ObjectOwner" in objectOwner &&
			objectOwner.ObjectOwner === walletAddress
		)
			return true;

		return false;
	};

	public fetchObjectsOfTypeOwnedByAddress = async (inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		withDisplay?: boolean;
	}): Promise<SuiObjectResponse[]> => {
		const { walletAddress, objectType, withDisplay } = inputs;

		// TODO: handle pagination to make sure that ALL owned objects are found !
		const objectsOwnedByAddress =
			await this.Provider.provider.getOwnedObjects({
				owner: walletAddress,
				filter: {
					StructType: Helpers.stripLeadingZeroesFromType(objectType),
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

	public fetchObject = async (inputs: {
		objectId: ObjectId;
		withDisplay?: boolean;
	}): Promise<SuiObjectResponse> => {
		const { objectId, withDisplay } = inputs;

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

	public fetchCastObject = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (
			SuiObjectResponse: SuiObjectResponse
		) => ObjectType;
		withDisplay?: boolean;
	}): Promise<ObjectType> => {
		return inputs.objectFromSuiObjectResponse(
			await this.fetchObject(inputs)
		);
	};

	public fetchObjectBcs = async (
		objectId: ObjectId
	): Promise<SuiObjectResponse> => {
		const objectResponse = await this.Provider.provider.getObject({
			id: objectId,
			options: { showBcs: true },
		});
		if (objectResponse.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${objectResponse.error.error}`
			);
		return objectResponse;
	};

	public fetchObjectBatch = async (inputs: {
		objectIds: ObjectId[];
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		const { objectIds, options } = inputs;

		let objectIdsBatches: ObjectId[][] = [];
		let endIndex = 0;
		while (true) {
			const newEndIndex =
				endIndex + ObjectsApiHelpers.constants.maxObjectFetchingLimit;
			if (newEndIndex >= objectIds.length) {
				objectIdsBatches.push(
					objectIds.slice(endIndex, objectIds.length)
				);
				break;
			}

			objectIdsBatches.push(objectIds.slice(endIndex, newEndIndex));

			endIndex = newEndIndex;
		}

		const objectBatches = await Promise.all(
			objectIdsBatches.map((objectIds) =>
				this.Provider.provider.multiGetObjects({
					ids: objectIds,
					options:
						options === undefined
							? {
									showContent: true,
									showOwner: true,
									showType: true,
							  }
							: options,
				})
			)
		);
		const objectBatch = objectBatches.reduce(
			(acc, objects) => [...acc, ...objects],
			[]
		);

		// const objectDataResponses = objectBatch.filter(
		// 	(data) => data.error !== undefined
		// );

		// REVIEW: throw error on any objects that don't exist ?
		// or don't throw any errors and return empty array ?
		return objectBatch;
	};

	public fetchCastObjectBatch = async <ObjectType>(inputs: {
		objectIds: ObjectId[];
		objectFromSuiObjectResponse: (data: SuiObjectResponse) => ObjectType;
		options?: SuiObjectDataOptions;
	}): Promise<ObjectType[]> => {
		return (await this.fetchObjectBatch(inputs)).map(
			(SuiObjectResponse: SuiObjectResponse) => {
				return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
			}
		);
	};

	public fetchCastObjectsOwnedByAddressOfType = async <ObjectType>(inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		objectFromSuiObjectResponse: (
			SuiObjectResponse: SuiObjectResponse
		) => ObjectType;
		withDisplay?: boolean;
	}): Promise<ObjectType[]> => {
		// i. obtain all owned object IDs
		const objects = (
			await this.fetchObjectsOfTypeOwnedByAddress(inputs)
		).map((SuiObjectResponse: SuiObjectResponse) => {
			return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
		});

		return objects;
	};
}

import { AftermathApi } from "../providers/aftermathApi";
import { AnyObjectType, ObjectId, PackageId, SuiAddress } from "../../types";
import { Casting, Helpers } from "../utils";
import { SuiObjectDataOptions, SuiObjectResponse } from "@mysten/sui.js/client";
import { TypeName, BCS } from "@mysten/bcs";

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

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchDoesObjectExist = async (objectId: ObjectId | PackageId) => {
		const object = await this.Provider.AfSdk.getObject({ id: objectId });
		return object.error === undefined;
	};

	public fetchIsObjectOwnedByAddress = async (inputs: {
		objectId: ObjectId;
		walletAddress: SuiAddress;
	}) => {
		const { objectId, walletAddress } = inputs;

		const object = await this.fetchObject({ objectId });

		const objectOwner = object.data?.owner;
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
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		const { walletAddress, objectType, withDisplay } = inputs;

		// TODO: handle pagination to make sure that ALL owned objects are found !
		const objectsOwnedByAddress =
			await this.Provider.AfSdk.getOwnedObjects({
				owner: walletAddress,
				filter: {
					StructType: Helpers.stripLeadingZeroesFromType(objectType),
				},
				options: inputs.options ?? {
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
		return await this.fetchObjectGeneral({
			objectId,
			options: {
				showContent: true,
				showDisplay: withDisplay,
				showOwner: true,
				showType: true,
			},
		});
	};

	public fetchObjectGeneral = async (inputs: {
		objectId: ObjectId;
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse> => {
		const { objectId, options } = inputs;

		const object = await this.Provider.AfSdk.getObject({
			id: objectId,
			options,
		});
		if (object.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${object.error?.code}`
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

	public fetchCastObjectGeneral = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (
			SuiObjectResponse: SuiObjectResponse
		) => ObjectType;
		options?: SuiObjectDataOptions;
	}): Promise<ObjectType> => {
		const { objectId, objectFromSuiObjectResponse, options } = inputs;
		return objectFromSuiObjectResponse(
			await this.fetchObjectGeneral({ objectId, options })
		);
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
				this.Provider.AfSdk.multiGetObjects({
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
		options?: SuiObjectDataOptions;
	}): Promise<ObjectType[]> => {
		// i. obtain all owned object IDs
		const objects = (
			await this.fetchObjectsOfTypeOwnedByAddress(inputs)
		).map((SuiObjectResponse: SuiObjectResponse) => {
			return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
		});

		return objects;
	};

	// =========================================================================
	//  BCS
	// =========================================================================

	public fetchObjectBcs = async (
		objectId: ObjectId
	): Promise<SuiObjectResponse> => {
		const objectResponse = await this.Provider.AfSdk.getObject({
			id: objectId,
			options: { showBcs: true },
		});
		if (objectResponse.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${objectResponse.error?.code}`
			);
		return objectResponse;
	};

	public fetchCastObjectBcs = async <T>(inputs: {
		objectId: ObjectId;
		typeName: TypeName;
		fromDeserialized: (deserialized: any) => T;
		bcs: BCS;
	}): Promise<T> => {
		const { objectId } = inputs;
		const suiObjectResponse = await this.Provider.Objects().fetchObjectBcs(
			objectId
		);
		return Casting.castObjectBcs({
			...inputs,
			suiObjectResponse: suiObjectResponse,
		});
	};
}

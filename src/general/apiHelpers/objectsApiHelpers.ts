import { AftermathApi } from "../providers/aftermathApi";
import { AnyObjectType, ObjectId, PackageId, SuiAddress } from "../../types";
import { Casting, Helpers } from "../utils";
import {
	SuiObjectDataFilter,
	SuiObjectDataOptions,
	SuiObjectResponse,
} from "@mysten/sui/client";
import { BcsTypeName } from "../types/castingTypes";
import { TransactionObjectArgument } from "@scallop-io/sui-kit";
import { Transaction } from "@mysten/sui/transactions";
import { BcsType } from "@mysten/sui/bcs";

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
		const object = await this.Provider.provider.getObject({ id: objectId });
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
		return this.fetchOwnedObjects({
			...inputs,
			filter: {
				StructType: Helpers.stripLeadingZeroesFromType(
					inputs.objectType
				),
			},
		});
	};

	public fetchOwnedObjects = async (inputs: {
		walletAddress: SuiAddress;
		filter?: SuiObjectDataFilter;
		withDisplay?: boolean;
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		const { walletAddress, withDisplay, filter } = inputs;

		let allObjectData: SuiObjectResponse[] = [];
		let cursor: string | undefined = undefined;
		do {
			const paginatedObjects =
				await this.Provider.provider.getOwnedObjects({
					owner: walletAddress,
					options: inputs.options ?? {
						showContent: true,
						showDisplay: withDisplay,
						showOwner: true,
						showType: true,
					},
					limit: ObjectsApiHelpers.constants.maxObjectFetchingLimit,
					cursor,
					filter,
				});

			const objectData = paginatedObjects.data;
			allObjectData = [...allObjectData, ...objectData];

			if (
				paginatedObjects.data.length === 0 ||
				!paginatedObjects.hasNextPage ||
				!paginatedObjects.nextCursor
			)
				return allObjectData;

			cursor = paginatedObjects.nextCursor;
		} while (true);
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

		const object = await this.Provider.provider.getObject({
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
		options?: SuiObjectDataOptions;
	}): Promise<ObjectType[]> => {
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
		const objectResponse = await this.Provider.provider.getObject({
			id: objectId,
			options: { showBcs: true },
		});
		if (objectResponse.error !== undefined)
			throw new Error(
				`an error occured fetching object: ${objectResponse.error?.code}`
			);
		return objectResponse;
	};

	public fetchCastObjectBcs = async <T, U>(inputs: {
		objectId: ObjectId;
		bcsType: BcsType<U>;
		fromDeserialized: (deserialized: U) => T;
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

	// =========================================================================
	//  Transactions
	// =========================================================================

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

import type { BcsType } from "@mysten/sui/bcs";
import type {
	SuiObjectDataFilter,
	SuiObjectDataOptions,
	SuiObjectResponse,
} from "@mysten/sui/jsonRpc";
import type {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type {
	AnyObjectType,
	ObjectId,
	PackageId,
	SuiAddress,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting } from "../utils/grpcCasting";
import { Helpers } from "../utils/helpers";

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

	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchDoesObjectExist = async (objectId: ObjectId | PackageId) => {
		// @dev: JSON-RPC answered a missing object with `{ error: { code:
		// "notExists" } }`; gRPC **throws**. Verified live against both the
		// Aftermath and public fullnodes.
		try {
			await this.api.client.getObject({ objectId });
			return true;
		} catch (_e) {
			return false;
		}
	};

	public fetchIsObjectOwnedByAddress = async (inputs: {
		objectId: ObjectId;
		walletAddress: SuiAddress;
	}) => {
		const { objectId, walletAddress } = inputs;

		const object = await this.fetchObject({ objectId });

		const objectOwner = object.data?.owner;
		if (!objectOwner || typeof objectOwner !== "object") {
			return false;
		}

		if (
			"AddressOwner" in objectOwner &&
			objectOwner.AddressOwner === walletAddress
		) {
			return true;
		}
		if (
			"ObjectOwner" in objectOwner &&
			objectOwner.ObjectOwner === walletAddress
		) {
			return true;
		}

		return false;
	};

	/**
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. gRPC's `listOwnedObjects` cannot supply
	 * the parsed `content.fields` view every `objectFromSuiObjectResponse` caster
	 * consumes.
	 */
	public fetchObjectsOfTypeOwnedByAddress = async (inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		withDisplay?: boolean;
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		return this.fetchOwnedObjects({
			...inputs,
			filter: {
				StructType: Helpers.stripLeadingZeroesFromType(inputs.objectType),
			},
		});
	};

	/**
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. The gRPC equivalent is
	 * `listOwnedObjects` (`res.data` -> `res.objects`,
	 * `res.nextCursor` -> `res.cursor`, `options.showDisplay` ->
	 * `include.display` with `display.data` -> `display.output`), but it cannot
	 * return the parsed `content.fields` view this helper's callers cast from.
	 */
	public fetchOwnedObjects = async (inputs: {
		walletAddress: SuiAddress;
		filter?: SuiObjectDataFilter;
		withDisplay?: boolean;
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		const { walletAddress, withDisplay, filter } = inputs;

		let allObjectData: SuiObjectResponse[] = [];
		let cursor: string | undefined;
		do {
			const paginatedObjects = await this.api.jsonRpcClient.getOwnedObjects({
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
			) {
				return allObjectData;
			}

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

	/**
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. gRPC's `getObject` returns Move object
	 * contents as BCS bytes (`include: { content: true }`) or as a
	 * differently-shaped, explicitly unstable `json` view — UIDs flattened from
	 * `{ id: { id } }` to a bare string, nested structs unwrapped out of their
	 * `{ type, fields }` envelope, and `vector<u8>` base64-encoded instead of a
	 * number array. Reading that view would silently change what every
	 * `objectFromSuiObjectResponse` caster returns.
	 */
	public fetchObjectGeneral = async (inputs: {
		objectId: ObjectId;
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse> => {
		const { objectId, options } = inputs;

		const object = await this.api.jsonRpcClient.getObject({
			id: objectId,
			options,
		});
		if (object.error !== undefined) {
			throw new Error(
				`an error occured fetching object: ${object.error?.code}`
			);
		}
		return object;
	};

	public fetchCastObject = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (
			SuiObjectResponse: SuiObjectResponse
		) => ObjectType;
		withDisplay?: boolean;
	}): Promise<ObjectType> => {
		return inputs.objectFromSuiObjectResponse(await this.fetchObject(inputs));
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

	/**
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. The gRPC equivalent is `getObjects`,
	 * whose `objects` array is `(Object | Error)[]` (a per-object error shape
	 * `multiGetObjects` did not have), but it carries the same unusable content
	 * view as `getObject`.
	 */
	public fetchObjectBatch = async (inputs: {
		objectIds: ObjectId[];
		options?: SuiObjectDataOptions;
	}): Promise<SuiObjectResponse[]> => {
		const { objectIds, options } = inputs;

		const objectIdsBatches: ObjectId[][] = [];
		let endIndex = 0;
		while (true) {
			const newEndIndex =
				endIndex + ObjectsApiHelpers.constants.maxObjectFetchingLimit;
			if (newEndIndex >= objectIds.length) {
				objectIdsBatches.push(objectIds.slice(endIndex, objectIds.length));
				break;
			}

			objectIdsBatches.push(objectIds.slice(endIndex, newEndIndex));

			endIndex = newEndIndex;
		}

		const objectBatches = await Promise.all(
			objectIdsBatches.map((objectIds) =>
				this.api.jsonRpcClient.multiGetObjects({
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
		const objects = (await this.fetchObjectsOfTypeOwnedByAddress(inputs)).map(
			(SuiObjectResponse: SuiObjectResponse) => {
				return inputs.objectFromSuiObjectResponse(SuiObjectResponse);
			}
		);
		return objects;
	};

	// =========================================================================
	//  BCS
	// =========================================================================

	public fetchObjectBcs = async (
		objectId: ObjectId
	): Promise<SuiObjectResponse> => {
		// @dev: `options: { showBcs: true }` -> `include: { content: true }`. The
		// bytes are the BCS of the object's Move struct in both protocols and were
		// verified byte-identical across a `SuiSystemState`, three Aftermath pools
		// and three `Coin<SUI>` objects. gRPC throws instead of returning
		// `{ error }`, so the error message is rebuilt here.
		try {
			const { object } = await this.api.client.getObject({
				objectId,
				include: { content: true },
			});
			return GrpcCasting.suiObjectResponseFromGrpcObjectBcs(object);
		} catch (e) {
			throw new Error(
				`an error occured fetching object: ${e instanceof Error ? e.message : String(e)}`
			);
		}
	};

	public fetchCastObjectBcs = async <T, U>(inputs: {
		objectId: ObjectId;
		bcsType: BcsType<U>;
		fromDeserialized: (deserialized: U) => T;
	}): Promise<T> => {
		const { objectId } = inputs;
		const suiObjectResponse = await this.api.Objects().fetchObjectBcs(objectId);
		const { Casting } = await import("../utils/casting.js");
		return Casting.castObjectBcs({
			...inputs,
			suiObjectResponse,
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

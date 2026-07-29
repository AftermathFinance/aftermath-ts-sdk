import type { BcsType } from "@mysten/sui/bcs";
import type { SuiClientTypes } from "@mysten/sui/client";
import type { SuiObjectResponse } from "@mysten/sui/jsonRpc";
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
import { GrpcCasting, type SuiObjectView } from "../utils/grpcCasting";
import { Helpers } from "../utils/helpers";

/**
 * What to ask gRPC for when fetching an object destined for a caster.
 *
 * ⚠️ **Load-bearing.** gRPC returns `json` and `display` as `undefined` unless
 * the flag is set — a missing flag surfaces as `undefined` downstream, not as an
 * error. A caster that starts reading a new part of the object must widen this.
 */
const casterInclude = (withDisplay?: boolean) =>
	({
		json: true,
		display: withDisplay === true,
	}) as { json: true; display: true };

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

		// @dev: gRPC's owner is a `$kind`-discriminated union carrying the same
		// `AddressOwner` / `ObjectOwner` keys JSON-RPC used, so the checks below
		// are unchanged — only the path to it is (`data.owner` -> `owner`).
		const objectOwner = object.owner;
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

	public fetchObjectsOfTypeOwnedByAddress = async (inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView[]> => {
		// @dev: JSON-RPC's `filter: { StructType }` becomes gRPC's `type`. The
		// leading-zero strip is gone: gRPC accepts the padded and the abbreviated
		// form and was measured to return identical results for both, including
		// inside generic parameters.
		return this.fetchOwnedObjects(inputs);
	};

	public fetchOwnedObjects = async (inputs: {
		walletAddress: SuiAddress;
		objectType?: AnyObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView[]> => {
		const { walletAddress, withDisplay, objectType } = inputs;

		let allObjectData: SuiObjectView[] = [];
		let cursor: string | null | undefined;
		do {
			// @dev: `res.data` -> `res.objects`, `res.nextCursor` -> `res.cursor`.
			// Neither rename is a typecheck or lint failure when botched — reading
			// `nextCursor` off this response yields `undefined`, which silently ends
			// pagination after the first page. Covered in `tests/grpcMigration.test.ts`.
			const paginatedObjects = await this.api.client.listOwnedObjects({
				owner: walletAddress,
				type: objectType,
				include: casterInclude(withDisplay),
				limit: ObjectsApiHelpers.constants.maxObjectFetchingLimit,
				cursor,
			});

			allObjectData = [...allObjectData, ...paginatedObjects.objects];

			if (
				paginatedObjects.objects.length === 0 ||
				!paginatedObjects.hasNextPage ||
				!paginatedObjects.cursor
			) {
				return allObjectData;
			}

			cursor = paginatedObjects.cursor;
		} while (true);
	};

	public fetchObject = async (inputs: {
		objectId: ObjectId;
		withDisplay?: boolean;
	}): Promise<SuiObjectView> => {
		const { objectId, withDisplay } = inputs;
		return await this.fetchObjectGeneral({
			objectId,
			include: casterInclude(withDisplay),
		});
	};

	public fetchObjectGeneral = async (inputs: {
		objectId: ObjectId;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<SuiObjectView> => {
		const { objectId, include } = inputs;

		// @dev: JSON-RPC answered a missing object with `{ error: { code } }`;
		// gRPC **throws**. The message is rebuilt so callers that matched on the
		// old prefix keep working.
		try {
			const { object } = await this.api.client.getObject({
				objectId,
				include: (include ?? casterInclude()) as ReturnType<
					typeof casterInclude
				>,
			});
			return object as SuiObjectView;
		} catch (e) {
			throw new Error(
				`an error occured fetching object: ${e instanceof Error ? e.message : String(e)}`
			);
		}
	};

	public fetchCastObject = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		withDisplay?: boolean;
	}): Promise<ObjectType> => {
		return inputs.objectFromSuiObjectResponse(await this.fetchObject(inputs));
	};

	public fetchCastObjectGeneral = async <ObjectType>(inputs: {
		objectId: ObjectId;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<ObjectType> => {
		const { objectId, objectFromSuiObjectResponse, include } = inputs;
		return objectFromSuiObjectResponse(
			await this.fetchObjectGeneral({ objectId, include })
		);
	};

	/**
	 * @remarks gRPC's `getObjects` returns `(Object | Error)[]` — a **per-object
	 * error arm JSON-RPC's `multiGetObjects` did not have**, delivered as real
	 * `Error` instances. Those entries are dropped rather than handed to a caster:
	 * spreading one into `objectFromSuiObjectResponse` would throw deep inside the
	 * cast with a message that names neither the batch nor the missing id.
	 *
	 * This is a deliberate behaviour change and the more forgiving one. Previously
	 * a single missing object in a batch threw from inside the caster and lost the
	 * whole batch; now the surviving objects are returned. `nftsFromSuiObjects`
	 * already filtered its input, so the app-visible result is unchanged.
	 */
	public fetchObjectBatch = async (inputs: {
		objectIds: ObjectId[];
		include?: SuiClientTypes.ObjectInclude;
		withDisplay?: boolean;
	}): Promise<SuiObjectView[]> => {
		const { objectIds, include, withDisplay } = inputs;

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
			objectIdsBatches.map((batchIds) =>
				this.api.client.getObjects({
					objectIds: batchIds,
					include: (include ?? casterInclude(withDisplay)) as ReturnType<
						typeof casterInclude
					>,
				})
			)
		);

		return objectBatches.flatMap((batch) =>
			batch.objects.filter(
				(object): object is SuiObjectView => !(object instanceof Error)
			)
		);
	};

	public fetchCastObjectBatch = async <ObjectType>(inputs: {
		objectIds: ObjectId[];
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		include?: SuiClientTypes.ObjectInclude;
		withDisplay?: boolean;
	}): Promise<ObjectType[]> => {
		return (await this.fetchObjectBatch(inputs)).map((object) =>
			inputs.objectFromSuiObjectResponse(object)
		);
	};

	public fetchCastObjectsOwnedByAddressOfType = async <ObjectType>(inputs: {
		walletAddress: SuiAddress;
		objectType: AnyObjectType;
		objectFromSuiObjectResponse: (object: SuiObjectView) => ObjectType;
		withDisplay?: boolean;
		include?: SuiClientTypes.ObjectInclude;
	}): Promise<ObjectType[]> => {
		return (await this.fetchObjectsOfTypeOwnedByAddress(inputs)).map((object) =>
			inputs.objectFromSuiObjectResponse(object)
		);
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

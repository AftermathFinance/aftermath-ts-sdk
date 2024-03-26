import { AftermathApi } from "../providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	DynamicFieldObjectsWithCursor,
	KioskObject,
	KioskOwnerCapObject,
	Nft,
	ObjectId,
	SuiAddress,
} from "../../types";
import { Casting, Helpers } from "../utils";
import { NftsApiCasting } from "./nftsApiCasting";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";

export class NftsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants: {
		// objectTypes: {
		// 	kiosk: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk";
		// 	kioskOwnerCap: "0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap";
		// };
		moduleNames: {
			kiosk: "kiosk";
			transferPolicy: "transfer_policy";
		};
	};

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// =========================================================================
	//  Nft Objects
	// =========================================================================

	public fetchOwnedNfts = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<Nft[]> => {
		const objects = await this.Provider.Objects().fetchOwnedObjects({
			...inputs,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
		});
		return Casting.nfts.nftsFromSuiObjects(objects);
	};

	public fetchNfts = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<Nft[]> => {
		const objects = await this.Provider.Objects().fetchObjectBatch({
			...inputs,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
		});
		return Casting.nfts.nftsFromSuiObjects(objects);
	};

	// =========================================================================
	//  Kiosk Objects
	// =========================================================================

	public fetchOwnedKioskOwnerCaps = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<KioskOwnerCapObject[]> => {
		const { walletAddress } = inputs;

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::KioskOwnerCap",
			objectFromSuiObjectResponse:
				Casting.nfts.kioskOwnerCapFromSuiObject,
		});
	};

	public fetchNftsInKiosk = async (inputs: {
		kioskObjectId: ObjectId;
	}): Promise<Nft[]> => {
		const { kioskObjectId } = inputs;
		return this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: kioskObjectId,
			objectsFromObjectIds: (objectIds) => this.fetchNfts({ objectIds }),
		});
	};

	public fetchNftsInKioskWithCursor = async (inputs: {
		kioskObjectId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		const { kioskObjectId, cursor, limit } = inputs;
		return this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				parentObjectId: kioskObjectId,
				objectsFromObjectIds: (objectIds) =>
					this.fetchNfts({ objectIds }),
				cursor,
				limit,
			}
		);
	};

	public fetchKioskOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskOwnerCapObject[]> => {
		const { kioskOwnerCapIds } = inputs;

		return this.Provider.Objects().fetchCastObjectBatch({
			objectIds: kioskOwnerCapIds,
			objectFromSuiObjectResponse:
				Casting.nfts.kioskOwnerCapFromSuiObject,
		});
	};

	public fetchKiosks = async (inputs: {
		kioskOwnerCaps: KioskOwnerCapObject[];
	}): Promise<KioskObject[]> => {
		const { kioskOwnerCaps } = inputs;

		const nfts = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.fetchNftsInKiosk({
					kioskObjectId: kioskOwnerCap.kioskObjectId,
				})
			)
		);

		return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
			objectId: kioskOwnerCap.kioskObjectId,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
			kioskOwnerCapId: kioskOwnerCap.objectId,
			nfts: nfts[index],
		}));
	};

	public fetchKiosksFromOwnerCaps = async (inputs: {
		kioskOwnerCapIds: ObjectId[];
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchKioskOwnerCaps(inputs);
		return this.fetchKiosks({ kioskOwnerCaps });
	};

	public fetchOwnedKiosks = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<KioskObject[]> => {
		const kioskOwnerCaps = await this.fetchOwnedKioskOwnerCaps(inputs);

		const nfts = await Promise.all(
			kioskOwnerCaps.map((kioskOwnerCap) =>
				this.fetchNftsInKiosk({
					kioskObjectId: kioskOwnerCap.kioskObjectId,
				})
			)
		);

		return kioskOwnerCaps.map((kioskOwnerCap, index) => ({
			objectId: kioskOwnerCap.kioskObjectId,
			objectType:
				"0x0000000000000000000000000000000000000000000000000000000000000002::kiosk::Kiosk",
			kioskOwnerCapId: kioskOwnerCap.objectId,
			nfts: nfts[index],
		}));
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	public kioskNewTx = (inputs: {
		tx: TransactionBlock;
	}) /* (Kiosk, KioskOwnerCap) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				NftsApi.constants.moduleNames.kiosk,
				"new"
			),
			typeArguments: [],
			arguments: [],
		});
	};

	public kioskPurchaseWithCapTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		kioskId: ObjectId;
		purchaseCapId: ObjectId;
		coinId: ObjectId;
	}): [
		nft: TransactionArgument,
		transferRequest: TransactionArgument
	] /* (NFT, TransferRequest) */ => {
		const { tx, nftType, kioskId, purchaseCapId, coinId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				NftsApi.constants.moduleNames.kiosk,
				"purchase_with_cap"
			),
			typeArguments: [nftType],
			arguments: [
				tx.object(kioskId),
				tx.object(purchaseCapId),
				tx.object(coinId),
			],
		});
	};

	public kioskLockTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		kioskId: ObjectId;
		kioskOwnerCapId: ObjectId;
		transferPolicyId: ObjectId;
		nftId: ObjectId;
	}) => {
		const {
			tx,
			nftType,
			kioskId,
			kioskOwnerCapId,
			transferPolicyId,
			nftId,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				NftsApi.constants.moduleNames.kiosk,
				"lock"
			),
			typeArguments: [nftType],
			arguments: [
				tx.object(kioskId),
				tx.object(kioskOwnerCapId),
				tx.object(transferPolicyId),
				tx.object(nftId),
			],
		});
	};

	public kioskConfirmRequestTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		transferPolicyId: ObjectId;
		transferRequestId: ObjectId;
	}) => {
		const { tx, nftType, transferPolicyId, transferRequestId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				NftsApi.constants.moduleNames.transferPolicy,
				"confirm_request"
			),
			typeArguments: [nftType],
			arguments: [
				tx.object(transferPolicyId),
				tx.object(transferRequestId),
			],
		});
	};

	public kioskListWithPurchaseCapTx = (inputs: {
		tx: TransactionBlock;
		nftType: AnyObjectType;
		kioskId: ObjectId;
		kioskOwnerCapId: ObjectId;
		nftId: ObjectId;
		minPrice: Balance;
	}): TransactionArgument /* PurchaseCap<nftType> */ => {
		const { tx, nftType, kioskId, kioskOwnerCapId, nftId, minPrice } =
			inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				NftsApi.constants.moduleNames.kiosk,
				"list_with_purchase_cap"
			),
			typeArguments: [nftType],
			arguments: [
				tx.object(kioskId),
				tx.object(kioskOwnerCapId),
				tx.pure(nftId, "ID"),
				tx.pure(minPrice, "u64"),
			],
		});
	};
}

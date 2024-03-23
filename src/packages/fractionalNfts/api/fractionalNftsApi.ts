import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	CoinType,
	FractionalNftsAddresses,
	ObjectId,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { FractionalNftsVaultObject } from "../fractionalNftsTypes";
import { FractionalNftsApiCasting } from "./fractionalNftsApiCasting";

export class FractionalNftsApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: FractionalNftsAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.fractionalNfts;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchNftVault = async (inputs: {
		objectId: ObjectId;
	}): Promise<FractionalNftsVaultObject> => {
		return this.Provider.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse:
				FractionalNftsApiCasting.vaultObjectFromSuiObjectResponse,
		});
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public depositIntoKioskStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		nftIds: ObjectId[];
		transferPolicyId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
		withTransfer?: boolean;
	}) /* (Coin) */ => {
		const { tx, withTransfer } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"deposit_into_kiosk_storage" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.makeMoveVec({
					objects: inputs.nftIds.map((id) => tx.object(id)),
					type: inputs.nftType,
				}),
				tx.object(inputs.transferPolicyId), // TransferPolicy
			],
		});
	};

	public depositIntoPlainStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		nftIds: ObjectId[];
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
		withTransfer?: boolean;
	}) /* (Coin) */ => {
		const { tx, withTransfer } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"deposit_into_plain_storage" + (withTransfer ? "_and_keep" : "")
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.makeMoveVec({
					objects: inputs.nftIds.map((id) => tx.object(id)),
					type: inputs.nftType,
				}),
			],
		});
	};

	public depositSuiToKioskStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		suiCoinId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}) => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"deposit_sui_to_kiosk_storage"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.object(inputs.suiCoinId), // Coin
			],
		});
	};

	public idsTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}) /* (vector<ID>) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"ids"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
			],
		});
	};

	public nftAmountTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}) /* (U64) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"nft_amount"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
			],
		});
	};

	public withdrawFromKioskStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		nftIds: ObjectId[];
		fractionalCoinId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}) /* (vector<nftType>, vector<TransferRequest>) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"withdraw_from_kiosk_storage"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.makeMoveVec({
					objects: inputs.nftIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.object(inputs.fractionalCoinId), // Coin
			],
		});
	};

	// TODO: fix typos here
	public withdrawFromPlaneStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		nftIds: ObjectId[];
		fractionalCoinId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}) /* (vector<nftType>) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"withdraw_from_plane_storage"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.makeMoveVec({
					objects: inputs.nftIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.object(inputs.fractionalCoinId), // Coin
			],
		});
	};
}

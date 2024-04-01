import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	CoinType,
	FractionalNftsAddresses,
	ObjectId,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { FractionalNftsVaultObject } from "../fractionalNftsTypes";
import { FractionalNftsApiCasting } from "./fractionalNftsApiCasting";
import { Coin } from "../..";
import { bcs } from "@mysten/sui.js/bcs";

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
			withDisplay: true,
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public depositAfEggsTx = (inputs: {
		tx: TransactionBlock;
		nftIds: ObjectId[];
		kioskIds: ObjectId[];
		kioskOwnerCapIds: ObjectId[];
		nftType: AnyObjectType;
		fractionalCoinType: CoinType;
	}): TransactionArgument /* (Coin<fCoin>) */ => {
		const {
			tx,
			nftIds,
			kioskIds,
			kioskOwnerCapIds,
			nftType,
			fractionalCoinType,
		} = inputs;

		const nftVaultId =
			this.Provider.NftAmm().addresses.nftAmm.objects.afEgg.vaultId;
		const vaultKioskId =
			this.Provider.NftAmm().addresses.nftAmm.objects.afEgg.vaultKioskId;

		let nftArgs: TransactionArgument[] = [];
		let transferRequestArgs: TransactionArgument[] = [];
		for (const [index, nftId] of nftIds.entries()) {
			const kioskId = kioskIds[index];

			const purchaseCapId =
				this.Provider.Nfts().kioskListWithPurchaseCapTx({
					tx,
					nftId,
					kioskId,
					nftType,
					kioskOwnerCapId: kioskOwnerCapIds[index],
					minPrice: BigInt(0),
				});

			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			const [nft, transferRequest] =
				this.Provider.Nfts().kioskPurchaseWithCapTx({
					tx,
					kioskId,
					purchaseCapId,
					nftType,
					coinId: zeroSuiCoinId,
				});

			nftArgs.push(nft);
			transferRequestArgs.push(transferRequest);
		}

		const transferPolicyId =
			this.Provider.AfNft().addresses.objects.afEggTransferPolicy;

		// convert fCoin -> (nfts + transferRequests)
		const fractionalCoinId =
			this.Provider.FractionalNfts().depositIntoKioskStorageTx({
				tx,
				nftIds: nftArgs,
				withTransfer: false,
				nftType,
				fractionalCoinType,
				nftVaultId,
				vaultKioskId,
				transferPolicyId,
			});

		// complete all nft transfers
		for (const [, transferRequestId] of transferRequestArgs.entries()) {
			// pay royalty (using zero coin)
			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			this.Provider.Nfts().kioskPayRoyaltyRuleTx({
				tx,
				transferRequestId,
				suiCoinId: zeroSuiCoinId,
				nftType,
				transferPolicyId,
			});
			// prove nft is in a kiosk (vault's)
			this.Provider.Nfts().kioskProveRuleTx({
				tx,
				kioskId: tx.object(
					this.Provider.NftAmm().addresses.nftAmm.objects.afEgg
						.vaultKioskId
				),
				transferRequestId,
				nftType,
			});
			// complete transfer
			this.Provider.Nfts().kioskConfirmRequestTx({
				tx,
				transferRequestId,
				nftType,
				transferPolicyId,
			});
		}

		return fractionalCoinId;
	};

	public withdrawAfEggsTx = (inputs: {
		tx: TransactionBlock;
		nftIds: ObjectId[];
		fractionalCoinId: TransactionArgument;
		nftType: AnyObjectType;
		fractionalCoinType: CoinType;
	}): TransactionArgument[] /* (vector<KioskOwnerCap>) */ => {
		const { tx, nftIds, fractionalCoinId, nftType, fractionalCoinType } =
			inputs;

		const nftVaultId =
			this.Provider.NftAmm().addresses.nftAmm.objects.afEgg.vaultId;
		const vaultKioskId =
			this.Provider.NftAmm().addresses.nftAmm.objects.afEgg.vaultKioskId;

		// convert fCoin -> (nfts + transferRequests)
		const [nfts, transferRequests] =
			this.Provider.FractionalNfts().withdrawFromKioskStorageTx({
				tx,
				nftIds,
				fractionalCoinId,
				nftType,
				fractionalCoinType,
				nftVaultId,
				vaultKioskId,
			});

		// complete all nft transfers
		let kioskOwnerCapIds: TransactionArgument[] = [];
		for (const [index, nftId] of nfts.entries()) {
			// create new kiosk to store nfts
			const [kioskId, kioskOwnerCapId] = this.Provider.Nfts().kioskNewTx({
				tx,
			});
			// lock nft in user's kiosk
			this.Provider.Nfts().kioskLockTx({
				tx,
				kioskId,
				kioskOwnerCapId,
				nftId,
				nftType,
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
			// pay royalty (using zero coin)
			const zeroSuiCoinId = this.Provider.Coin().zeroTx({
				tx,
				coinType: Coin.constants.suiCoinType,
			});
			this.Provider.Nfts().kioskPayRoyaltyRuleTx({
				tx,
				suiCoinId: zeroSuiCoinId,
				nftType,
				transferRequestId: transferRequests[index],
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});
			// prove nft is in a kiosk (user's)
			this.Provider.Nfts().kioskProveRuleTx({
				tx,
				kioskId,
				nftType,
				transferRequestId: transferRequests[index],
			});
			// complete transfer
			this.Provider.Nfts().kioskConfirmRequestTx({
				tx,
				nftType,
				transferRequestId: transferRequests[index],
				transferPolicyId:
					this.Provider.AfNft().addresses.objects.afEggTransferPolicy,
			});

			kioskOwnerCapIds.push(kioskOwnerCapId);
		}
		return kioskOwnerCapIds;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public depositIntoKioskStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		vaultKioskId: ObjectId;
		nftIds: TransactionArgument[];
		transferPolicyId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
		withTransfer?: boolean;
	}): TransactionArgument /* (Coin) */ => {
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
				tx.object(inputs.vaultKioskId), // Kiosk
				tx.makeMoveVec({
					objects: inputs.nftIds,
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
	}): TransactionArgument /* (Coin) */ => {
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
	}): [nftIds: TransactionArgument[]] /* (vector<ID>) */ => {
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
	}): TransactionArgument /* (U64) */ => {
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
		vaultKioskId: ObjectId;
		nftIds: ObjectId[];
		fractionalCoinId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}): [
		nfts: TransactionArgument[],
		transferRequests: TransactionArgument[]
	] /* (vector<nftType>, vector<TransferRequest>) */ => {
		const { tx } = inputs;

		bcs.registerStructType("ID", {
			bytes: "address",
		});

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"withdraw_from_kiosk_storage"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				tx.object(inputs.vaultKioskId), // Kiosk
				// tx.makeMoveVec({
				// 	objects: inputs.nftIds.map((id) => tx.object(id)),
				// 	type: "ID",
				// }),
				tx.pure(
					inputs.nftIds.map((id) => ({
						bytes: id,
					})),
					"vector<ID>"
				),
				tx.object(inputs.fractionalCoinId), // Coin
			],
		});
	};

	public withdrawFromPlainStorageTx = (inputs: {
		tx: TransactionBlock;
		nftVaultId: ObjectId;
		nftIds: ObjectId[];
		fractionalCoinId: ObjectId;
		fractionalCoinType: CoinType;
		nftType: AnyObjectType;
	}): [nfts: TransactionArgument[]] /* (vector<nftType>) */ => {
		const { tx } = inputs;

		bcs.registerStructType("ID", {
			bytes: "address",
		});

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftVault,
				FractionalNftsApi.constants.moduleNames.interface,
				"withdraw_from_plain_storage"
			),
			typeArguments: [inputs.fractionalCoinType, inputs.nftType],
			arguments: [
				tx.object(inputs.nftVaultId), // Vault
				// tx.makeMoveVec({
				// 	objects: inputs.nftIds.map((id) => tx.object(id)),
				// 	type: "ID",
				// }),
				tx.pure(
					inputs.nftIds.map((id) => ({
						bytes: id,
					})),
					"vector<ID>"
				),
				tx.object(inputs.fractionalCoinId), // Coin
			],
		});
	};
}

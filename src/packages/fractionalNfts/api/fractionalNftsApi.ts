import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
	FractionalNftsAddresses,
	Nft,
	NftAmmAddresses,
	ObjectId,
	Slippage,
	SuiAddress,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin/coin";
import { Pools } from "../../pools/pools";
import {
	TransactionArgument,
	TransactionBlock,
	TransactionObjectArgument,
} from "@mysten/sui.js/transactions";

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

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchBuildBuyTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const expectedAssetCoinAmountIn = market.getBuyAssetCoinAmountIn({
			nftsCount: inputs.nftObjectIds.length,
			referral: inputs.referrer !== undefined,
		});

		const assetCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.assetCoinType,
			coinAmount: expectedAssetCoinAmountIn,
		});

		this.buyTx({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			assetCoin,
			expectedAssetCoinAmountIn,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildSellTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const expectedAssetCoinAmountOut = market.getSellAssetCoinAmountOut({
			nftsCount: inputs.nftObjectIds.length,
			referral: inputs.referrer !== undefined,
		});

		this.sellTx({
			...inputs,
			tx,
			nfts: inputs.nftObjectIds,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildDepositTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		assetCoinAmountIn: Balance;
		nfts: (ObjectId | TransactionArgument)[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const { lpRatio } = market.getDepositLpCoinAmountOut({
			assetCoinAmountIn: inputs.assetCoinAmountIn,
			referral: inputs.referrer !== undefined,
		});

		// // TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const assetCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.assetCoinType,
			coinAmount: inputs.assetCoinAmountIn,
		});

		this.depositTx({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedLpRatio,
			assetCoin,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildWithdrawTx = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		lpCoinAmount: Balance;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const fractionalizedCoinAmountOut =
			market.getWithdrawFractionalizedCoinAmountOut({
				lpCoinAmount: inputs.lpCoinAmount,
				referral: inputs.referrer !== undefined,
			});

		const { balances: coinAmountsOut } = Coin.coinsAndBalancesOverZero({
			[marketObject.fractionalizedCoinType]: fractionalizedCoinAmountOut,
		});
		const expectedAssetCoinAmountOut = coinAmountsOut[0];

		const lpCoin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress: inputs.walletAddress,
			coinType: marketObject.lpCoinType,
			coinAmount: inputs.lpCoinAmount,
		});

		this.addWithdrawCommandToTransaction({
			tx,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApi.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			lpCoin,
			withTransfer: true,
		});

		return tx;
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

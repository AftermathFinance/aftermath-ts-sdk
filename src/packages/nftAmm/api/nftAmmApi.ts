import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	NftAmmInterfaceGenericTypes,
	NftAmmMarketObject,
} from "../nftAmmTypes";
import { NftAmmApiCasting } from "./nftAmmApiCasting";
import { NftAmmMarket } from "../nftAmmMarket";
import {
	Balance,
	CoinType,
	DynamicFieldObjectsWithCursor,
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

export class NftAmmApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			actions: "actions",
			market: "market",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: NftAmmAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.nftAmm;
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

	public fetchNftsInMarketTable = async (inputs: {
		marketTableObjectId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: inputs.marketTableObjectId,
				objectsFromObjectIds: (objectIds) =>
					this.Provider.Nfts().fetchNfts({ objectIds }),
			}
		);
	};

	public fetchMarket = async (inputs: {
		objectId: ObjectId;
	}): Promise<NftAmmMarketObject> => {
		return this.Provider.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse:
				NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

	public fetchMarkets = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<NftAmmMarketObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse:
				NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

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

	public buyTx = (inputs: {
		tx: TransactionBlock;
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		nftObjectIds: ObjectId[];
		expectedAssetCoinAmountIn: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, assetCoin, genericTypes, nftObjectIds } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"buy"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof assetCoin === "string"
					? tx.object(assetCoin)
					: assetCoin,
				tx.makeMoveVec({
					objects: nftObjectIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.pure(inputs.expectedAssetCoinAmountIn.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
			],
		});
	};

	public sellTx = (inputs: {
		tx: TransactionBlock;
		marketObjectId: ObjectId;
		nfts: (ObjectId | TransactionArgument)[];
		expectedAssetCoinAmountOut: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, genericTypes, nfts } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"sell"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				tx.makeMoveVec({
					objects: Helpers.isArrayOfStrings(nfts)
						? nfts.map((nft) => tx.object(nft))
						: (nfts as TransactionObjectArgument[]),
					type: genericTypes[3],
				}),
				tx.pure(inputs.expectedAssetCoinAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
			],
		});
	};

	public depositTx = (inputs: {
		tx: TransactionBlock;
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		nfts: (ObjectId | TransactionArgument)[];
		expectedLpRatio: bigint;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, assetCoin, genericTypes, nfts } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"deposit"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof assetCoin === "string"
					? tx.object(assetCoin)
					: assetCoin,
				tx.makeMoveVec({
					objects: Helpers.isArrayOfStrings(nfts)
						? nfts.map((nft) => tx.object(nft))
						: (nfts as TransactionObjectArgument[]),
					type: genericTypes[3],
				}),
				tx.pure(inputs.expectedLpRatio.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
			],
		});
	};

	public addWithdrawCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		marketObjectId: ObjectId;
		lpCoin: ObjectId | TransactionArgument;
		nftObjectIds: ObjectId[];
		expectedAssetCoinAmountOut: Balance;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		withTransfer?: boolean;
	}) => {
		const { tx, lpCoin, genericTypes, nftObjectIds } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApi.constants.moduleNames.interface
					: NftAmmApi.constants.moduleNames.actions,
				"withdraw"
			),
			typeArguments: genericTypes,
			arguments: [
				tx.object(inputs.marketObjectId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				tx.object(this.addresses.objects.referralVault),
				typeof lpCoin === "string" ? tx.object(lpCoin) : lpCoin,
				tx.makeMoveVec({
					objects: nftObjectIds.map((id) => tx.object(id)),
					type: "ID",
				}),
				tx.pure(inputs.expectedAssetCoinAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
			],
		});
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static genericTypesForMarket = (inputs: {
		market: NftAmmMarket;
	}): [
		lpCoinType: CoinType,
		fractionalizedCoinType: CoinType,
		assetCoinType: CoinType,
		nftType: CoinType
	] => {
		const marketObject = inputs.market.market;
		return [
			marketObject.lpCoinType,
			marketObject.fractionalizedCoinType,
			marketObject.assetCoinType,
			marketObject.nftType,
		];
	};
}

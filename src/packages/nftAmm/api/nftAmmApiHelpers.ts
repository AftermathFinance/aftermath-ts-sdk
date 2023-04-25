import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import {
	Balance,
	CoinType,
	NftAmmAddresses,
	NftAmmInterfaceGenericTypes,
	Slippage,
} from "../../../types";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";
import { Pools } from "../../pools";
import { Casting, Helpers } from "../../../general/utils";
import { NftAmmMarket } from "../nftAmmMarket";
import { Coin } from "../../coin";

export class NftAmmApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			actions: "actions",
			market: "market",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: NftAmmAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.nftAmm;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildBuyTransaction = async (inputs: {
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

		const { coinArgument: assetCoin, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				marketObject.assetCoinType,
				expectedAssetCoinAmountIn
			);

		this.addBuyCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApiHelpers.genericTypesForMarket({ market }),
			assetCoin,
			expectedAssetCoinAmountIn,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildSellTransaction = async (inputs: {
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

		this.addSellCommandToTransaction({
			...inputs,
			tx,
			nfts: inputs.nftObjectIds,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApiHelpers.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildDepositTransaction = async (inputs: {
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

		const { coinArgument: assetCoin, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				marketObject.assetCoinType,
				inputs.assetCoinAmountIn
			);

		this.addDepositCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApiHelpers.genericTypesForMarket({ market }),
			expectedLpRatio,
			assetCoin,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildWithdrawTransaction = async (inputs: {
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

		const { coinArgument: lpCoin, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				marketObject.lpCoinType,
				inputs.lpCoinAmount
			);

		this.addWithdrawCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			marketObjectId: marketObject.objectId,
			genericTypes: NftAmmApiHelpers.genericTypesForMarket({ market }),
			expectedAssetCoinAmountOut,
			lpCoin,
			withTransfer: true,
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public addBuyCommandToTransaction = (inputs: {
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApiHelpers.constants.moduleNames.interface
					: NftAmmApiHelpers.constants.moduleNames.actions,
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

	public addSellCommandToTransaction = (inputs: {
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApiHelpers.constants.moduleNames.interface
					: NftAmmApiHelpers.constants.moduleNames.actions,
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
						: (nfts as TransactionArgument[]),
					type: genericTypes[3],
				}),
				tx.pure(inputs.expectedAssetCoinAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
			],
		});
	};

	public addDepositCommandToTransaction = (inputs: {
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApiHelpers.constants.moduleNames.interface
					: NftAmmApiHelpers.constants.moduleNames.actions,
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
						: (nfts as TransactionArgument[]),
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.nftAmm,
				inputs.withTransfer
					? NftAmmApiHelpers.constants.moduleNames.interface
					: NftAmmApiHelpers.constants.moduleNames.actions,
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

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

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

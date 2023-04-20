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
import { Casting } from "../../../general/utils";
import { NftAmmMarket } from "../nftAmmMarket";

export class NftAmmApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
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

	public fetchBuildDepositTransaction = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress; // NOTE: is this needed ?
		assetCoinAmountIn: Balance;
		nftObjectIds: ObjectId[];
		// NOTE: should we pass market here instead ?
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { market } = inputs;
		const marketObject = market.market;

		const { lpRatio, error } = market.pool.getDepositLpAmountOut({
			amountsIn: {
				[marketObject.assetCoinType]: inputs.assetCoinAmountIn,
			},
			referral: inputs.referrer !== undefined,
		});
		if (error !== undefined) throw new Error(error);

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
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public addDepositCommandToTransaction = (inputs: {
		tx: TransactionBlock;
		walletAddress: SuiAddress; // NOTE: is this needed ?
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		nftObjectIds: ObjectId[];
		expectedLpRatio: bigint;
		genericTypes: NftAmmInterfaceGenericTypes;
		slippage: Slippage;
		referrer?: SuiAddress;
	}) => {
		const { tx, assetCoin, genericTypes } = inputs;
		return tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.nftAmm,
				NftAmmApiHelpers.constants.moduleNames.interface,
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
				tx.pure(inputs.expectedLpRatio.toString()),
				tx.pure(Pools.normalizeSlippage(inputs.slippage)),
				tx.pure(
					TransactionsApiHelpers.createOptionObject(inputs.referrer),
					"Option<address>"
				),
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static genericTypesForMarket = (inputs: {
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

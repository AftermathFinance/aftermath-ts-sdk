import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import {
	AnyObjectType,
	Balance,
	CoinType,
	NftAmmAddresses,
	NftAmmInterfaceGenericTypes,
	NftAmmInterfaceGenericTypesUnordered,
	Slippage,
} from "../../../types";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";
import { Pool, Pools } from "../../pools";
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
		// PASSS MARKET HERE DIRECT INSTEAD !!
		market: NftAmmMarket;
		walletAddress: SuiAddress; // NOTE: is this needed ?
		marketObjectId: ObjectId;
		assetCoin: ObjectId | TransactionArgument;
		assetCoinAmountIn: Balance;
		nftObjectIds: ObjectId[];
		expectedLpRatio: number;
		// NOTE: should we pass market here instead ?
		assetCoinType: CoinType;
		nftType: AnyObjectType;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { lpRatio, error } = inputs.pool.getDepositLpAmountOut({
			amountsIn: {
				[inputs.assetCoinType]: inputs.assetCoinAmountIn,
			},
			referral: inputs.referrer !== undefined,
		});
		if (error !== undefined) throw new Error(error);

		// // TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				inputs.walletAddress,
				inputs.assetCoinType,
				inputs.assetCoinAmountIn
			);

		this.addDepositCommandToTransaction({
			tx: txWithCoinWithAmount,
			...inputs,
			genericTypes: [
				inputs.pool.pool.lpCoinType,
				fractionalizedCoinType,
				inputs.assetCoinType,
				nftType,
			],
			expectedLpRatio,
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
}

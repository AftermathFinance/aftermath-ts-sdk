import { ObjectId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CoinType, PerpetualsAddresses, Timestamp } from "../../../types";

import {
	PerpetualsAccountManagerObject,
	PerpetualsMarketManagerObject,
	PerpetualsOrderbookObject,
	PerpetualsPriceFeedStorageObject,
} from "../../../types";
import { PerpetualsCasting } from "./perpetualsCasting";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";

export class PerpetualsApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////
	private static readonly constants = {
		moduleNames: {
			interface: "interface",
		},
	};

	public readonly addresses: PerpetualsAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		const addresses = this.Provider.addresses.perpetuals;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////
	public fetchAccountManager = async (
		objectId: ObjectId
	): Promise<PerpetualsAccountManagerObject> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsAccountManagerObject>(
			{
				objectId,
				objectFromSuiObjectResponse:
					PerpetualsCasting.accountManagerFromSuiObjectResponse,
			}
		);
	};

	public fetchMarketManager = async (
		objectId: ObjectId
	): Promise<PerpetualsMarketManagerObject> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsMarketManagerObject>(
			{
				objectId,
				objectFromSuiObjectResponse:
					PerpetualsCasting.marketManagerFromSuiObjectResponse,
			}
		);
	};

	public fetchPriceFeedStorage = async (
		objectId: ObjectId
	): Promise<PerpetualsPriceFeedStorageObject> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsPriceFeedStorageObject>(
			{
				objectId,
				objectFromSuiObjectResponse:
					PerpetualsCasting.priceFeedStorageFromSuiObjectResponse,
			}
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////
	public fetchPerpetualsInitializeForCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsInitializeForCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPereptualsTransferAdminCapTx = async (inputs: {
		walletAddress: SuiAddress;
		targetAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.pereptualsTransferAdminCapTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCreateMarketTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		marketId: bigint;
		marginRatioInitial: bigint;
		marginRatioMaintenance: bigint;
		baseAssetSymbol: string;
		fundingFrequencyMs: bigint;
		fundingPeriodMs: bigint;
		twapPeriodMs: bigint;
		makerFee: bigint;
		takerFee: bigint;
		liquidationFee: bigint;
		forceCancelFee: bigint;
		insuranceFundFee: bigint;
		priceImpactFactor: bigint;
		lotSize: bigint;
		tickSize: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsCreateMarketTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsDepositCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coin: ObjectId;
		accountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsDepositCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsPlaceMarketOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsPlaceMarketOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsPlaceLimitOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsPlaceMarketOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCancelOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		orderId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsCancelOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsClosePositionTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsClosePositionTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsWithdrawCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		amount: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsWithdrawCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsLiquidateTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsLiquidateTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsLiquidateAcquireTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsLiquidateAcquireTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsUpdateFundingTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsUpdateFundingTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCreateAccountTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.perpetualsCreateAccountTx({
			tx,
			...inputs,
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////
	public perpetualsInitializeForCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"initialize_for_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				tx.object(this.addresses.objects.registry),
			],
		});
	};

	public pereptualsTransferAdminCapTx = (inputs: {
		tx: TransactionBlock;
		targetAddress: SuiAddress;
	}) => {
		const { tx, targetAddress } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"transfer_admin_cap"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				tx.pure(targetAddress),
			],
		});
	};

	public perpetualsCreateMarketTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: bigint;
		marginRatioInitial: bigint;
		marginRatioMaintenance: bigint;
		baseAssetSymbol: string;
		fundingFrequencyMs: bigint;
		fundingPeriodMs: bigint;
		twapPeriodMs: bigint;
		makerFee: bigint;
		takerFee: bigint;
		liquidationFee: bigint;
		forceCancelFee: bigint;
		insuranceFundFee: bigint;
		priceImpactFactor: bigint;
		lotSize: bigint;
		tickSize: bigint;
	}) => {
		const {
			tx,
			coinType,
			marketId,
			marginRatioInitial,
			marginRatioMaintenance,
			baseAssetSymbol,
			fundingFrequencyMs,
			fundingPeriodMs,
			twapPeriodMs,
			makerFee,
			takerFee,
			liquidationFee,
			forceCancelFee,
			insuranceFundFee,
			priceImpactFactor,
			lotSize,
			tickSize,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				// TODO: create a Map<coinType, Exchange> and get the correspondent accountManager
				// Same for all the other functions
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.pure(marketId),
				tx.pure(marginRatioInitial),
				tx.pure(marginRatioMaintenance),
				tx.pure(baseAssetSymbol),
				tx.pure(fundingFrequencyMs),
				tx.pure(fundingPeriodMs),
				tx.pure(twapPeriodMs),
				tx.pure(makerFee),
				tx.pure(takerFee),
				tx.pure(liquidationFee),
				tx.pure(forceCancelFee),
				tx.pure(insuranceFundFee),
				tx.pure(priceImpactFactor),
				tx.pure(lotSize),
				tx.pure(tickSize),
			],
		});
	};

	public perpetualsDepositCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		coin: ObjectId;
		accountId: bigint;
	}) => {
		const { tx, coinType, coin, accountId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deposit_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(coin),
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.pure(accountId),
				tx.object(this.addresses.objects.exchanges[0].vault),
			],
		});
	};

	public perpetualsPlaceMarketOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
	}) => {
		const { tx, coinType, accountId, marketId, side, size } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_market_order"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(accountId),
				tx.pure(marketId),
				tx.pure(side),
				tx.pure(size),
			],
		});
	};

	public perpetualsPlaceLimitOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
	}) => {
		const {
			tx,
			coinType,
			accountId,
			marketId,
			side,
			size,
			price,
			orderType,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_limit_order"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(accountId),
				tx.pure(marketId),
				tx.pure(side),
				tx.pure(size),
				tx.pure(price),
				tx.pure(orderType),
			],
		});
	};

	public perpetualsCancelOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		orderId: bigint;
	}) => {
		const { tx, coinType, accountId, marketId, side, orderId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_order"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.pure(accountId),
				tx.pure(marketId),
				tx.pure(side),
				tx.pure(orderId),
			],
		});
	};

	public perpetualsClosePositionTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
	}) => {
		const { tx, coinType, accountId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"close_position"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.pure(accountId),
				tx.pure(marketId),
			],
		});
	};

	public perpetualsWithdrawCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		amount: bigint;
	}) => {
		const { tx, coinType, accountId, amount } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"withdraw_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(this.addresses.objects.exchanges[0].vault),
				tx.object(this.addresses.objects.exchanges[0].insuranceFund),
				tx.pure(accountId),
				tx.pure(amount),
			],
		});
	};

	public perpetualsLiquidateTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}) => {
		const {
			tx,
			coinType,
			liqee,
			liqeeAccountId,
			marketId,
			liqorAccountId,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"liquidate"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(liqee),
				tx.pure(liqeeAccountId),
				tx.pure(marketId),
				tx.pure(liqorAccountId),
			],
		});
	};

	public perpetualsLiquidateAcquireTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}) => {
		const {
			tx,
			coinType,
			liqee,
			liqeeAccountId,
			marketId,
			liqorAccountId,
		} = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"liquidate_acquire"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(liqee),
				tx.pure(liqeeAccountId),
				tx.pure(marketId),
				tx.pure(liqorAccountId),
			],
		});
	};

	public perpetualsUpdateFundingTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: bigint;
	}) => {
		const { tx, coinType, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"update_funding"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(marketId),
			],
		});
	};

	public perpetualsCreateAccountTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Oracle Transactions
	/////////////////////////////////////////////////////////////////////
	public fetchOracleCreatePriceFeedTx = async (inputs: {
		walletAddress: SuiAddress;
		symbol: string;
		decimal: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.oracleCreatePriceFeedTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchOracleUpdatePriceFeedTx = async (inputs: {
		walletAddress: SuiAddress;
		symbol: string;
		price: bigint;
		timestamp: Timestamp;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.oracleUpdatePriceFeedTx({
			tx,
			...inputs,
		});

		return tx;
	};
	public oracleCreatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		symbol: string;
		decimal: bigint;
	}) => {
		const { tx, symbol, decimal } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.objects.oracle.packages.oracle,
				"oracle",
				"create_price_feed"
			),
			typeArguments: [],
			arguments: [
				tx.object(
					this.addresses.objects.oracle.objects.authorityCapability
				),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(symbol),
				tx.pure(decimal),
			],
		});
	};

	public oracleUpdatePriceFeedTx = (inputs: {
		tx: TransactionBlock;
		symbol: string;
		price: bigint;
		timestamp: Timestamp;
	}) => {
		const { tx, symbol, price, timestamp } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.objects.oracle.packages.oracle,
				"oracle",
				"update_price_feed"
			),
			typeArguments: [],
			arguments: [
				tx.object(
					this.addresses.objects.oracle.objects.authorityCapability
				),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(symbol),
				tx.pure(price),
				tx.pure(timestamp),
			],
		});
	};
}

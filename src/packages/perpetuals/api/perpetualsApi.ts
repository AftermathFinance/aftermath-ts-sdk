import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
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
	// =========================================================================
	//  Class Members
	// =========================================================================
	private static readonly constants = {
		moduleNames: {
			interface: "interface",
		},
	};

	public readonly addresses: PerpetualsAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		const addresses = this.Provider.addresses.perpetuals;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
	}

	// =========================================================================
	//  Objects
	// =========================================================================
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

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public initializeForCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public transferAdminCapTx = (inputs: {
		tx: TransactionBlock;
		targetAddress: SuiAddress;
	}) => {
		const { tx, targetAddress } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public createMarketTx = (inputs: {
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
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				// TODO: create a Map<coinType, Exchange> and get the correspondent accountManager
				// Same for all the other functions
				tx.object(this.addresses.objects.exchanges[0].marketManager),
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

	public depositCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		coin: ObjectId | TransactionArgument;
		accountId: bigint;
	}) => {
		const { tx, coinType, coin, accountId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deposit_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				typeof coin === "string" ? tx.object(coin) : coin,
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.pure(accountId),
				tx.object(this.addresses.objects.exchanges[0].vault),
			],
		});
	};

	public placeMarketOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
	}) => {
		const { tx, coinType, accountId, marketId, side, size } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public placeLimitOrderTx = (inputs: {
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
			target: Helpers.transactions.createTxTarget(
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

	public cancelOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		orderId: bigint;
	}) => {
		const { tx, coinType, accountId, marketId, side, orderId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public closePositionTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
	}) => {
		const { tx, coinType, accountId, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"close_position"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
				tx.object(this.addresses.objects.exchanges[0].marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(accountId),
				tx.pure(marketId),
			],
		});
	};

	public withdrawCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: bigint;
		amount: bigint;
	}) => {
		const { tx, coinType, accountId, amount } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public liquidateTx = (inputs: {
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
			target: Helpers.transactions.createTxTarget(
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

	public liquidateAcquireTx = (inputs: {
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
			target: Helpers.transactions.createTxTarget(
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

	public updateFundingTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: bigint;
	}) => {
		const { tx, coinType, marketId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	public createAccountTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
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

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchInitializeForCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.initializeForCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchTransferAdminCapTx = async (inputs: {
		walletAddress: SuiAddress;
		targetAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.transferAdminCapTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchCreateMarketTx = async (inputs: {
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

		this.createMarketTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchDepositCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		coinAmount: bigint;
		accountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { walletAddress, coinType, coinAmount } = inputs;
		let coin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType,
			coinAmount,
		});
		this.depositCollateralTx({
			tx,
			coin,
			...inputs,
		});

		return tx;
	};

	public fetchPlaceMarketOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.placeMarketOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPlaceLimitOrderTx = async (inputs: {
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

		this.placeLimitOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchCancelOrderTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		orderId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.cancelOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchClosePositionTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.closePositionTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchWithdrawCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountId: bigint;
		amount: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchLiquidateTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.liquidateTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public buildLiquidateAcquireTx = Helpers.transactions.creatBuildTxFunc(
		this.liquidateAcquireTx
	);

	public fetchUpdateFundingTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.updateFundingTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchCreateAccountTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.createAccountTx({
			tx,
			...inputs,
		});

		return tx;
	};

	// =========================================================================
	//  Oracle Transactions
	// =========================================================================

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
			target: Helpers.transactions.createTxTarget(
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
			target: Helpers.transactions.createTxTarget(
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

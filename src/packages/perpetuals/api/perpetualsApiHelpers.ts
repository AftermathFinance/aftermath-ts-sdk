import { ObjectId, SuiAddress, TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers";
import { CoinType, PerpetualsAddresses } from "../../../types";
import { Sui } from "../../sui";
import { Helpers } from "../../../general/utils";

export class PerpetualsHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: PerpetualsAddresses;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.perpetuals;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;
	}

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////
	public fetchPerpetualsInitializeForCollateralTx = async (inputs: {
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsInitializeForCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPereptualsTransferAdminCapTx = async (inputs: {
		targetAddress: SuiAddress;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.pereptualsTransferAdminCapTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCreateMarketTx = async (inputs: {
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

		this.perpetualsCreateMarketTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsDepositCollateralTx = async (inputs: {
		coinType: CoinType;
		coin: ObjectId;
		accountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsDepositCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsPlaceMarketOrderTx = async (inputs: {
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsPlaceMarketOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsPlaceLimitOrderTx = async (inputs: {
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsPlaceMarketOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCancelOrderTx = async (inputs: {
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
		side: boolean;
		orderId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsCancelOrderTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsClosePositionTx = async (inputs: {
		coinType: CoinType;
		accountId: bigint;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsClosePositionTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsWithdrawCollateralTx = async (inputs: {
		coinType: CoinType;
		accountId: bigint;
		amount: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsWithdrawCollateralTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsLiquidateTx = async (inputs: {
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsLiquidateTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsLiquidateAcquireTx = async (inputs: {
		coinType: CoinType;
		liqee: SuiAddress;
		liqeeAccountId: bigint;
		marketId: bigint;
		liqorAccountId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsLiquidateAcquireTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsUpdateFundingTx = async (inputs: {
		coinType: CoinType;
		marketId: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		this.perpetualsUpdateFundingTx({
			tx,
			...inputs,
		});

		return tx;
	};

	public fetchPerpetualsCreateAccountTx = async (inputs: {
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
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
				PerpetualsHelpers.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.exchanges[0].accountManager),
			],
		});
	};
}

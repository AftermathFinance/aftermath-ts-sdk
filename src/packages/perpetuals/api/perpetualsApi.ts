import {
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	SuiRawMoveObject,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinType,
	PerpetualsAccountObject,
	PerpetualsAddresses,
	ExchangeAddresses,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import {
	PerpetualsAccountManager,
	bcs,
	PerpetualsMarketManager,
	PerpetualsMarketParams,
	PerpetualsMarketState,
	ApiPerpetualsDepositCollateralBody,
	ApiPerpetualsCreateAccountBody,
	PerpetualsMarketId,
	PerpetualsAccountId,
	PerpetualsOrderId,
} from "../perpetualsTypes";
import { PerpetualsCasting } from "./perpetualsCasting";
import { PerpetualsAccount } from "../perpetualsAccount";

export class PerpetualsApi {
	// =========================================================================
	//  Class Members
	// =========================================================================
	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			accountManager: "account_manager",
			marketManager: "market_manager",
			orderedVecSet: "ordered_vec_set",
		},
	};

	public readonly addresses: PerpetualsAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
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

	public fetchAccountManager = async (inputs: {
		coinType: CoinType;
	}): Promise<PerpetualsAccountManager> => {
		const exchangeCfg = this.getExchangeConfig(inputs);
		return await this.Provider.Objects().fetchCastObjectGeneral({
			objectId: exchangeCfg.accountManager,
			objectFromSuiObjectResponse:
				PerpetualsCasting.accountManagerFromSuiResponse,
			options: {
				showBcs: true,
				showType: true,
			},
		});
	};

	public fetchMarketManager = async (inputs: {
		coinType: CoinType;
	}): Promise<PerpetualsMarketManager> => {
		const exchangeCfg = this.getExchangeConfig(inputs);
		return await this.Provider.Objects().fetchCastObjectGeneral({
			objectId: exchangeCfg.marketManager,
			objectFromSuiObjectResponse:
				PerpetualsCasting.marketManagerFromSuiResponse,
			options: {
				showBcs: true,
				showType: true,
			},
		});
	};

	public fetchOwnedAccountCapObjectIds = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<ObjectId[]> => {
		const accountCapType = this.getAccountCapType(inputs);
		const accountCaps =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress({
				walletAddress: inputs.walletAddress,
				objectType: accountCapType,
			});
		return accountCaps.map((x: SuiObjectResponse) => {
			return x.data!.objectId;
		});
	};

	public fetchAccount = async (inputs: {
		coinType: CoinType;
		accountId: PerpetualsAccountId;
	}): Promise<PerpetualsAccountObject> => {
		const accountDfInfos =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId: this.addresses.objects.exchanges.get(
					inputs.coinType
				)?.accountManager!,
			});

		const accountDfInfo = accountDfInfos.find((info) => {
			return BigInt(info.name.value.account_id) === inputs.accountId;
		})!;

		const objectResponse = await this.Provider.provider.getObject({
			id: accountDfInfo.objectId,
			options: { showBcs: true },
		});
		const bcsData = objectResponse.data?.bcs as SuiRawMoveObject;
		const accountField = bcs.de(
			"Field<u64, Account>",
			bcsData.bcsBytes,
			"base64"
		);

		return PerpetualsCasting.accountFromRaw(accountField.value);
	};

	public fetchPositionOrderIds = async (inputs: {
		coinType: CoinType;
		accountId: PerpetualsAccountId;
		marketId: PerpetualsMarketId;
	}): Promise<bigint[][]> => {
		const { coinType, accountId, marketId } = inputs;

		const account_struct = await this.fetchAccount({ coinType, accountId });
		const account = new PerpetualsAccount(accountId, account_struct);
		const position = account.positionForMarketId({ marketId });

		const askOrderIds = await this.fetchOrderedVecSet({
			objectId: position.asks.objectId,
		});
		const bidOrderIds = await this.fetchOrderedVecSet({
			objectId: position.bids.objectId,
		});

		return [askOrderIds, bidOrderIds];
	};

	public fetchMarketState = async (inputs: {
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketState> => {
		const pkg = this.addresses.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::State>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const bcsData = objectResp.data?.bcs as SuiRawMoveObject;
		const mktStateField = bcs.de(
			"Field<MarketKey, MarketState>",
			bcsData.bcsBytes,
			"base64"
		);
		return PerpetualsCasting.marketStateFromRaw(mktStateField.value);
	};

	public fetchMarketParams = async (inputs: {
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketParams> => {
		const pkg = this.addresses.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::Params>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const bcsData = objectResp.data?.bcs as SuiRawMoveObject;
		const mktParamsField = bcs.de(
			"Field<MarketKey, MarketParams>",
			bcsData.bcsBytes,
			"base64"
		);
		return PerpetualsCasting.marketParamsFromRaw(mktParamsField.value);
	};

	public fetchOrderedVecSet = async (inputs: {
		objectId: ObjectId;
	}): Promise<bigint[]> => {
		const pkg = this.addresses.packages.perpetuals;
		const keyType = `${pkg}::ordered_vec_set::Contents`;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: inputs.objectId,
				name: {
					type: keyType,
					value: { dummy_field: Boolean() },
				},
			});

		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const bcsData = objectResp.data?.bcs as SuiRawMoveObject;

		const orderKeys = bcs.de(
			`Field<Contents, vector<u128>>`,
			bcsData.bcsBytes,
			"base64"
		);

		const res = orderKeys.value.map((value: string) => {
			return BigInt(value);
		});
		return res;
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

	public addInsuranceFundTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"add_insurance_fund"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				tx.object(exchangeCfg.insuranceFunds),
			],
		});
	};

	public createMarketTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: PerpetualsMarketId;
		marginRatioInitial: bigint;
		marginRatioMaintenance: bigint;
		baseAssetSymbol: string;
		fundingFrequencyMs: bigint;
		fundingPeriodMs: bigint;
		premiumTwapFrequencyMs: bigint;
		premiumTwapPeriodMs: bigint;
		spreadTwapFrequencyMs: bigint;
		spreadTwapPeriodMs: bigint;
		makerFee: bigint;
		takerFee: bigint;
		liquidationFee: bigint;
		forceCancelFee: bigint;
		insuranceFundFee: bigint;
		insuranceFundId: bigint;
		lotSize: bigint;
		tickSize: bigint;
		branchMin: bigint;
		branchMax: bigint;
		leafMin: bigint;
		leafMax: bigint;
		branchesMergeMax: bigint;
		leavesMergeMax: bigint;
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
			premiumTwapFrequencyMs,
			premiumTwapPeriodMs,
			spreadTwapFrequencyMs,
			spreadTwapPeriodMs,
			makerFee,
			takerFee,
			liquidationFee,
			forceCancelFee,
			insuranceFundFee,
			insuranceFundId,
			lotSize,
			tickSize,
			branchMin,
			branchMax,
			leafMin,
			leafMax,
			branchesMergeMax,
			leavesMergeMax,
		} = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.objects.adminCapability),
				tx.object(exchangeCfg.marketManager),
				tx.object(exchangeCfg.insuranceFunds),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.pure(marketId),
				tx.pure(marginRatioInitial),
				tx.pure(marginRatioMaintenance),
				tx.pure(baseAssetSymbol),
				tx.pure(fundingFrequencyMs),
				tx.pure(fundingPeriodMs),
				tx.pure(premiumTwapFrequencyMs),
				tx.pure(premiumTwapPeriodMs),
				tx.pure(spreadTwapFrequencyMs),
				tx.pure(spreadTwapPeriodMs),
				tx.pure(makerFee),
				tx.pure(takerFee),
				tx.pure(liquidationFee),
				tx.pure(forceCancelFee),
				tx.pure(insuranceFundFee),
				tx.pure(insuranceFundId),
				tx.pure(lotSize),
				tx.pure(tickSize),
				tx.pure(branchMin),
				tx.pure(branchMax),
				tx.pure(leafMin),
				tx.pure(leafMax),
				tx.pure(branchesMergeMax),
				tx.pure(leavesMergeMax),
			],
		});
	};

	public depositCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		coin: ObjectId | TransactionArgument;
	}) => {
		const { tx, coinType, accountCapId, coin } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"deposit_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.vault),
				typeof coin === "string" ? tx.object(coin) : coin,
			],
		});
	};

	public placeMarketOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: boolean;
		size: bigint;
	}) => {
		const { tx, coinType, accountCapId, marketId, side, size } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_market_order"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(marketId),
				tx.pure(side),
				tx.pure(size),
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: boolean;
		size: bigint;
		price: bigint;
		orderType: bigint;
	}) => {
		const {
			tx,
			coinType,
			accountCapId,
			marketId,
			side,
			size,
			price,
			orderType,
		} = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"place_limit_order"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
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
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: boolean;
		orderId: PerpetualsOrderId;
	}) => {
		const { tx, coinType, accountCapId, marketId, side, orderId } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"cancel_order"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.pure(marketId),
				tx.pure(side),
				tx.pure(orderId),
			],
		});
	};

	public withdrawCollateralTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: bigint;
	}) => {
		const { tx, coinType, accountCapId, amount } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"withdraw_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(exchangeCfg.vault),
				tx.pure(amount),
			],
		});
	};

	public liquidateTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		liqeeAccountId: PerpetualsAccountId;
		sizes: bigint[];
	}) => {
		const { tx, coinType, accountCapId, liqeeAccountId, sizes } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"liquidate"
			),
			typeArguments: [coinType],
			arguments: [
				typeof accountCapId === "string"
					? tx.object(accountCapId)
					: accountCapId,
				tx.object(exchangeCfg.accountManager),
				tx.object(exchangeCfg.marketManager),
				tx.object(exchangeCfg.vault),
				tx.object(exchangeCfg.insuranceFunds),
				tx.object(
					this.addresses.objects.oracle.objects.priceFeedStorage
				),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(liqeeAccountId),
				tx.pure(sizes),
			],
		});
	};

	public updateFundingTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}) => {
		const { tx, coinType, marketId } = inputs;
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"update_funding"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(exchangeCfg.marketManager),
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
		const exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [coinType],
			arguments: [tx.object(exchangeCfg.accountManager)],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public buildInitializeForCollateralTx =
		Helpers.transactions.creatBuildTxFunc(this.initializeForCollateralTx);

	public buildTransferAdminCapTx = Helpers.transactions.creatBuildTxFunc(
		this.transferAdminCapTx
	);

	public buildAddInsuranceFundTx = Helpers.transactions.creatBuildTxFunc(
		this.addInsuranceFundTx
	);

	public buildCreateMarketTx = Helpers.transactions.creatBuildTxFunc(
		this.createMarketTx
	);

	public fetchDepositCollateralTx = async (
		inputs: ApiPerpetualsDepositCollateralBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const { walletAddress, coinType, amount } = inputs;
		const coin = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType,
			coinAmount: amount,
		});
		this.depositCollateralTx({
			tx,
			coin,
			...inputs,
		});

		return tx;
	};

	public buildPlaceMarketOrderTx = Helpers.transactions.creatBuildTxFunc(
		this.placeMarketOrderTx
	);

	public buildPlaceLimitOrderTx = Helpers.transactions.creatBuildTxFunc(
		this.placeLimitOrderTx
	);

	public buildCancelOrderTx = Helpers.transactions.creatBuildTxFunc(
		this.cancelOrderTx
	);

	public fetchWithdrawCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: bigint;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coin = this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		tx.transferObjects([coin], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildLiquidateTx = Helpers.transactions.creatBuildTxFunc(
		this.liquidateTx
	);

	public buildUpdateFundingTx = Helpers.transactions.creatBuildTxFunc(
		this.updateFundingTx
	);

	public fetchCreateAccountTx = async (
		inputs: ApiPerpetualsCreateAccountBody
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accCap = this.createAccountTx({
			tx,
			...inputs,
		});

		tx.transferObjects([accCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public getExchangeConfig = (inputs: {
		coinType: CoinType;
	}): ExchangeAddresses => {
		return this.addresses.objects.exchanges.get(inputs.coinType)!;
	};

	public getAccountCapType = (inputs: { coinType: CoinType }): string => {
		return `${this.addresses.packages.perpetuals}::
		${PerpetualsApi.constants.moduleNames.accountManager}::AccountCap<${inputs.coinType}>`;
	};
}

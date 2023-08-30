import {
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	SuiRawMoveObject,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { StructTypeDefinition, TypeName } from "@mysten/bcs";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	CoinType,
	AccountStruct,
	PerpetualsAddresses,
	ExchangeAddresses,
	Timestamp,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { PerpetualsAccount } from "../perpetualsAccount";
import {
	AccountManagerObj,
	bcs,
	MarketManagerObj,
	MarketParams,
	MarketState,
	OrderCasted,
} from "../perpetualsTypes";
import { PerpetualsCasting } from "./perpetualsCasting";

export class PerpetualsApi {
	// =========================================================================
	//  Class Members
	// =========================================================================
	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			accountManager: "account_manager",
		},
	};

	public readonly addresses: PerpetualsAddresses;

	public readonly accountCapType: AnyObjectType;

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

		this.accountCapType = `${this.addresses.packages.perpetuals}::
			${PerpetualsApi.constants.moduleNames.accountManager}::AccountCap`;
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAccountManagerObj = async (
		coinType: CoinType
	): Promise<AccountManagerObj> => {
		const exchangeCfg = this.getExchangeConfig(coinType);
		return await this.Provider.Objects().fetchCastObjectGeneral({
			objectId: exchangeCfg.accountManager,
			objectFromSuiObjectResponse:
				PerpetualsCasting.accountManagerObjFromSuiObjectResponse,
			options: {
				showBcs: true,
				showType: true,
			},
		});
	};

	public fetchMarketManagerObj = async (
		coinType: CoinType
	): Promise<MarketManagerObj> => {
		const exchangeCfg = this.getExchangeConfig(coinType);
		return await this.Provider.Objects().fetchCastObjectGeneral({
			objectId: exchangeCfg.marketManager,
			objectFromSuiObjectResponse:
				PerpetualsCasting.marketManagerObjFromSuiObjectResponse,
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
		const accountCapType = `{this.accountCapType}<{coinType}>`;
		const accountCaps =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress({
				walletAddress: inputs.walletAddress,
				objectType: accountCapType,
			});
		return accountCaps.map((x: SuiObjectResponse) => {
			return x.data!.objectId;
		});
	};

	public fetchPositionOrderIds = async (
		coinType: CoinType,
		accountId: bigint,
		marketId: bigint
	): Promise<bigint[][]> => {
		let account_struct = await this.fetchAccount(coinType, accountId);
		let account = new PerpetualsAccount(accountId, account_struct);
		let position = account.positionForMarketId({ marketId });

		let table_vec_asks = await this.fetchTableVec(
			position.asks.outerNodes.contents.objectId,
			"OuterNode<u64>",
			PerpetualsCasting.outerNodeFromRawPartial(BigInt)
		);
		let table_vec_bids = await this.fetchTableVec(
			position.bids.outerNodes.contents.objectId,
			"OuterNode<u64>",
			PerpetualsCasting.outerNodeFromRawPartial(BigInt)
		);

		let askOrderIds: bigint[] = table_vec_asks.map((node) => node.key);
		let bidOrderIds: bigint[] = table_vec_bids.map((node) => node.key);
		return [askOrderIds, bidOrderIds];
	};

	public fetchAccount = async (
		coinType: CoinType,
		accountId: bigint
	): Promise<AccountStruct> => {
		let accountDfInfos =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId:
					this.addresses.objects.exchanges.get(coinType)
						?.accountManager!,
			});

		let accountDfInfo = accountDfInfos.find((info) => {
			return BigInt(info.name.value.account_id) === accountId;
		})!;

		let objectResponse = (await this.Provider.provider.getObject({
			id: accountDfInfo.objectId,
			options: { showBcs: true },
		})) as SuiObjectResponse;
		let bcsData = objectResponse.data?.bcs as SuiRawMoveObject;
		let accountField = bcs.de(
			"Field<u64, Account>",
			bcsData.bcsBytes,
			"base64"
		);

		return PerpetualsCasting.accountFromRaw(accountField.value);
	};

	public fetchMarketState = async (
		coinType: CoinType,
		marketId: bigint
	): Promise<MarketState> => {
		const pkg = this.addresses.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(coinType).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::State>`,
					value: { market_id: String(marketId) },
				},
			});
		const objectResp = (await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		})) as SuiObjectResponse;
		const bcsData = objectResp.data?.bcs as SuiRawMoveObject;
		const mktStateField = bcs.de(
			"Field<MarketKey, MarketState>",
			bcsData.bcsBytes,
			"base64"
		);
		return PerpetualsCasting.marketStateFromRawBcs(mktStateField.value);
	};

	public fetchMarketParams = async (
		coinType: CoinType,
		marketId: bigint
	): Promise<MarketParams> => {
		const pkg = this.addresses.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(coinType).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::Params>`,
					value: { market_id: String(marketId) },
				},
			});
		const objectResp = (await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		})) as SuiObjectResponse;
		const bcsData = objectResp.data?.bcs as SuiRawMoveObject;
		const mktParamsField = bcs.de(
			"Field<MarketKey, MarketParams>",
			bcsData.bcsBytes,
			"base64"
		);
		return PerpetualsCasting.marketParamsFromRawBcs(mktParamsField.value);
	};

	public async fetchTableVec<T>(
		objectId: ObjectId,
		valueType: TypeName | StructTypeDefinition,
		fromRaw: (value: any) => T
	): Promise<T[]> {
		let dfs =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId: objectId,
			});
		let idxs_and_ids = dfs
			.map((value) => {
				return { idx: value.name.value, id: value.objectId };
			})
			.sort((a, b) => a.idx - b.idx);
		let values: T[] = [];
		for (const { id } of idxs_and_ids) {
			let resp = (await this.Provider.provider.getObject({
				id,
				options: { showBcs: true },
			})) as SuiObjectResponse;
			const bcsData = resp.data?.bcs as SuiRawMoveObject;
			const deserialized = bcs.de(
				`Field<u64, ${valueType}>`,
				bcsData.bcsBytes,
				"base64"
			);
			values.push(fromRaw(deserialized.value));
		}
		return values;
	}

	public fetchCastObjectBcs = async <T>(inputs: {
		objectId: ObjectId;
		typeName: TypeName;
		fromDeserialized: (deserialized: any) => T;
	}): Promise<T> => {
		const { objectId, typeName, fromDeserialized } = inputs;
		const resp = await this.Provider.Objects().fetchObjectBcs(objectId);
		const rawObj = resp.data?.bcs as SuiRawMoveObject;
		const deserialized = bcs.de(typeName, rawObj.bcsBytes, "base64");
		return fromDeserialized(deserialized);
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
		let exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
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
		marketId: bigint;
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
		} = inputs;
		let exchangeCfg = this.addresses.objects.exchanges.get(coinType)!;
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
		marketId: bigint;
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
		marketId: bigint;
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
		marketId: bigint;
		side: boolean;
		orderId: bigint;
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
		liqeeAccountId: bigint;
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
		marketId: bigint;
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

	public fetchAddInsuranceFundTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.addInsuranceFundTx({ tx, ...inputs });

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
		accountCapId: ObjectId | TransactionArgument;
		coinAmount: bigint;
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
		accountCapId: ObjectId | TransactionArgument;
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
		accountCapId: ObjectId | TransactionArgument;
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
		accountCapId: ObjectId | TransactionArgument;
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

	public fetchWithdrawCollateralTx = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
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
		accountCapId: ObjectId | TransactionArgument;
		liqeeAccountId: bigint;
		sizes: bigint[];
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		this.liquidateTx({
			tx,
			...inputs,
		});

		return tx;
	};

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
	//  Helpers
	// =========================================================================

	public getExchangeConfig = (coinType: CoinType): ExchangeAddresses => {
		return this.addresses.objects.exchanges.get(coinType)!;
	};
}

import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import {} from "@mysten/sui.js/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinType,
	PerpetualsAccountObject,
	PerpetualsAddresses,
	ExchangeAddresses,
	ObjectId,
	SuiAddress,
	OracleAddresses,
} from "../../../types";
import { Casting, Helpers } from "../../../general/utils";
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
	PerpetualsAccountCap,
	PerpetualsAccountData,
	ApiPerpetualsSLTPOrderBody,
	PerpetualsOrderSide,
	PerpetualsOrderType,
	PerpetualsOrderbook,
	ApiPerpetualsLimitOrderBody,
	ApiPerpetualsMarketOrderBody,
	ApiPerpetualsPreviewOrderBody,
	ApiPerpetualsPreviewOrderResponse,
	ApiPerpetualsOrderbookPriceBody,
	ApiPerpetualsAccountsBody,
} from "../perpetualsTypes";
import { PerpetualsApiCasting } from "./perpetualsApiCasting";
import { PerpetualsAccount } from "../perpetualsAccount";
import { Perpetuals } from "../perpetuals";
import { InspectionsApiHelpers } from "../../../general/api/inspectionsApiHelpers";
import { FixedUtils } from "../../../general/utils/fixedUtils";

export class PerpetualsApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			accountManager: "account_manager",
			marketManager: "market_manager",
			orderbook: "orderbook",
		},
	};

	public readonly addresses: {
		perpetuals: PerpetualsAddresses;
		oracle: OracleAddresses;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const perpetuals = this.Provider.addresses.perpetuals;
		const oracle = this.Provider.addresses.oracle;
		if (!perpetuals || !oracle)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			perpetuals,
			oracle,
		};
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
				PerpetualsApiCasting.accountManagerFromSuiResponse,
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
				PerpetualsApiCasting.marketManagerFromSuiResponse,
			options: {
				showBcs: true,
				showType: true,
			},
		});
	};

	// public fetchOwnedAccountCaps = async (inputs: {
	// 	walletAddress: SuiAddress;
	// }): Promise<PerpetualsAccountCap[]> => {
	// 	const { walletAddress } = inputs;

	// 	const allAccountCaps = await Promise.all(
	// 		Perpetuals.constants.collateralCoinTypes.map((coinType) => {
	// 			const objectType = this.getAccountCapType({ coinType });
	// 			return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType(
	// 				{
	// 					objectType,
	// 					walletAddress,
	// 					objectFromSuiObjectResponse:
	// 						PerpetualsApiCasting.accountCapFromSuiResponse,
	// 					options: {
	// 						showBcs: true,
	// 						showType: true,
	// 					},
	// 				}
	// 			);
	// 		})
	// 	);
	// 	return allAccountCaps.reduce((acc, caps) => [...acc, ...caps], []);
	// };

	public fetchOwnedAccountCapsOfType = async (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
	}): Promise<PerpetualsAccountCap[]> => {
		const { walletAddress, coinType } = inputs;
		const objectType = this.getAccountCapType({ coinType });

		let objectResponse =
			await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress({
				objectType,
				walletAddress,
				options: {
					showBcs: true,
					showType: true,
				},
			});

		let accCaps: PerpetualsAccountCap[] = objectResponse.map((accCap) => {
			const accCapObj = bcs.de(
				"AccountCap",
				Casting.bcsBytesFromSuiObjectResponse(accCap),
				"base64"
			);
			return PerpetualsApiCasting.accountCapWithTypeFromRaw(
				accCapObj,
				coinType
			);
		});

		return accCaps;
	};

	public fetchAccount = async (inputs: {
		coinType: CoinType;
		accountId: PerpetualsAccountId;
	}): Promise<PerpetualsAccountObject> => {
		const accountDfInfos =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId:
					this.addresses.perpetuals.objects.exchanges[inputs.coinType]
						?.accountManager!,
			});

		const accountDfInfo = accountDfInfos.find((info) => {
			return (
				BigInt((info.name.value as any).account_id) === inputs.accountId
			);
		})!;

		const objectResponse = await this.Provider.provider.getObject({
			id: accountDfInfo.objectId,
			options: { showBcs: true },
		});
		const accountField = bcs.de(
			"Field<u64, Account>",
			Casting.bcsBytesFromSuiObjectResponse(objectResponse),
			"base64"
		);

		return PerpetualsApiCasting.accountFromRaw(accountField.value);
	};

	public fetchAllAccountDatas = async (
		inputs: ApiPerpetualsAccountsBody
	): Promise<PerpetualsAccountData[]> => {
		const accountCaps = await this.fetchOwnedAccountCapsOfType(inputs);
		const accounts = await Promise.all(
			accountCaps.map((cap) => this.fetchAccount(cap))
		);
		return accounts.map((account, index) => ({
			account,
			accountCap: accountCaps[index],
		}));
	};

	// TODO: make this solution better
	public fetchPositionOrderIds = async (inputs: {
		coinType: CoinType;
		accountId: PerpetualsAccountId;
		marketId: PerpetualsMarketId;
	}): Promise<{
		askOrderIds: PerpetualsOrderId[];
		bidOrderIds: PerpetualsOrderId[];
	}> => {
		const { coinType, accountId, marketId } = inputs;

		const accountStruct = await this.fetchAccount({ coinType, accountId });
		const account = new PerpetualsAccount(accountStruct, {
			accountId,
			coinType,
			objectId: "",
			objectType: "",
		});
		const position = account.positionForMarketId({ marketId });

		const [askOrderIds, bidOrderIds] = await Promise.all([
			this.fetchOrderedVecSet({
				objectId: position.asks.objectId,
			}),
			this.fetchOrderedVecSet({
				objectId: position.bids.objectId,
			}),
		]);
		return {
			askOrderIds,
			bidOrderIds,
		};
	};

	public fetchMarketState = async (inputs: {
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketState> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
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
		const mktStateField = bcs.de(
			"Field<MarketKey, MarketState>",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);
		return PerpetualsApiCasting.marketStateFromRaw(mktStateField.value);
	};

	public fetchMarketParams = async (inputs: {
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarketParams> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
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
		const mktParamsField = bcs.de(
			"Field<MarketKey, MarketParams>",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);
		return PerpetualsApiCasting.marketParamsFromRaw(mktParamsField.value);
	};

	public fetchOrderbook = async (inputs: {
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsOrderbook> => {
		const pkg = this.addresses.perpetuals.packages.perpetuals;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		const resp =
			await this.Provider.DynamicFields().fetchDynamicFieldObject({
				parentId: mktMngId,
				name: {
					type: `${pkg}::keys::Market<${pkg}::keys::Orderbook>`,
					value: { market_id: String(inputs.marketId) },
				},
			});
		const objectResp = await this.Provider.provider.getObject({
			id: resp.data?.objectId!,
			options: { showBcs: true },
		});
		const orderbook = bcs.de(
			"Orderbook",
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);

		return PerpetualsApiCasting.orderbookFromRaw(orderbook);
	};

	public fetchOrderedVecSet = async (inputs: {
		objectId: ObjectId;
	}): Promise<bigint[]> => {
		const keyType = `${this.addresses.perpetuals.packages.perpetuals}::ordered_vec_set::Contents`;
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
		const orderKeys = bcs.de(
			`Field<Contents, vector<u128>>`,
			Casting.bcsBytesFromSuiObjectResponse(objectResp),
			"base64"
		);

		const res = orderKeys.value.map((value: string) => {
			return BigInt(value);
		});
		return res;
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPreviewOrder = async (
		inputs: ApiPerpetualsPreviewOrderBody
	): Promise<ApiPerpetualsPreviewOrderResponse> => {
		const { orderbookId } = inputs;
		const sender = inputs.walletAddress;

		const tx = new TransactionBlock();
		tx.setSender(sender);

		// get orderbook price before order
		this.bookPriceTx({ tx, orderbookId });

		// place order
		if ("slPrice" in inputs) {
			this.placeSLTPOrderTx({ ...inputs, tx });
		} else if ("price" in inputs) {
			this.placeLimitOrderTx({ ...inputs, tx });
		} else {
			this.placeMarketOrderTx({ ...inputs, tx });
		}

		// get account state after order
		this.getAccountTx({ ...inputs, tx });
		// get orderbook price after order
		this.bookPriceTx({ tx, orderbookId });

		// inspect tx
		const bytes =
			await this.Provider.Inspections().fetchAllBytesFromTxOutput({
				tx,
				sender,
			});

		// deserialize account
		const accountAfterOrder = PerpetualsApiCasting.accountFromRaw(
			bcs.de("Account", new Uint8Array(bytes[1]))
		);
		// deserialize orderbook prices
		const orderbookPriceBeforeOrder =
			PerpetualsApiCasting.orderbookPriceFromBytes(bytes[0]);
		const orderbookPriceAfterOrder =
			PerpetualsApiCasting.orderbookPriceFromBytes(bytes[2]);

		return {
			accountAfterOrder,
			orderbookPriceBeforeOrder,
			orderbookPriceAfterOrder,
		};
	};

	public fetchOrderbookPrice = async (
		inputs: ApiPerpetualsOrderbookPriceBody
	): Promise<number> => {
		const { orderbookId } = inputs;

		const tx = new TransactionBlock();

		this.bookPriceTx({ tx, orderbookId });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		return PerpetualsApiCasting.orderbookPriceFromBytes(bytes);
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
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"initialize_for_collateral"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.object(this.addresses.perpetuals.objects.registry),
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
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"transfer_admin_cap"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.pure(targetAddress),
			],
		});
	};

	public addInsuranceFundTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
	}) => {
		const { tx, coinType } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"add_insurance_fund"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_market"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(this.addresses.perpetuals.objects.adminCapability),
				tx.object(exchangeCfg.marketManager),
				tx.object(exchangeCfg.insuranceFunds),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
		side: PerpetualsOrderSide;
		size: bigint;
	}) => {
		const { tx, coinType, accountCapId, marketId, side, size } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(marketId),
				tx.pure(Boolean(side)),
				tx.pure(size),
			],
		});
	};

	public placeLimitOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		size: bigint;
		price: bigint;
		orderType: PerpetualsOrderType;
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
				tx.object(Sui.constants.addresses.suiClockId),
				tx.pure(marketId),
				tx.pure(Boolean(side)),
				tx.pure(size),
				tx.pure(price),
				tx.pure(BigInt(orderType)),
			],
		});
	};

	public cancelOrderTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		marketId: PerpetualsMarketId;
		side: PerpetualsOrderSide;
		orderId: PerpetualsOrderId;
	}) => {
		const { tx, coinType, accountCapId, marketId, side, orderId } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
				tx.pure(Boolean(side)),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
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
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"update_funding"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(exchangeCfg.marketManager),
				tx.object(this.addresses.oracle.objects.priceFeedStorage),
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
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType]!;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.interface,
				"create_account"
			),
			typeArguments: [coinType],
			arguments: [tx.object(exchangeCfg.accountManager)],
		});
	};

	public placeSLTPOrderTx = (
		inputs: ApiPerpetualsSLTPOrderBody & {
			tx: TransactionBlock;
		}
	) => {
		const { tx } = inputs;
		// TODO: make suggested changes

		const txResult =
			"price" in inputs
				? this.placeLimitOrderTx({ ...inputs, tx })
				: this.placeMarketOrderTx({ ...inputs, tx });

		const orderType = PerpetualsOrderType.PostOnly;
		const side =
			inputs.side === PerpetualsOrderSide.Ask
				? PerpetualsOrderSide.Bid
				: PerpetualsOrderSide.Ask;

		// TODO: we can improve these checks to trigger SL and TP

		const orderPrice =
			"price" in inputs ? inputs.price : inputs.marketPrice;
		// If ASK and SL price is above target price, then place SL order too
		if (
			"slPrice" in inputs &&
			inputs.side === PerpetualsOrderSide.Ask &&
			inputs.slPrice > orderPrice
		) {
			return this.placeLimitOrderTx({
				...inputs,
				tx,
				orderType,
				side,
				price: inputs.slPrice,
			});
		}

		// If BID and TP price is above target price, then place TP order too
		if (
			"tpPrice" in inputs &&
			inputs.side === PerpetualsOrderSide.Bid &&
			inputs.tpPrice > orderPrice
		) {
			return this.placeLimitOrderTx({
				...inputs,
				tx,
				orderType,
				side,
				price: inputs.tpPrice,
			});
		}

		return txResult;
	};

	public getAccountTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		accountId: PerpetualsAccountId;
	}) /* Account */ => {
		const { tx, coinType } = inputs;
		const exchangeCfg =
			this.addresses.perpetuals.objects.exchanges[coinType];
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.accountManager,
				"get_account"
			),
			typeArguments: [coinType],
			arguments: [
				tx.object(exchangeCfg.accountManager),
				tx.pure(inputs.accountId, "u64"),
			],
		});
	};

	public getOrderbookTx = (inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		marketId: PerpetualsMarketId;
	}) /* Orderbook */ => {
		const { tx, coinType } = inputs;
		const mktMngId = this.getExchangeConfig(inputs).marketManager;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.marketManager,
				"get_orderbook"
			),
			typeArguments: [coinType],
			arguments: [tx.object(mktMngId), tx.pure(inputs.marketId, "u64")],
		});
	};

	public bookPriceTx = (inputs: {
		tx: TransactionBlock;
		orderbookId: ObjectId | TransactionArgument;
	}) /* Option<u256> */ => {
		const { tx, orderbookId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.perpetuals.packages.perpetuals,
				PerpetualsApi.constants.moduleNames.orderbook,
				"book_price"
			),
			typeArguments: [],
			arguments: [
				typeof orderbookId === "string"
					? tx.object(orderbookId)
					: orderbookId,
			],
		});
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public buildInitializeForCollateralTx =
		Helpers.transactions.createBuildTxFunc(this.initializeForCollateralTx);

	public buildTransferAdminCapTx = Helpers.transactions.createBuildTxFunc(
		this.transferAdminCapTx
	);

	public buildAddInsuranceFundTx = Helpers.transactions.createBuildTxFunc(
		this.addInsuranceFundTx
	);

	public buildCreateMarketTx = Helpers.transactions.createBuildTxFunc(
		this.createMarketTx
	);

	public fetchBuildDepositCollateralTx = async (
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

	public buildPlaceMarketOrderTx = Helpers.transactions.createBuildTxFunc(
		this.placeMarketOrderTx
	);

	public buildPlaceLimitOrderTx = Helpers.transactions.createBuildTxFunc(
		this.placeLimitOrderTx
	);

	public buildCancelOrderTx = Helpers.transactions.createBuildTxFunc(
		this.cancelOrderTx
	);

	public buildWithdrawCollateralTx = (inputs: {
		walletAddress: SuiAddress;
		coinType: CoinType;
		accountCapId: ObjectId | TransactionArgument;
		amount: bigint;
	}): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const coin = this.withdrawCollateralTx({
			tx,
			...inputs,
		});

		tx.transferObjects([coin], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildLiquidateTx = Helpers.transactions.createBuildTxFunc(
		this.liquidateTx
	);

	public buildUpdateFundingTx = Helpers.transactions.createBuildTxFunc(
		this.updateFundingTx
	);

	public buildCreateAccountTx = (
		inputs: ApiPerpetualsCreateAccountBody
	): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const accCap = this.createAccountTx({
			tx,
			...inputs,
		});

		tx.transferObjects([accCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	public buildPlaceSLTPOrderTx = Helpers.transactions.createBuildTxFunc(
		this.placeSLTPOrderTx
	);

	// =========================================================================
	//  Helpers
	// =========================================================================

	public getExchangeConfig = (inputs: {
		coinType: CoinType;
	}): ExchangeAddresses => {
		return this.addresses.perpetuals.objects.exchanges[inputs.coinType]!;
	};

	public getAccountCapType = (inputs: { coinType: CoinType }): string => {
		return `${this.addresses.perpetuals.packages.perpetuals}::${PerpetualsApi.constants.moduleNames.accountManager}::AccountCap<${inputs.coinType}>`;
	};
}

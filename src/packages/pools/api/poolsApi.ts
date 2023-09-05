import {
	EventId,
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
	fromB64,
	normalizeSuiObjectId,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	CoinDecimal,
	CoinType,
	CoinsToBalance,
	CoinsToDecimals,
	CoinsToPrice,
} from "../../coin/coinTypes";
import {
	Balance,
	PoolDepositEvent,
	PoolStats,
	PoolTradeEvent,
	PoolWithdrawEvent,
	Slippage,
	PoolCreationLpCoinMetadata,
	PoolName,
	PoolDataPoint,
	PoolTradeFee,
	PoolGraphDataTimeframeKey,
	Percentage,
	AnyObjectType,
	ReferralVaultAddresses,
	PoolsAddresses,
	PoolGraphDataTimeframe,
	PoolCreationCoinInfo,
	PoolFlatness,
	PoolWeight,
	PoolWithdrawFee,
	PoolDepositFee,
	PoolCoins,
	EventsInputs,
	Url,
	AftermathRouterWrapperAddresses,
	PoolObject,
} from "../../../types";
import {
	PoolDepositEventOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Casting } from "../../../general/utils/casting";
import { Pool, Pools } from "..";
import { Aftermath } from "../../../general/providers";
import { Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import dayjs, { ManipulateType } from "dayjs";
import { PoolsApiCasting } from "./poolsApiCasting";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { RouterPoolTradeTxInputs } from "../../router";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import { FixedUtils } from "../../../general/utils/fixedUtils";

export class PoolsApi implements RouterSynchronousApiInterface<PoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "amm_interface",
			pool: "pool",
			swap: "swap",
			deposit: "deposit",
			withdraw: "withdraw",
			events: "events",
			poolRegistry: "pool_registry",
			routerWrapper: "router",
		},
		eventNames: {
			swap: "SwapEvent",
			deposit: "DepositEvent",
			withdraw: "WithdrawEvent",
		},
		defaultLpCoinIconImageUrl:
			"https://aftermath.finance/coins/lp/af_lp.svg",
		blacklistedPoolIds: [""],
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
		routerWrapper?: AftermathRouterWrapperAddresses;
	};
	public readonly eventTypes: {
		trade: AnyObjectType;
		deposit: AnyObjectType;
		withdraw: AnyObjectType;
	};

	public readonly poolVolumeDataTimeframes: Record<
		PoolGraphDataTimeframeKey,
		PoolGraphDataTimeframe
	> = {
		"1D": {
			time: 24,
			timeUnit: "hour",
		},
		"1W": {
			time: 7,
			timeUnit: "day",
		},
		"1M": {
			time: 30,
			timeUnit: "day",
		},
		"3M": {
			time: 90,
			timeUnit: "day",
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const pools = Provider.addresses.pools;
		const referralVault = Provider.addresses.referralVault;
		const routerWrapper = Provider.addresses.router?.aftermath;

		if (!pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			pools,
			referralVault,
			routerWrapper,
		};
		this.eventTypes = {
			trade: this.tradeEventType(),
			deposit: this.depositEventType(),
			withdraw: this.withdrawEventType(),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Events
	// =========================================================================

	public fetchTradeEvents = async (
		inputs: {
			// poolObjectId?: ObjectId
		} & EventsInputs
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolTradeEventOnChain,
			PoolTradeEvent
		>({
			...inputs,
			// poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.eventTypes.trade },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.eventTypes.trade },
			query: { MoveEventType: this.eventTypes.trade },
			eventFromEventOnChain: Casting.pools.poolTradeEventFromOnChain,
		});

	public fetchDepositEvents = async (
		inputs: {
			// poolObjectId?: ObjectId;
		} & EventsInputs
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolDepositEventOnChain,
			PoolDepositEvent
		>({
			...inputs,
			// query: inputs.poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.eventTypes.deposit },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: inputs.poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.eventTypes.deposit },
			query: { MoveEventType: this.eventTypes.deposit },
			eventFromEventOnChain: Casting.pools.poolDepositEventFromOnChain,
		});

	public fetchWithdrawEvents = async (
		inputs: {
			// poolObjectId?: ObjectId
		} & EventsInputs
	) =>
		await this.Provider.Events().fetchCastEventsWithCursor<
			PoolWithdrawEventOnChain,
			PoolWithdrawEvent
		>({
			...inputs,
			// poolObjectId
			// 	? {
			// 			And: [
			// 				{ MoveEventType: this.eventTypes.withdraw },
			// 				{
			// 					MoveEventField: {
			// 						path: "pool_id",
			// 						value: poolObjectId,
			// 					},
			// 				},
			// 			],
			// 	  }
			// 	: { MoveEventType: this.eventTypes.withdraw },
			query: { MoveEventType: this.eventTypes.withdraw },
			eventFromEventOnChain: Casting.pools.poolWithdrawEventFromOnChain,
		});

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchPool = async (inputs: { objectId: ObjectId }) => {
		return this.Provider.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse: Casting.pools.poolObjectFromSuiObject,
		});
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse: Casting.pools.poolObjectFromSuiObject,
		});
	};

	public fetchAllPools = async () => {
		const objectIds = await this.fetchAllPoolIds();
		return this.fetchPoolsFromIds({ objectIds });
	};

	public fetchAllPoolIds = async (): Promise<ObjectId[]> => {
		const objectIds =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.pools.objects.lpCoinsTable,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								PoolsApiCasting.poolObjectIdFromSuiObjectResponse,
						}),
				}
			);

		const filteredIds = objectIds.filter(
			(id) => !PoolsApi.constants.blacklistedPoolIds.includes(id)
		);
		return filteredIds;
	};

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	public fetchCreatePoolTx = async (inputs: {
		walletAddress: SuiAddress;
		lpCoinType: CoinType;
		lpCoinMetadata: PoolCreationLpCoinMetadata;
		coinsInfo: {
			coinType: CoinType;
			weight: Percentage;
			// TODO: make decimals optional and fetch if unset ?
			// TODO: make decimals only bigint ?
			decimals?: CoinDecimal;
			tradeFeeIn: Percentage;
			initialDeposit: Balance;
		}[];
		poolName: PoolName;
		poolFlatness: 0 | 1;
		createPoolCapId: ObjectId;
		respectDecimals: boolean;
		forceLpDecimals?: CoinDecimal;
	}): Promise<TransactionBlock> => {
		// NOTE: these are temp defaults down below since some selections are currently disabled in contracts
		return this.fetchBuildCreatePoolTx({
			...inputs,
			lpCoinIconUrl: inputs.lpCoinMetadata.iconUrl ?? "",

			poolFlatness:
				inputs.poolFlatness === 1 ? Casting.Fixed.fixedOneB : BigInt(0),

			coinsInfo: inputs.coinsInfo.map((info, index) => {
				let weight = Casting.numberToFixedBigInt(info.weight);

				if (index === 0) {
					const otherWeightsSum = Helpers.sumBigInt(
						inputs.coinsInfo
							.slice(1)
							.map((info) =>
								Casting.numberToFixedBigInt(info.weight)
							)
					);

					weight = Casting.Fixed.fixedOneB - otherWeightsSum;
				}

				return {
					...info,
					weight,
					tradeFeeIn: Casting.numberToFixedBigInt(info.tradeFeeIn),
					depositFee: BigInt(0),
					withdrawFee: BigInt(0),
					tradeFeeOut: BigInt(0),
				};
			}),
		});
	};

	public fetchBuildTradeTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const {
			walletAddress,
			pool,
			coinInAmount,
			coinInType,
			coinOutType,
			slippage,
			referrer,
		} = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const amountOut = pool.getTradeAmountOut({
			coinInAmount,
			coinInType,
			coinOutType,
			referral: referrer !== undefined,
		});

		const coinInId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: coinInType,
			coinAmount: coinInAmount,
		});

		this.tradeTx({
			tx,
			coinInId,
			poolId: pool.pool.objectId,
			expectedCoinOutAmount: amountOut,
			lpCoinType: pool.pool.lpCoinType,
			coinInType,
			coinOutType,
			slippage,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildDepositTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		amountsIn: CoinsToBalance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { walletAddress, pool, amountsIn, slippage, referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const { coins: coinTypes, balances: coinAmounts } =
			Coin.coinsAndBalancesOverZero(amountsIn);

		const { lpRatio } = pool.getDepositLpAmountOut({
			amountsIn,
			referral: referrer !== undefined,
		});

		// TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const coinIds = await this.Provider.Coin().fetchCoinsWithAmountTx({
			...inputs,
			tx,
			coinTypes,
			coinAmounts,
		});

		this.multiCoinDepositTx({
			tx,
			poolId: pool.pool.objectId,
			lpCoinType: pool.pool.lpCoinType,
			coinIds,
			coinTypes,
			expectedLpRatio,
			slippage,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildWithdrawTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		amountsOutDirection: CoinsToBalance;
		lpCoinAmount: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const {
			walletAddress,
			pool,
			amountsOutDirection,
			lpCoinAmount,
			slippage,
			referrer,
		} = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const lpRatio = pool.getMultiCoinWithdrawLpRatio({
			lpCoinAmountOut: lpCoinAmount,
		});

		const amountsOut = pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection,
			referral: referrer !== undefined,
		});

		const { coins: coinTypes, balances: coinAmounts } =
			Coin.coinsAndBalancesOverZero(amountsOut);

		const lpCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: pool.pool.lpCoinType,
			coinAmount: lpCoinAmount,
		});

		this.multiCoinWithdrawTx({
			tx,
			poolId: pool.pool.objectId,
			lpCoinType: pool.pool.lpCoinType,
			expectedAmountsOut: coinAmounts,
			coinTypes: coinTypes,
			lpCoinId,
			slippage,
			withTransfer: true,
		});

		return tx;
	};

	public fetchBuildAllCoinWithdrawTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		lpCoinAmount: Balance;
		referrer?: SuiAddress;
	}): Promise<TransactionBlock> => {
		const { walletAddress, pool, lpCoinAmount, referrer } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const lpCoinId = await this.Provider.Coin().fetchCoinWithAmountTx({
			tx,
			walletAddress,
			coinType: pool.pool.lpCoinType,
			coinAmount: lpCoinAmount,
		});

		const coinTypes = Object.keys(pool.pool.coins);

		this.allCoinWithdrawTx({
			tx,
			poolId: pool.pool.objectId,
			lpCoinType: pool.pool.lpCoinType,
			coinTypes,
			lpCoinId,
			withTransfer: true,
		});

		return tx;
	};

	public buildPublishLpCoinTx = (inputs: {
		walletAddress: SuiAddress;
	}): TransactionBlock => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const upgradeCap = this.publishLpCoinTx({ tx });
		tx.transferObjects([upgradeCap], tx.pure(inputs.walletAddress));

		return tx;
	};

	public fetchBuildCreatePoolTx = async (inputs: {
		walletAddress: SuiAddress;
		lpCoinType: CoinType;
		lpCoinMetadata: PoolCreationLpCoinMetadata;
		coinsInfo: PoolCreationCoinInfo[];
		poolName: PoolName;
		poolFlatness: PoolFlatness;
		createPoolCapId: ObjectId;
		respectDecimals: boolean;
		forceLpDecimals?: CoinDecimal;
		lpCoinIconUrl: Url;
	}): Promise<TransactionBlock> => {
		const { coinsInfo } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		// TODO: make this fetching work

		// const createPoolCapId =
		// 	inputs.createPoolCapId !== undefined
		// 		? inputs.createPoolCapId
		// 		: (
		// 				await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress(
		// 					inputs.walletAddress,
		// 					`${this.addresses.pools.packages.cmmm}::${PoolsApi.constants.moduleNames.pool}::CreatePoolCap<${inputs.lpCoinType}>`
		// 				)
		// 		  )[0].data?.objectId;

		// if (createPoolCapId === undefined)
		// 	throw new Error(
		// 		"no CreatePoolCap for LP Coin Type found owned by address"
		// 	);

		coinsInfo.sort((a, b) => {
			const coinA = a.coinType.toUpperCase();
			const coinB = b.coinType.toUpperCase();
			return coinA < coinB ? -1 : coinA > coinB ? 1 : 0;
		});

		const coinTypes = coinsInfo.map((coin) => coin.coinType);
		const lpCoinDescription = await this.createLpCoinMetadataDescription({
			...inputs,
			coinTypes,
		});

		const coinArgs = await this.Provider.Coin().fetchCoinsWithAmountTx({
			tx,
			...inputs,
			coinTypes,
			coinAmounts: coinsInfo.map((info) => info.initialDeposit),
		});

		await this.createPoolTx({
			tx,
			...inputs,
			// createPoolCapId,
			coinsInfo: coinsInfo.map((info, index) => {
				return {
					...info,
					coinId: coinArgs[index],
				};
			}),
			lpCoinDescription,
		});

		return tx;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public tradeTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		expectedCoinOutAmount: Balance;
		coinOutType: CoinType;
		lpCoinType: CoinType;
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionArgument => {
		const {
			tx,
			poolId,
			coinInId,
			coinInType,
			expectedCoinOutAmount,
			coinOutType,
			lpCoinType,
			slippage,
			withTransfer,
		} = inputs;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterface
					: this.addresses.pools.packages.amm,
				withTransfer
					? PoolsApi.constants.moduleNames.interface
					: PoolsApi.constants.moduleNames.swap,
				"swap_exact_in"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(expectedCoinOutAmount.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
			],
		});
	};

	public routerWrapperTradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolId: ObjectId;
			lpCoinType: CoinType;
		}
	): TransactionArgument => {
		if (!this.addresses.routerWrapper)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		const {
			tx,
			poolId,
			coinInId,
			coinInType,
			expectedCoinOutAmount,
			coinOutType,
			lpCoinType,
			routerSwapCap,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.routerWrapper.packages.wrapper,
				PoolsApi.constants.moduleNames.routerWrapper,
				"add_swap_exact_in_to_route"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				lpCoinType,
				coinInType,
				coinOutType,
			],
			arguments: [
				tx.object(this.addresses.routerWrapper.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(poolId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(expectedCoinOutAmount.toString(), "u64"),
			],
		});
	};

	public multiCoinDepositTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		coinIds: ObjectId[] | TransactionArgument[];
		coinTypes: CoinType[];
		expectedLpRatio: bigint;
		lpCoinType: CoinType;
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionArgument => {
		const {
			tx,
			poolId,
			coinIds,
			coinTypes,
			expectedLpRatio,
			lpCoinType,
			slippage,
			withTransfer,
		} = inputs;

		const poolSize = coinTypes.length;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterface
					: this.addresses.pools.packages.amm,
				withTransfer
					? PoolsApi.constants.moduleNames.interface
					: PoolsApi.constants.moduleNames.deposit,
				`deposit_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				...coinIds.map((coinId) =>
					typeof coinId === "string" ? tx.object(coinId) : coinId
				),
				tx.pure(expectedLpRatio.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
			],
		});
	};

	public multiCoinWithdrawTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		lpCoinId: ObjectId | TransactionArgument;
		lpCoinType: CoinType;
		expectedAmountsOut: Balance[];
		coinTypes: CoinType[];
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionArgument => {
		const {
			tx,
			poolId,
			lpCoinId,
			expectedAmountsOut,
			coinTypes,
			lpCoinType,
			slippage,
			withTransfer,
		} = inputs;

		const poolSize = coinTypes.length;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterface
					: this.addresses.pools.packages.amm,
				withTransfer
					? PoolsApi.constants.moduleNames.interface
					: PoolsApi.constants.moduleNames.withdraw,
				`withdraw_${poolSize}_coins`
			),

			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
				tx.pure(expectedAmountsOut.map((amount) => amount.toString())),
				tx.pure(Pools.normalizeSlippage(slippage)),
			],
		});
	};

	public allCoinWithdrawTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		lpCoinId: ObjectId | TransactionArgument;
		lpCoinType: CoinType;
		coinTypes: CoinType[];
		withTransfer?: boolean;
	}): TransactionArgument[] => {
		const { tx, poolId, lpCoinId, coinTypes, lpCoinType, withTransfer } =
			inputs;

		const poolSize = coinTypes.length;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterface
					: this.addresses.pools.packages.amm,
				withTransfer
					? PoolsApi.constants.moduleNames.interface
					: PoolsApi.constants.moduleNames.withdraw,
				`all_coin_withdraw_${poolSize}_coins`
			),

			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
			],
		});
	};

	public publishLpCoinTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;

		const compiledModulesAndDeps = JSON.parse(
			this.addresses.pools.other.createLpCoinPackageCompilation
		);

		return tx.publish({
			modules: compiledModulesAndDeps.modules.map((m: any) =>
				Array.from(fromB64(m))
			),
			dependencies: compiledModulesAndDeps.dependencies.map(
				(addr: string) => normalizeSuiObjectId(addr)
			),
		});
	};

	// TODO: handle bounds checks here instead of just on-chain ?
	public createPoolTx = async (inputs: {
		tx: TransactionBlock;
		lpCoinType: CoinType;
		coinsInfo: {
			coinId: ObjectId | TransactionArgument;
			coinType: CoinType;
			weight: PoolWeight;
			decimals?: CoinDecimal;
			tradeFeeIn: PoolTradeFee;
			tradeFeeOut: PoolTradeFee;
			depositFee: PoolDepositFee;
			withdrawFee: PoolWithdrawFee;
		}[];
		lpCoinMetadata: PoolCreationLpCoinMetadata;
		lpCoinIconUrl: Url;
		createPoolCapId: ObjectId | TransactionArgument;
		poolName: PoolName;
		poolFlatness: PoolFlatness;
		lpCoinDescription: string;
		respectDecimals: boolean;
		forceLpDecimals?: CoinDecimal;
	}) => {
		const {
			tx,
			lpCoinType,
			createPoolCapId,
			coinsInfo,
			lpCoinMetadata,
			lpCoinDescription,
			lpCoinIconUrl,
		} = inputs;

		const poolSize = coinsInfo.length;
		const coinTypes = coinsInfo.map((coin) => coin.coinType);
		const decimals = coinsInfo.map((coin) => coin.decimals);

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTxTarget(
				this.addresses.pools.packages.ammInterface,
				PoolsApi.constants.moduleNames.interface,
				`create_pool_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				typeof createPoolCapId === "string"
					? tx.object(createPoolCapId)
					: createPoolCapId,
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.pure(
					Casting.u8VectorFromString(inputs.poolName),
					"vector<u8>"
				),
				tx.pure(
					Casting.u8VectorFromString(lpCoinMetadata.name.toString()),
					"vector<u8>"
				),
				tx.pure(
					Casting.u8VectorFromString(
						lpCoinMetadata.symbol.toString().toUpperCase()
					),
					"vector<u8>"
				),
				tx.pure(
					Casting.u8VectorFromString(lpCoinDescription),
					"vector<u8>"
				),
				tx.pure(
					Casting.u8VectorFromString(lpCoinIconUrl),
					"vector<u8>"
				), // lp_icon_url
				tx.pure(
					coinsInfo.map((coin) => coin.weight),
					"vector<u64>"
				),
				tx.pure(inputs.poolFlatness, "u64"),
				tx.pure(
					coinsInfo.map((coin) => coin.tradeFeeIn),
					"vector<u64>"
				),
				tx.pure(
					coinsInfo.map((coin) => coin.tradeFeeOut),
					"vector<u64>"
				),
				tx.pure(
					coinsInfo.map((coin) => coin.depositFee),
					"vector<u64>"
				),
				tx.pure(
					coinsInfo.map((coin) => coin.withdrawFee),
					"vector<u64>"
				),
				...coinsInfo.map((coin) =>
					typeof coin.coinId === "string"
						? tx.object(coin.coinId)
						: coin.coinId
				),
				tx.pure(
					Helpers.transactions.createOptionObject(
						decimals.includes(undefined) ? undefined : decimals
					),
					"Option<vector<u8>>"
				), // decimals
				tx.pure(inputs.respectDecimals, "bool"), // respect_decimals
				tx.pure(
					Helpers.transactions.createOptionObject(
						inputs.forceLpDecimals
					),
					"Option<u8>"
				), // force_lp_decimals
			],
		});
	};

	public poolObjectIdForLpCoinTypeTx = (inputs: {
		tx: TransactionBlock;
		lpCoinType: CoinType;
	}) => {
		const { tx, lpCoinType } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.pools.packages.amm,
				PoolsApi.constants.moduleNames.poolRegistry,
				"lp_type_to_pool_id"
			),
			typeArguments: [lpCoinType],
			arguments: [tx.object(this.addresses.pools.objects.poolRegistry)],
		});
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPoolObjectIdForLpCoinType = async (inputs: {
		lpCoinType: CoinType;
	}): Promise<ObjectId> => {
		const tx = new TransactionBlock();

		this.poolObjectIdForLpCoinTypeTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		return Casting.addressFromBytes(bytes);
	};

	public fetchSupportedCoins = async () => {
		const pools = await this.Provider.Pools().fetchAllPools();
		const allCoins: CoinType[] = pools
			.map((pool) => Object.keys(pool.coins))
			.reduce((prev, cur) => [...prev, ...cur], []);

		const uniqueCoins = Helpers.uniqueArray(allCoins);
		return uniqueCoins;
	};

	// =========================================================================
	//  Stats
	// =========================================================================

	// TODO: use promise.all to execute some of this fetching in parallel
	public fetchPoolStats = async (inputs: {
		pool: Pool;
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
	}): Promise<PoolStats> => {
		const { pool, coinsToPrice, coinsToDecimals } = inputs;

		const poolCoins = pool.pool.coins;

		// TODO: remove all notions of sdk from api functions !

		const tradeEventsWithinTime =
			await this.Provider.Events().fetchEventsWithinTime({
				fetchEventsFunc: (eventsInputs) =>
					pool.getTradeEvents(eventsInputs),
				timeUnit: "hour",
				time: 24,
				limitStepSize: 512,
			});

		const volume = this.fetchCalcPoolVolume(
			tradeEventsWithinTime,
			coinsToPrice,
			coinsToDecimals
		);

		const tvl = await this.fetchCalcPoolTvl({
			poolCoins: pool.pool.coins,
			coinsToPrice,
			coinsToDecimals,
		});
		const supplyPerLps = this.calcPoolSupplyPerLps(
			poolCoins,
			pool.pool.lpCoinSupply
		);
		const lpPrice = this.calcPoolLpPrice({
			lpCoinDecimals: pool.pool.lpCoinDecimals,
			lpCoinSupply: pool.pool.lpCoinSupply,
			tvl,
		});

		// this is okay since all trade fees are currently the same for every coin
		const firstCoin = Object.values(pool.pool.coins)[0];
		const fees =
			volume *
			Pools.tradeFeeWithDecimals(
				firstCoin.tradeFeeIn + firstCoin.tradeFeeOut
			);

		const apy = this.calcApy({
			fees24Hours: fees,
			tvl,
		});

		return {
			volume,
			tvl,
			supplyPerLps,
			lpPrice,
			fees,
			apy,
		};
	};

	// NOTE: should this volume calculation also take into account deposits and withdraws
	// (not just swaps) ?
	public fetchCalcPoolVolume = (
		tradeEvents: PoolTradeEvent[],
		coinsToPrice: CoinsToPrice,
		coinsToDecimals: Record<CoinType, CoinDecimal>
	) => {
		let volume = 0;
		for (const trade of tradeEvents) {
			for (const [index, typeIn] of trade.typesIn.entries()) {
				const decimals = coinsToDecimals[typeIn];
				const tradeAmount = Coin.balanceWithDecimals(
					trade.amountsIn[index],
					decimals
				);

				const coinInPrice = coinsToPrice[typeIn];
				const amountUsd =
					coinInPrice < 0 ? 0 : tradeAmount * coinInPrice;
				volume += amountUsd;
			}
		}

		return volume;
	};

	public fetchCalcPoolTvl = async (inputs: {
		poolCoins: PoolCoins;
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: Record<CoinType, CoinDecimal>;
	}) => {
		const { poolCoins, coinsToPrice, coinsToDecimals } = inputs;

		let tvl = 0;

		for (const [poolCoinType, poolCoin] of Object.entries(poolCoins)) {
			const amountWithDecimals = Coin.balanceWithDecimals(
				poolCoin.balance,
				coinsToDecimals[poolCoinType]
			);
			const price = coinsToPrice[poolCoinType];

			tvl += amountWithDecimals * (price < 0 ? 0 : price);
		}

		return tvl;
	};

	public calcPoolSupplyPerLps = (poolCoins: PoolCoins, lpSupply: Balance) => {
		const supplyPerLps = Object.values(poolCoins).map(
			(poolCoin) => Number(poolCoin.balance) / Number(lpSupply)
		);

		return supplyPerLps;
	};

	public calcPoolLpPrice = (inputs: {
		lpCoinSupply: Balance;
		tvl: number;
		lpCoinDecimals: CoinDecimal;
	}) => {
		const { lpCoinSupply, tvl, lpCoinDecimals } = inputs;
		const lpPrice = Number(
			Number(tvl) / Coin.balanceWithDecimals(lpCoinSupply, lpCoinDecimals)
		);
		return lpPrice;
	};

	public calcApy = (inputs: { fees24Hours: number; tvl: number }): number => {
		const { fees24Hours, tvl } = inputs;
		// TODO: use daysjs instead
		const daysInYear = 365;

		return (fees24Hours * daysInYear) / tvl;
	};

	// =========================================================================
	//  Prices
	// =========================================================================

	// TODO: make this faster this is slow as shit when LP balances are involved...
	// (so much fetching!)
	// TODO: rename this function and/or move it ?
	public fetchLpCoinsToPrice = async (
		provider: Aftermath,
		lpCoins: CoinType[]
	) => {
		// PRODUCTION: remove all notions of sdk from api functions !

		const unsafeLpCoinPoolObjectIds = await Promise.all(
			lpCoins.map(async (lpCoinType) => {
				try {
					return await provider
						.Pools()
						.getPoolObjectIdForLpCoinType({ lpCoinType });
				} catch (e) {
					return "";
				}
			})
		);

		const safeIndexes: number[] = [];
		const lpCoinPoolObjectIds = unsafeLpCoinPoolObjectIds.filter(
			(id, index) => {
				const isValid = id !== "";

				if (isValid) safeIndexes.push(index);

				return isValid;
			}
		);

		const lpCoinPools = await provider
			.Pools()
			.getPools({ objectIds: lpCoinPoolObjectIds });

		const poolStats = await Promise.all(
			lpCoinPools.map((lpPool) => lpPool.getStats())
		);

		let lpCoinsToPrice: CoinsToPrice = {};

		for (const [index, safeIndex] of safeIndexes.entries()) {
			const lpCoin = lpCoins[safeIndex];
			const coinPrice = poolStats[index].lpPrice;

			lpCoinsToPrice = {
				...lpCoinsToPrice,
				[lpCoin]: coinPrice,
			};
		}

		for (const [index, lpCoin] of lpCoins.entries()) {
			if (safeIndexes.includes(index)) continue;

			lpCoinsToPrice = {
				...lpCoinsToPrice,
				[lpCoin]: -1,
			};
		}

		return lpCoinsToPrice;
	};

	// =========================================================================
	//  Graph Data
	// =========================================================================

	public fetchPoolVolumeData = async (inputs: {
		poolObjectId: ObjectId;
		timeframe: PoolGraphDataTimeframeKey;
		coinsToDecimals: CoinsToDecimals;
		coinsToPrice: CoinsToPrice;
	}): Promise<PoolDataPoint[]> => {
		const timeframeValue = this.poolVolumeDataTimeframes[inputs.timeframe];

		const tradeEvents = (
			await this.Provider.Events().fetchEventsWithinTime({
				// TODO: fetch only pool's events
				fetchEventsFunc: this.fetchTradeEvents,
				...timeframeValue,
				limitStepSize: 512,
			})
		).filter((trade) => trade.poolId === inputs.poolObjectId);

		return this.calcPoolVolumeData({
			...inputs,
			...timeframeValue,
			tradeEvents,
			buckets: timeframeValue.time,
		});
	};

	public calcPoolFeeDataFromVolume = (inputs: {
		volumeData: PoolDataPoint[];
		poolTradeFee: PoolTradeFee;
	}): PoolDataPoint[] => {
		const feeData = inputs.volumeData.map((data) => ({
			time: data.time,
			value: data.value * Pools.tradeFeeWithDecimals(inputs.poolTradeFee),
		}));

		return feeData;
	};

	public calcPoolVolumeData = (inputs: {
		tradeEvents: PoolTradeEvent[];
		timeUnit: ManipulateType;
		time: number;
		buckets: number;
		coinsToDecimals: CoinsToDecimals;
		coinsToPrice: CoinsToPrice;
	}) => {
		const {
			tradeEvents,
			timeUnit,
			time,
			buckets,
			coinsToDecimals,
			coinsToPrice,
		} = inputs;

		const now = Date.now();
		const maxTimeAgo = dayjs(now).subtract(time, timeUnit);
		const timeGap = dayjs(now).diff(maxTimeAgo);

		const bucketTimestampSize = timeGap / buckets;
		const emptyDataPoints: PoolDataPoint[] = Array(buckets)
			.fill({
				time: 0,
				value: 0,
			})
			.map((dataPoint, index) => {
				return {
					...dataPoint,
					time: maxTimeAgo.valueOf() + index * bucketTimestampSize,
				};
			});

		const dataPoints = tradeEvents.reduce((acc, trade) => {
			if (trade.timestamp === undefined) return acc;

			const tradeDate = dayjs.unix(trade.timestamp / 1000);
			const bucketIndex =
				acc.length -
				Math.floor(dayjs(now).diff(tradeDate) / bucketTimestampSize) -
				1;

			const amountUsd = trade.typesIn.reduce((acc, cur, index) => {
				const price = coinsToPrice[cur];
				const amountInUsd =
					price < 0
						? 0
						: Coin.balanceWithDecimalsUsd(
								trade.amountsIn[index],
								coinsToDecimals[cur],
								price
						  );
				return acc + (amountInUsd < 0 ? 0 : amountInUsd);
			}, 0);

			acc[bucketIndex].value += amountUsd;

			return acc;
		}, emptyDataPoints);

		return dataPoints;
	};

	// =========================================================================
	//  LP Coin Metadata
	// =========================================================================

	public createLpCoinMetadataDescription = async (inputs: {
		poolName: PoolName;
		coinTypes: CoinType[];
	}) => {
		// TODO: do all of this a little bit cleaner
		// TODO: should metadata be passed into pool creation func ?
		const coinSymbols = (
			await Promise.all(
				inputs.coinTypes.map((coin) =>
					this.Provider.Coin().fetchCoinMetadata(coin)
				)
			)
		).map((metadata) => metadata.symbol);
		return `Aftermath LP coin for ${
			inputs.poolName
		} Pool (${coinSymbols.reduce(
			(acc, symbol, index) =>
				acc + symbol + (index >= coinSymbols.length - 1 ? "" : ", "),
			""
		)})`;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private tradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.events,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.swap
		);

	private depositEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.events,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.deposit
		);

	private withdrawEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.events,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.withdraw
		);
}

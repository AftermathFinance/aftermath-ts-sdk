import {
	TransactionObjectArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { fromB64, normalizeSuiObjectId } from "@mysten/sui.js/utils";
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
	IndexerDataWithCursorQueryParams,
	ApiIndexerEventsBody,
	ObjectId,
	SuiAddress,
	ApiPublishLpCoinBody,
	PoolLpInfo,
} from "../../../types";
import {
	PoolDepositEventOnChain,
	PoolTradeEventOnChain,
	PoolTradeEventOnChainFields,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Casting } from "../../../general/utils/casting";
import { Pool } from "../pool";
import { Pools } from "../pools";
import { Aftermath } from "../../../general/providers";
import { Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import dayjs, { ManipulateType } from "dayjs";
import { PoolsApiCasting } from "./poolsApiCasting";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { RouterPoolTradeTxInputs } from "../../router";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import duration, { DurationUnitType } from "dayjs/plugin/duration";
import { IndexerEventOnChain } from "../../../general/types/castingTypes";
import { Fixed } from "../../../general/utils/fixed";

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

	public static readonly poolVolumeDataTimeframes: Record<
		PoolGraphDataTimeframeKey,
		PoolGraphDataTimeframe
	> = {
		"1D": {
			time: 24,
			timeUnit: "hour",
		},
		// "1W": {
		// 	time: 7,
		// 	timeUnit: "day",
		// },
		// "1M": {
		// 	time: 30,
		// 	timeUnit: "day",
		// },
		// "3M": {
		// 	time: 90,
		// 	timeUnit: "day",
		// },
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
	//  Events
	// =========================================================================

	public async fetchTradeEvents(
		inputs: ApiIndexerEventsBody & {
			poolId: ObjectId;
		}
	) {
		const { poolId, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`pools/${poolId}/events/swap`,
			{
				cursor,
				limit,
			},
			Casting.pools.poolTradeEventFromIndexerOnChain
		);
	}

	public async fetchWithdrawEvents(
		inputs: ApiIndexerEventsBody & {
			poolId: ObjectId;
		}
	) {
		const { poolId, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`pools/${poolId}/events/withdraw`,
			{
				cursor,
				limit,
			},
			Casting.pools.poolWithdrawEventFromIndexerOnChain
		);
	}

	public async fetchDepositEvents(
		inputs: ApiIndexerEventsBody & {
			poolId: ObjectId;
		}
	) {
		const { poolId, cursor, limit } = inputs;
		return this.Provider.indexerCaller.fetchIndexerEvents(
			`pools/${poolId}/events/deposit`,
			{
				cursor,
				limit,
			},
			Casting.pools.poolDepositEventFromIndexerOnChain
		);
	}

	public async fetchTradeEventsWithinTime(inputs: {
		poolId: ObjectId;
		timeUnit: DurationUnitType;
		time: number;
	}): Promise<PoolTradeEvent[]> {
		const { poolId, timeUnit, time } = inputs;

		dayjs.extend(duration);
		const durationMs = dayjs.duration(time, timeUnit).asMilliseconds();

		const tradeEventsOnChain =
			await this.Provider.indexerCaller.fetchIndexer<
				IndexerEventOnChain<PoolTradeEventOnChainFields>[],
				undefined,
				IndexerDataWithCursorQueryParams
			>(
				`pools/${poolId}/swap-events-within-time/${durationMs}`,
				undefined,
				{
					skip: 0,
					limit: 10000, // max from mongo ?
				}
			);

		return tradeEventsOnChain.map(
			Casting.pools.poolTradeEventFromIndexerOnChain
		);
	}

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
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		// NOTE: these are temp defaults down below since some selections are currently disabled in contracts
		return this.fetchBuildCreatePoolTx({
			...inputs,
			lpCoinIconUrl: inputs.lpCoinMetadata.iconUrl ?? "",

			poolFlatness:
				inputs.poolFlatness === 1 ? Casting.fixedOneBigInt : BigInt(0),

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

					weight = Casting.fixedOneBigInt - otherWeightsSum;
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
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const {
			walletAddress,
			pool,
			coinInAmount,
			coinInType,
			coinOutType,
			slippage,
			referrer,
			isSponsoredTx,
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
			isSponsoredTx,
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

	public fetchAddTradeTx = async (inputs: {
		tx: TransactionBlock;
		coinInId: ObjectId | TransactionObjectArgument;
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		slippage: Slippage;
		pool: Pool;
		referrer?: SuiAddress;
	}): Promise<TransactionObjectArgument> /* Coin */ => {
		const {
			tx,
			coinInId,
			coinInAmount,
			coinInType,
			coinOutType,
			slippage,
			pool,
			referrer,
		} = inputs;

		const amountOut = pool.getTradeAmountOut({
			coinInAmount,
			coinInType,
			coinOutType,
			referral: referrer !== undefined,
		});

		return this.tradeTx({
			tx,
			coinInId,
			poolId: pool.pool.objectId,
			expectedCoinOutAmount: amountOut,
			lpCoinType: pool.pool.lpCoinType,
			coinInType,
			coinOutType,
			slippage,
		});
	};

	public fetchBuildDepositTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		amountsIn: CoinsToBalance;
		slippage: Slippage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const {
			walletAddress,
			pool,
			amountsIn,
			slippage,
			referrer,
			isSponsoredTx,
		} = inputs;

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
			isSponsoredTx,
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

	public buildPublishLpCoinTx = (
		inputs: ApiPublishLpCoinBody
	): TransactionBlock => {
		const { lpCoinDecimals } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		const upgradeCap = this.publishLpCoinTx({ tx, lpCoinDecimals });
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
		isSponsoredTx?: boolean;
	}): Promise<TransactionBlock> => {
		const { coinsInfo, isSponsoredTx } = inputs;

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
			isSponsoredTx,
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
		coinInId: ObjectId | TransactionObjectArgument;
		coinInType: CoinType;
		expectedCoinOutAmount: Balance;
		coinOutType: CoinType;
		lpCoinType: CoinType;
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionObjectArgument => {
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
	): TransactionObjectArgument => {
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
		coinIds: ObjectId[] | TransactionObjectArgument[];
		coinTypes: CoinType[];
		expectedLpRatio: bigint;
		lpCoinType: CoinType;
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionObjectArgument => {
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
		lpCoinId: ObjectId | TransactionObjectArgument;
		lpCoinType: CoinType;
		expectedAmountsOut: Balance[];
		coinTypes: CoinType[];
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionObjectArgument => {
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
		lpCoinId: ObjectId | TransactionObjectArgument;
		lpCoinType: CoinType;
		coinTypes: CoinType[];
		withTransfer?: boolean;
	}): TransactionObjectArgument[] => {
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

	public publishLpCoinTx = (inputs: {
		tx: TransactionBlock;
		lpCoinDecimals: CoinDecimal;
	}) => {
		const compilations =
			this.addresses.pools.other?.createLpCoinPackageCompilations;
		if (!compilations)
			throw new Error(
				"not all required addresses have been set in provider for lp coin publishing (requires pacakge compilations)"
			);

		const { tx, lpCoinDecimals } = inputs;
		const compiledModulesAndDeps = JSON.parse(compilations[lpCoinDecimals]);

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
			coinId: ObjectId | TransactionObjectArgument;
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
		createPoolCapId: ObjectId | TransactionObjectArgument;
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

	public fetchOwnedLpCoinPositions = async (inputs: {
		walletAddress: SuiAddress;
	}): Promise<PoolLpInfo[]> => {
		const { walletAddress } = inputs;

		const [coinsToBalance, pools] = await Promise.all([
			this.Provider.Wallet().fetchAllCoinBalances({
				walletAddress,
			}),
			this.fetchAllPools(),
		]);

		let lpInfo: PoolLpInfo[] = [];
		for (const pool of pools) {
			const lpCoinType = Helpers.addLeadingZeroesToType(pool.lpCoinType);
			if (!(lpCoinType in coinsToBalance)) continue;

			lpInfo.push({
				lpCoinType,
				poolId: pool.objectId,
				balance: coinsToBalance[lpCoinType],
			});
		}
		return lpInfo;
	};

	// =========================================================================
	//  Stats
	// =========================================================================

	// TODO: use promise.all to execute some of this fetching in parallel
	public fetchPoolStats = async (inputs: {
		pool: Pool;
		tradeEventsWithinTime: PoolTradeEvent[];
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
	}): Promise<PoolStats> => {
		const { pool, tradeEventsWithinTime, coinsToPrice, coinsToDecimals } =
			inputs;

		const poolCoins = pool.pool.coins;

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
			Fixed.directCast(firstCoin.tradeFeeIn + firstCoin.tradeFeeOut);

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

	public calcPoolFeeDataFromVolume = (inputs: {
		volumeData: PoolDataPoint[];
		poolTradeFee: PoolTradeFee;
	}): PoolDataPoint[] => {
		const feeData = inputs.volumeData.map((data) => ({
			time: data.time,
			value: data.value * Fixed.directCast(inputs.poolTradeFee),
		}));

		return feeData;
	};

	public calcPoolVolumeData = (inputs: {
		tradeEvents: PoolTradeEvent[];
		timeUnit: ManipulateType;
		time: number;
		coinsToDecimals: CoinsToDecimals;
		coinsToPrice: CoinsToPrice;
	}) => {
		const { tradeEvents, timeUnit, time, coinsToDecimals, coinsToPrice } =
			inputs;
		const buckets = time;

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

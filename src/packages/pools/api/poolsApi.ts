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
	CoinGeckoTickerData,
	CoinGeckoHistoricalTradeData,
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
import {
	IndexerEventOnChain,
	IndexerSwapVolumeResponse,
} from "../../../general/types/castingTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";

/**
 * This file contains the implementation of the PoolsApi class, which provides methods for interacting with the Aftermath protocol's pools.
 * @packageDocumentation
 */
/**
 * PoolsApi class that implements RouterSynchronousApiInterface<PoolObject> interface.
 * Provides methods to interact with the Pools API.
 */
export class PoolsApi implements RouterSynchronousApiInterface<PoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	/**
	 * Constants used in the pools API.
	 */
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

	/**
	 * Object containing the addresses of various contracts.
	 */
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

	/**
	 * Creates an instance of PoolsApi.
	 * @param {AftermathApi} Provider - An instance of AftermathApi.
	 * @throws {Error} Throws an error if not all required addresses have been set in provider.
	 */
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

	/**
	 * Fetches a pool object by its object ID.
	 * @async
	 * @param {ObjectId} inputs.objectId - The object ID of the pool to fetch.
	 * @returns {Promise<PoolObject>} A promise that resolves to the fetched pool object.
	 */
	public fetchPool = async (inputs: { objectId: ObjectId }) => {
		return this.Provider.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse: Casting.pools.poolObjectFromSuiObject,
		});
	};

	/**
	 * Fetches an array of pool objects by their object IDs.
	 * @async
	 * @param {ObjectId[]} inputs.objectIds - An array of object IDs of the pools to fetch.
	 * @returns {Promise<PoolObject[]>} A promise that resolves to an array of fetched pool objects.
	 */
	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse: Casting.pools.poolObjectFromSuiObject,
		});
	};

	/**
	 * Fetches all pool objects.
	 * @async
	 * @returns {Promise<PoolObject[]>} A promise that resolves to an array of all fetched pool objects.
	 */
	public fetchAllPools = async () => {
		const objectIds = await this.fetchAllPoolIds();
		return this.fetchPoolsFromIds({ objectIds });
	};

	/**
	 * Fetches all pool object IDs.
	 * @async
	 * @returns {Promise<ObjectId[]>} A promise that resolves to an array of all fetched pool object IDs.
	 */
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

	/**
	 * Fetches trade events for a pool.
	 * @async
	 * @param {ApiIndexerEventsBody & { poolId: ObjectId }} inputs - An object containing the pool ID, cursor, and limit.
	 * @returns {Promise<PoolTradeEvent[]>} A promise that resolves to an array of fetched trade events.
	 */
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

	/**
	 * Fetches withdraw events for a pool.
	 * @async
	 * @param {ApiIndexerEventsBody & { poolId: ObjectId }} inputs - An object containing the pool ID, cursor, and limit.
	 * @returns {Promise<PoolWithdrawEvent[]>} A promise that resolves to an array of fetched withdraw events.
	 */
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

	/**
	 * Fetches deposit events for a pool.
	 * @async
	 * @param {ApiIndexerEventsBody & { poolId: ObjectId }} inputs - An object containing the pool ID, cursor, and limit.
	 * @returns {Promise<PoolDepositEvent[]>} A promise that resolves to an array of fetched deposit events.
	 */
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

	/**
	 * Fetches trade events for a pool within a specified time frame.
	 * @async
	 * @param {ObjectId} inputs.poolId - The object ID of the pool to fetch trade events for.
	 * @param {DurationUnitType} inputs.timeUnit - The time unit of the time frame.
	 * @param {number} inputs.time - The duration of the time frame.
	 * @returns {Promise<PoolTradeEvent[]>} A promise that resolves to an array of fetched trade events.
	 */
	public async fetchTradeEventsWithinTime(inputs: {
		poolId: ObjectId;
		timeUnit: DurationUnitType;
		time: number;
	}): Promise<PoolTradeEvent[]> {
		try {
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
		} catch (e) {
			return [];
		}
	}

	// =========================================================================
	//  Transaction Builders
	// =========================================================================

	/**
	 * Fetches a transaction block for creating a new pool.
	 * @async
	 * @param {SuiAddress} inputs.walletAddress - The wallet address of the user creating the pool.
	 * @param {CoinType} inputs.lpCoinType - The coin type of the LP token.
	 * @param {PoolCreationLpCoinMetadata} inputs.lpCoinMetadata - The metadata of the LP token.
	 * @param {{ coinType: CoinType; weight: Percentage; decimals?: CoinDecimal; tradeFeeIn: Percentage; initialDeposit: Balance; }[]} inputs.coinsInfo - An array of objects containing information about the coins in the pool.
	 * @param {PoolName} inputs.poolName - The name of the pool.
	 * @param {0 | 1} inputs.poolFlatness - The flatness of the pool.
	 * @param {ObjectId} inputs.createPoolCapId - The object ID of the create pool cap.
	 * @param {boolean} inputs.respectDecimals - Whether to respect decimals.
	 * @param {CoinDecimal} [inputs.forceLpDecimals] - The decimal places to force for the LP token.
	 * @param {boolean} [inputs.isSponsoredTx] - Whether the transaction is sponsored.
	 * @returns {Promise<TransactionBlock>} A promise that resolves to the fetched transaction block.
	 */
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

	/**
	 * Fetches a transaction block for trading in a pool.
	 * @async
	 * @param {SuiAddress} inputs.walletAddress - The wallet address of the user trading in the pool.
	 * @param {Pool} inputs.pool - The pool to trade in.
	 * @param {CoinType} inputs.coinInType - The coin type of the coin being traded in.
	 * @param {Balance} inputs.coinInAmount - The amount of the coin being traded in.
	 * @param {CoinType} inputs.coinOutType - The coin type of the coin being traded out.
	 * @param {Slippage} inputs.slippage - The slippage of the trade.
	 * @param {SuiAddress} [inputs.referrer] - The referrer of the trade.
	 * @param {boolean} [inputs.isSponsoredTx] - Whether the transaction is sponsored.
	 * @returns {Promise<TransactionBlock>} A promise that resolves to the fetched transaction block.
	 */
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

	/**
	 * Fetches a transaction block for depositing in a pool.
	 * @async
	 * @param {SuiAddress} inputs.walletAddress - The wallet address of the user depositing in the pool.
	 * @param {Pool} inputs.pool - The pool to deposit in.
	 * @param {CoinsToBalance} inputs.amountsIn - The amounts of coins being deposited.
	 * @param {Slippage} inputs.slippage - The slippage of the deposit.
	 * @param {SuiAddress} [inputs.referrer] - The referrer of the deposit.
	 * @param {boolean} [inputs.isSponsoredTx] - Whether the transaction is sponsored.
	 * @returns {Promise<TransactionBlock>} A promise that resolves to the fetched transaction block.
	 */
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

	/**
	 * Fetches a transaction block for withdrawing from a pool.
	 * @async
	 * @param {SuiAddress} inputs.walletAddress - The wallet address of the user withdrawing from the pool.
	 * @param {Pool} inputs.pool - The pool to withdraw from.
	 * @param {CoinsToBalance} inputs.amountsOutDirection - The amounts of coins being withdrawn.
	 * @param {Balance} inputs.lpCoinAmount - The amount of LP tokens being withdrawn.
	 * @param {Slippage} inputs.slippage - The slippage of the withdrawal.
	 * @param {SuiAddress} [inputs.referrer] - The referrer of the withdrawal.
	 * @returns {Promise<TransactionBlock>} A promise that resolves to the fetched transaction block.
	 */
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

	/**
	 * Fetches a transaction block that withdraws all coins from a pool in exchange for the corresponding LP tokens.
	 * @param inputs An object containing the wallet address, pool, LP coin amount, and optional referrer.
	 * @returns A promise that resolves to a TransactionBlock object.
	 */
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

	/**
	 * Builds a transaction block for publishing an LP coin.
	 * @param inputs - The input parameters for the transaction.
	 * @returns The built transaction block.
	 */
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

	/**
	 * Fetches and builds a transaction for creating a new liquidity pool.
	 * @param inputs An object containing the necessary inputs for creating the pool.
	 * @returns A Promise that resolves to a TransactionBlock object representing the built transaction.
	 */
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

	/**
	 * Executes a trade transaction on the specified pool.
	 * @param inputs An object containing the necessary inputs for the trade transaction.
	 * @returns A `TransactionObjectArgument` representing the trade transaction.
	 */
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

	/**
	 * Wraps a transaction object argument for adding a swap exact in to route on the router wrapper.
	 * @param inputs - The inputs required for the transaction.
	 * @param inputs.poolId - The ID of the pool.
	 * @param inputs.lpCoinType - The type of the LP coin.
	 * @returns The transaction object argument.
	 */
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

	/**
	 * Creates a transaction object argument for depositing multiple coins into a pool.
	 *
	 * @param inputs - An object containing the necessary parameters for the deposit transaction.
	 * @returns A transaction object argument representing the deposit transaction.
	 */
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

	/**
	 * Withdraws multiple coins from a pool.
	 * @param inputs An object containing the necessary parameters for the transaction.
	 * @returns A TransactionObjectArgument representing the transaction.
	 */
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

	/**
	 * Withdraws all coins from a liquidity pool.
	 * @param inputs - The inputs required for the transaction.
	 * @param inputs.tx - The transaction block.
	 * @param inputs.poolId - The ID of the liquidity pool.
	 * @param inputs.lpCoinId - The ID of the LP coin.
	 * @param inputs.lpCoinType - The type of the LP coin.
	 * @param inputs.coinTypes - An array of coin types.
	 * @param inputs.withTransfer - Whether or not to include a transfer.
	 * @returns An array of transaction objects.
	 */
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

	/**
	 * Publishes a transaction block for creating a liquidity pool coin.
	 * @param inputs An object containing the transaction block and the decimal value of the liquidity pool coin.
	 * @returns A promise that resolves to the result of the transaction publishing.
	 */
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
	/**
	 * Creates a transaction to create a new pool.
	 * @param inputs - An object containing the necessary inputs to create the pool.
	 * @returns A transaction block to create the pool.
	 */
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

	/**
	 * Returns the pool object ID for a given LP coin type transaction.
	 * @param inputs - An object containing the transaction block and LP coin type.
	 * @returns The pool object ID.
	 */
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

	/**
	 * Fetches the pool object ID for a given LP coin type.
	 * @param inputs - An object containing the LP coin type.
	 * @returns A Promise that resolves to the pool object ID.
	 */
	public fetchPoolObjectIdForLpCoinType = async (inputs: {
		lpCoinType: CoinType;
	}): Promise<ObjectId> => {
		const tx = new TransactionBlock();

		this.poolObjectIdForLpCoinTypeTx({ tx, ...inputs });

		const bytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		return Casting.addressFromBytes(bytes);
	};

	/**
	 * Fetches the list of unique supported coins across all pools.
	 * @returns {Promise<CoinType[]>} A promise that resolves to an array of unique supported coins.
	 */
	public fetchSupportedCoins = async () => {
		const pools = await this.Provider.Pools().fetchAllPools();
		const allCoins: CoinType[] = pools
			.map((pool) => Object.keys(pool.coins))
			.reduce((prev, cur) => [...prev, ...cur], []);

		const uniqueCoins = Helpers.uniqueArray(allCoins);
		return uniqueCoins;
	};

	/**
	 * Fetches the owned LP coin positions for a given wallet address.
	 * @param inputs An object containing the wallet address.
	 * @returns A Promise that resolves to an array of PoolLpInfo objects.
	 */
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
	/**
	 * Fetches statistics for a given pool.
	 * @param inputs An object containing the pool, trade events within a certain time frame, coins to price, and coins to decimals.
	 * @returns A Promise that resolves to a PoolStats object containing the volume, TVL, supply per LP token, LP token price, fees, and APY.
	 */
	public fetchPoolStats = async (inputs: {
		pool: Pool;
		coinsToPrice: CoinsToPrice;
		coinsToDecimals: CoinsToDecimals;
	}): Promise<PoolStats> => {
		const { pool, coinsToPrice, coinsToDecimals } = inputs;

		const poolCoins = pool.pool.coins;

		// TODO: move common milliseconds to constants or use dayjs
		const durationMs24hrs = 86400000;
		const volumes = await this.fetchPoolVolume({
			poolId: pool.pool.objectId,
			durationMs: durationMs24hrs,
		});
		const volume = Helpers.calcIndexerVolumeUsd({
			volumes,
			coinsToDecimals,
			coinsToPrice,
		});

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
			FixedUtils.directCast(firstCoin.tradeFeeIn + firstCoin.tradeFeeOut);

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

	/**
	 * Fetches the pool volume for a given pool and duration.
	 * @param inputs - The inputs for fetching the pool volume.
	 * @returns A Promise that resolves to an array of pool volumes.
	 */
	public fetchPoolVolume = async (inputs: {
		poolId: ObjectId;
		durationMs: number;
	}): Promise<IndexerSwapVolumeResponse> => {
		const { poolId, durationMs } = inputs;
		const response =
			await this.Provider.indexerCaller.fetchIndexer<IndexerSwapVolumeResponse>(
				`pools/${poolId}/swap-volume/${durationMs}`
			);
		return response.map((data) => ({
			...data,
			coinTypeIn: Helpers.addLeadingZeroesToType(data.coinTypeIn),
			coinTypeOut: Helpers.addLeadingZeroesToType(data.coinTypeOut),
		}));
	};

	/**
	 * Fetches the total volume of swaps within a specified duration.
	 * @param inputs - The inputs for fetching the total volume.
	 * @returns A Promise that resolves to an array of total volumes.
	 */
	public fetchTotalVolume = async (inputs: { durationMs: number }) => {
		const { durationMs } = inputs;
		return this.Provider.indexerCaller.fetchIndexer<IndexerSwapVolumeResponse>(
			`pools/total-swap-volume/${durationMs}`
		);
	};

	/**
	 * Calculates the total value locked (TVL) for a given pool, based on its current balances and prices.
	 * @param inputs - An object containing the pool's coins, their prices, and their decimal places.
	 * @returns The total value locked (TVL) for the pool.
	 */
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

	/**
	 * Calculates the pool supply per LP token.
	 * @param poolCoins - The pool coins object.
	 * @param lpSupply - The total supply of LP tokens.
	 * @returns An array of supply per LP token for each pool coin.
	 */
	public calcPoolSupplyPerLps = (poolCoins: PoolCoins, lpSupply: Balance) => {
		const supplyPerLps = Object.values(poolCoins).map(
			(poolCoin) => Number(poolCoin.balance) / Number(lpSupply)
		);

		return supplyPerLps;
	};

	/**
	 * Calculates the price of a liquidity pool token.
	 * @param inputs - An object containing the liquidity pool token supply, total value locked, and the number of decimal places for the token.
	 * @returns The price of the liquidity pool token.
	 */
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

	/**
	 * Calculates the APY (Annual Percentage Yield) based on the fees collected in the last 24 hours and the TVL (Total Value Locked) of a pool.
	 * @param inputs - An object containing the fees collected in the last 24 hours and the TVL of a pool.
	 * @returns The APY (Annual Percentage Yield) of the pool.
	 */
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
	/**
	 * Fetches the prices of the given LP coins.
	 * @param provider The Aftermath instance to use for the API calls.
	 * @param lpCoins The LP coins to fetch prices for.
	 * @returns An object containing the prices of the LP coins.
	 */
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

	/**
	 * Calculates the pool fee data from the given volume data and pool trade fee.
	 * @param inputs - The inputs required to calculate the pool fee data.
	 * @param inputs.volumeData - The volume data to calculate the pool fee data from.
	 * @param inputs.poolTradeFee - The pool trade fee to use for the calculation.
	 * @returns The pool fee data calculated from the given volume data and pool trade fee.
	 */
	public calcPoolFeeDataFromVolume = (inputs: {
		volumeData: PoolDataPoint[];
		poolTradeFee: PoolTradeFee;
	}): PoolDataPoint[] => {
		const feeData = inputs.volumeData.map((data) => ({
			time: data.time,
			value: data.value * FixedUtils.directCast(inputs.poolTradeFee),
		}));

		return feeData;
	};

	/**
	 * Calculates the pool volume data based on the provided inputs.
	 * @param inputs An object containing the necessary inputs for the calculation.
	 * @param inputs.tradeEvents An array of pool trade events.
	 * @param inputs.timeUnit The time unit to use for the calculation.
	 * @param inputs.time The time duration to use for the calculation.
	 * @param inputs.coinsToDecimals An object containing the decimal values for each coin.
	 * @param inputs.coinsToPrice An object containing the price values for each coin.
	 * @returns An array of pool data points.
	 */
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

	/**
	 * Creates a description for the Aftermath LP coin for a given pool.
	 * @param inputs - An object containing the pool name and an array of coin types.
	 * @returns A string describing the Aftermath LP coin for the given pool.
	 */
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
	//  CoinGecko Integration
	// =========================================================================

	public fetchCoinGeckoTickerData = async (inputs: {
		pools: Pool[];
		coinsToDecimals: CoinsToDecimals;
	}): Promise<CoinGeckoTickerData[]> => {
		const { pools, coinsToDecimals } = inputs;

		return (
			await Promise.all(
				pools.map(async (pool) => {
					const durationMs24hrs = 86400000;
					const volumes = await this.fetchPoolVolume({
						poolId: pool.pool.objectId,
						durationMs: durationMs24hrs,
					});

					return Object.keys(pool.pool.coins)
						.map((baseCoinType) => {
							return Object.keys(pool.pool.coins)
								.map((targetCoinType) => {
									if (!pool.stats)
										throw new Error(
											"pool is missing stats"
										);

									if (baseCoinType === targetCoinType)
										return undefined;

									const volumeData = volumes.find(
										(volume) =>
											volume.coinTypeIn === baseCoinType
									);
									if (!volumeData)
										throw new Error(
											"volume data not found"
										);

									const baseDecimals =
										coinsToDecimals[baseCoinType];
									const targetDecimals =
										coinsToDecimals[targetCoinType];
									if (
										baseDecimals === undefined ||
										targetDecimals === undefined
									)
										throw new Error(
											"coin decimals not found"
										);

									const baseVolume = Coin.balanceWithDecimals(
										BigInt(volumeData.totalAmountIn),
										baseDecimals
									);
									const targetVolume =
										Coin.balanceWithDecimals(
											BigInt(volumeData.totalAmountOut),
											targetDecimals
										);

									const data: CoinGeckoTickerData = {
										pool_id: pool.pool.objectId,
										base_currency: baseCoinType,
										target_currency: targetCoinType,
										ticker_id: `${baseCoinType}_${targetCoinType}`,
										liquidity_in_usd: pool.stats.tvl,
										// TODO
										base_volume: baseVolume,
										target_volume: targetVolume,
										last_price: 1,
									};
									return data;
								})
								.reduce(
									(prev, curr) => [
										...prev,
										...(curr ? [curr] : []),
									],
									[] as CoinGeckoTickerData[]
								);

							return [];
						})
						.reduce(
							(prev, curr) => [...prev, ...curr],
							[] as CoinGeckoTickerData[]
						);
				})
			)
		).reduce(
			(prev, curr) => [...prev, ...curr],
			[] as CoinGeckoTickerData[]
		);
	};

	public fetchCoinGeckoHistoricalTradeData = async (inputs: {
		trades: PoolTradeEvent[];
		coinsToDecimals: CoinsToDecimals;
	}): Promise<CoinGeckoHistoricalTradeData[]> => {
		const { trades, coinsToDecimals } = inputs;

		return trades.map((trade) => {

			return {

				trade_id: `${trade.txnDigest}_${trade.amountsIn[0]}_${trade.amountsOut[0]}_${trade.typesIn[0]}_${trade.typesOut[0]}`,
				price: number;
				base_volume: number;
				target_volume: number;
				trade_timestamp: trade.timestamp,
				// TODO
				type:  "buy"
	
				// trade.amountsIn[0]
	
			}
		})
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

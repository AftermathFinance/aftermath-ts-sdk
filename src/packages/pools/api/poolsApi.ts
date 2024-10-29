import {
	TransactionObjectArgument,
	Transaction,
} from "@mysten/sui/transactions";
import { fromB64, normalizeSuiObjectId } from "@mysten/sui/utils";
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
	IndexerDataWithCursorQueryParams,
	ApiIndexerEventsBody,
	ObjectId,
	SuiAddress,
	ApiPublishLpCoinBody,
	PoolLpInfo,
	CoinGeckoTickerData,
	CoinGeckoHistoricalTradeData,
	Timestamp,
	UniqueId,
	PoolObject,
	DaoFeePoolsAddresses,
	ApiCreatePoolBody,
	ApiPoolsOwnedDaoFeePoolOwnerCapsBody,
	DaoFeePoolOwnerCapObject,
} from "../../../types";
import {
	DaoFeePoolFieldsOnChain,
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
	PoolsIndexerResponse,
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
import duration, { DurationUnitType } from "dayjs/plugin/duration";
import {
	IndexerEventOnChain,
	IndexerSwapVolumeResponse,
} from "../../../general/types/castingTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { bcs } from "@mysten/sui/bcs";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";

/**
 * This file contains the implementation of the PoolsApi class, which provides methods for interacting with the Aftermath protocol's pools.
 * @packageDocumentation
 */
/**
 * Provides methods to interact with the Pools API.
 */
export class PoolsApi implements MoveErrorsInterface {
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
			poolFactory: "pool_factory",
			math: "math",
			geometricMeanCalculations: "geometric_mean_calculations",
			stableCalculations: "stable_calculations",
			price: "price",
		},
		eventNames: {
			swap: "SwapEvent",
			deposit: "DepositEvent",
			withdraw: "WithdrawEvent",
			swapV2: "SwapEventV2",
			depositV2: "DepositEventV2",
			withdrawV2: "WithdrawEventV2",
		},
		defaultLpCoinIconImageUrl:
			"https://aftermath.finance/coins/lp/af_lp.svg",
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
		daoFeePools?: DaoFeePoolsAddresses;
	};
	public readonly objectTypes: {
		pool: AnyObjectType;
		daoFeePool?: AnyObjectType;
		daoFeePoolOwnerCap?: AnyObjectType;
	};
	public readonly eventTypes: {
		trade: AnyObjectType;
		deposit: AnyObjectType;
		withdraw: AnyObjectType;
		tradeV2: AnyObjectType;
		depositV2: AnyObjectType;
		withdrawV2: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

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
	 * @throws {Error} Throws an error if not all required addresses have been set in AfSdk
	 */
	constructor(private readonly Provider: AftermathApi) {
		const pools = Provider.addresses.pools;
		const referralVault = Provider.addresses.referralVault;
		const daoFeePools = Provider.addresses.daoFeePools;

		if (!pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			pools,
			referralVault,
			daoFeePools,
		};
		this.objectTypes = {
			pool: `${pools.packages.events}::pool::Pool`,
			daoFeePool: daoFeePools
				? `${daoFeePools.packages.amm}::pool::DaoFeePool`
				: undefined,
			daoFeePoolOwnerCap: daoFeePools
				? `${daoFeePools.packages.amm}::pool::OwnerCap`
				: undefined,
		};
		this.eventTypes = {
			trade: this.tradeEventType(),
			deposit: this.depositEventType(),
			withdraw: this.withdrawEventType(),
			tradeV2: this.tradeV2EventType(),
			depositV2: this.depositV2EventType(),
			withdrawV2: this.withdrawV2EventType(),
		};
		this.moveErrors = {
			[this.addresses.pools.packages.amm]: {
				[PoolsApi.constants.moduleNames.pool]: {
					/// A user provides a input that should be between 0 and `FIXED_ONE` but isn't.
					0: "Flatness Not Normalized",
					/// A user attempts to create a Pool with a `flatness` parameter we do not support yet.
					1: "Flatness Not Supported",
					/// A user attempts to create a pool with weights that don't sum to `FIXED_ONE`.
					2: "Weights Not Normalized",
					/// A user attempts to create a Pool with an individual weight outside of the
					///  range [MIN_WEIGHT, MAX_WEIGHT].
					3: "Invalid Weight",
					/// A user attempts to create a Pool with an individual fee outside of the
					///  range [MIN_FEE, MAX_FEE].
					4: "Invalid Fee",
					/// A user provides an input vector (with length m != n) for a pool of size n.
					5: "Bad Vector Length",
					/// A user tries to create a Pool but provides an initial deposit that equates to less than
					///  `MIN_LP_SUPPLY` worth of LP Coins.
					6: "Not Enough Initial Liquidity",
					/// A user attempts to create a Pool with an LP `TreasuryCap` that has already minted Coins.
					7: "Non Zero Total Supply",
					/// A user attempts to interact with the Pool and specifies a type that isn't in the Pool.
					8: "Bad Type",
					/// A user attempts to create a pool with invalid decimal scalars
					9: "Bad Decimals",
					/// A user attempts to create a pool with type names which are not sorted
					10: "Not Sorted",
				},
				[PoolsApi.constants.moduleNames.poolRegistry]: {
					/// A user tries to create a Pool and the generic parameters of `create_pool_n_coins` were
					///  provided in nonlexicographical order.
					60: "Not Sorted",
					/// A user tries to create a Pool with exact parameters as an already active Pool.
					61: "Duplicate Pool",
					/// A user tries to upgrade the `PoolRegistry` to a value
					62: "Invalid Upgrade",
				},
				[PoolsApi.constants.moduleNames.deposit]: {
					/// A user attempts to perform a `deposit` with an older contract.
					20: "Invalid Protocol Version",
					/// A user attempts to perform `deposit-n-coins` on a Pool with a size `m` < `n`.
					21: "Invalid Pool Size",
					/// A user attempts to perform a deposit and provides a coin with a value of zero.
					22: "Zero Value",
					// A user calls `deposit_n_coins` or `all_coin_deposit_n_coins` and provides the same generic
					//  at least twice.
					23: "Duplicate Types",
				},
				[PoolsApi.constants.moduleNames.poolFactory]: {
					/// A user attempts to create a pool on an older contract.
					10: "Invalid Protocol Version",
					/// A user attempts to create a Pool and provides a coin with a value of zero.
					11: "Zero Value",
				},
				[PoolsApi.constants.moduleNames.price]: {
					/// A user attempts to query spot/oracle price using an old contract.
					10: "Invalid Protocol Version",
				},
				[PoolsApi.constants.moduleNames.swap]: {
					/// A user attempts to perform a `swap` with an older contract.
					40: "Invalid Protocol Version",
					/// A user attempts to perform `multi-swap-exact-in/out-n-to-m` on a Pool with a size
					///  `s` < `n` + `m`.
					41: "Invalid Pool Size",
					/// A user attempts to perform swap and providing provides a coin with a
					///  value of zero.
					42: "Zero Value",
					/// A user attempts to perform a multi-coin withdraw and provides an `amounts_out`
					///  vector whose length does
					43: "Bad Vector Length",
					/// A user attempts to swap attempts to swap `Coin<CI>` for `amount_out` of `Coin<CO>`
					///  but its value is insufficient.
					44: "Insufficient Coin In",
					// A user calls `multi_swap_exact_in_1_to_n` or `multi_swap_exact_out_1_to_n` and provides the same
					//  generic at least twice.
					45: "Duplicate Types",
					/// Something went wrong with the internal calculations
					46: "Internal Error",
					/// An external app is trying to call authorized functions without permission.
					47: "Not Authorized",
				},
				[PoolsApi.constants.moduleNames.withdraw]: {
					/// A user attempts to perform a `withdraw` with an older contract.
					30: "Invalid Protocol Version",
					/// A user attempts to perform `withdraw-n-coins` on a Pool with a size `m` < `n`.
					31: "Invalid PoolSize",
					/// A user attempts to perform a withdraw and provides an LP coin with a value of zero.
					32: "Zero Value",
					/// A user attempts to perform a multi-coin withdraw and provides an `amounts_out`
					///  vector whose length does
					33: "Bad Vector Length",
					// A user calls `withdraw_n_coins` or `all_coin_withdraw_n_coins` and provides the same generic
					//  at least twice.
					34: "Duplicate Types",
				},
				[PoolsApi.constants.moduleNames.math]: {
					// TODO: change error code in move

					/// A user tries to create a Pool that would result in the Pool's invariant equalling zero.
					// 51: "ZeroInvariant",

					/// A user tries to perform an action with the Pool that results in too much slippage.
					51: "Slippage",
					/// A user tries to perform a swap that would result in more than `MAX_SWAP_AMOUNT_IN` worth of
					///  one of the Pool's coins entering the Pool.
					52: "Invalid Swap Amount In",
					/// A user tries to perform a swap that would result in more than `MAX_SWAP_AMOUNT_OUT` worth of
					///  one of the Pool's coins exiting the Pool.
					53: "Invalid Swap Amount Out",
					/// A user tries to perform a `swap_exact_out` with a value for `amount_out` that equates to
					///  zero amount of `Coin<CI>`.
					54: "Zero Amount In",
					/// A user tries to perform a `swap_exact_in` with an amount of `Coin<CI>` that equates to
					///  zero amount of `Coin<CO>`.
					55: "Zero Amount Out",
					/// A user tries to deposit into a Pool with a deposit that is worth zero LP coins.
					56: "Zero Lp Out",
					/// A user tries to invest with an lp ratio of 0
					57: "Zero Lp Ratio",
				},
				[PoolsApi.constants.moduleNames.geometricMeanCalculations]: {},
				[PoolsApi.constants.moduleNames.stableCalculations]: {},
			},
			...(this.addresses.daoFeePools
				? {
						[this.addresses.daoFeePools.packages.amm]: {
							version: {
								/// A user tried to interact with an old contract.
								0: "Invalid Version",
								/// `init_package_version` has been called outside of this packages `init` function.
								1: "Version Object Already Created",
							},
						},
				  }
				: {}),
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	// TODO: make caches shared across pool object fetching funcs

	/**
	 * Fetches a pool object by its object ID.
	 * @async
	 * @param {ObjectId} inputs.objectId - The object ID of the pool to fetch.
	 * @returns {Promise<PoolObject>} A promise that resolves to the fetched pool object.
	 */
	public fetchPool = async (inputs: {
		objectId: ObjectId;
	}): Promise<PoolObject> => {
		return (await this.fetchPools({ objectIds: [inputs.objectId] }))[0];
	};

	public fetchPools = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<PoolObject[]> => {
		return this.Provider.indexerCaller.fetchIndexer<PoolObject[]>(
			"pools",
			undefined,
			{
				pool_ids: inputs.objectIds,
			}
		);
	};

	/**
	 * Fetches all pool objects.
	 * @async
	 * @returns {Promise<PoolObject[]>} A promise that resolves to an array of all fetched pool objects.
	 */
	public fetchAllPools = async (): Promise<PoolObject[]> => {
		return this.Provider.indexerCaller.fetchIndexer<PoolObject[]>("pools");
	};

	public fetchOwnedDaoFeePoolOwnerCaps = async (
		inputs: ApiPoolsOwnedDaoFeePoolOwnerCapsBody
	): Promise<DaoFeePoolOwnerCapObject[]> => {
		const { walletAddress } = inputs;

		if (!this.objectTypes.daoFeePoolOwnerCap)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		return this.Provider.Objects().fetchCastObjectsOwnedByAddressOfType({
			walletAddress,
			objectType: this.objectTypes.daoFeePoolOwnerCap,
			objectFromSuiObjectResponse:
				Casting.pools.daoFeePoolOwnerCapObjectFromSuiObjectResponse,
		});
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
			}
			// Casting.pools.poolTradeEventFromIndexerOnChain
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
			}
			// Casting.pools.poolWithdrawEventFromIndexerOnChain
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
			}
			// Casting.pools.poolDepositEventFromIndexerOnChain
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

			return this.Provider.indexerCaller.fetchIndexer<
				PoolTradeEvent[],
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

			// return tradeEventsOnChain.map(
			// 	Casting.pools.poolTradeEventFromIndexerOnChain
			// );
		} catch (e) {
			return [];
		}
	}

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	/**
	 * Executes a trade transaction on the specified pool.
	 * @param inputs An object containing the necessary inputs for the trade transaction.
	 * @returns A `TransactionObjectArgument` representing the trade transaction.
	 */
	public tradeTx = (inputs: {
		tx: Transaction;
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

		return tx.moveCall({
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
				tx.pure.u64(expectedCoinOutAmount.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(slippage)),
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
		tx: Transaction;
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

		return tx.moveCall({
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
				tx.pure.u128(expectedLpRatio.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(slippage)),
			],
		});
	};

	/**
	 * Withdraws multiple coins from a pool.
	 * @param inputs An object containing the necessary parameters for the transaction.
	 * @returns A TransactionObjectArgument representing the transaction.
	 */
	public multiCoinWithdrawTx = (inputs: {
		tx: Transaction;
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

		return tx.moveCall({
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
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(
							expectedAmountsOut.map((amount) =>
								amount.toString()
							)
						)
				),
				tx.pure.u64(Pools.normalizeInvertSlippage(slippage)),
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
		tx: Transaction;
		poolId: ObjectId;
		lpCoinId: ObjectId | TransactionObjectArgument;
		lpCoinType: CoinType;
		coinTypes: CoinType[];
		withTransfer?: boolean;
	}): TransactionObjectArgument[] => {
		const { tx, poolId, lpCoinId, coinTypes, lpCoinType, withTransfer } =
			inputs;

		const poolSize = coinTypes.length;

		return tx.moveCall({
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
		tx: Transaction;
		lpCoinDecimals: CoinDecimal;
	}) => {
		const compilations =
			this.addresses.pools.other?.createLpCoinPackageCompilations;
		if (!compilations)
			throw new Error(
				"not all required addresses have been set in provider for lp coin publishing (requires package compilations)"
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
	public createPoolTx = (inputs: {
		tx: Transaction;
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
		withTransfer?: boolean;
	}): TransactionObjectArgument[] /* (Pool<L>, Coin<L>) */ => {
		const {
			tx,
			lpCoinType,
			createPoolCapId,
			coinsInfo,
			lpCoinMetadata,
			lpCoinDescription,
			lpCoinIconUrl,
			withTransfer,
		} = inputs;

		const poolSize = coinsInfo.length;
		const coinTypes = coinsInfo.map((coin) => coin.coinType);
		const decimals = coinsInfo.map((coin) => coin.decimals);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterface
					: this.addresses.pools.packages.amm,
				withTransfer
					? PoolsApi.constants.moduleNames.interface
					: PoolsApi.constants.moduleNames.poolFactory,
				`create_pool_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				typeof createPoolCapId === "string"
					? tx.object(createPoolCapId)
					: createPoolCapId,
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.pure(
					bcs
						.vector(bcs.u8())
						.serialize(Casting.u8VectorFromString(inputs.poolName))
				),
				tx.pure(
					bcs
						.vector(bcs.u8())
						.serialize(
							Casting.u8VectorFromString(
								lpCoinMetadata.name.toString()
							)
						)
				),
				tx.pure(
					bcs
						.vector(bcs.u8())
						.serialize(
							Casting.u8VectorFromString(
								lpCoinMetadata.symbol.toString().toUpperCase()
							)
						)
				),
				tx.pure(
					bcs
						.vector(bcs.u8())
						.serialize(
							Casting.u8VectorFromString(lpCoinDescription)
						)
				),
				tx.pure(
					bcs
						.vector(bcs.u8())
						.serialize(Casting.u8VectorFromString(lpCoinIconUrl))
				), // lp_icon_url
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(coinsInfo.map((coin) => coin.weight))
				),
				tx.pure.u64(inputs.poolFlatness),
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(coinsInfo.map((coin) => coin.tradeFeeIn))
				),
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(coinsInfo.map((coin) => coin.tradeFeeOut))
				),
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(coinsInfo.map((coin) => coin.depositFee))
				),
				tx.pure(
					bcs
						.vector(bcs.u64())
						.serialize(coinsInfo.map((coin) => coin.withdrawFee))
				),
				...coinsInfo.map((coin) =>
					typeof coin.coinId === "string"
						? tx.object(coin.coinId)
						: coin.coinId
				),
				tx.pure(
					bcs
						.option(bcs.vector(bcs.u8()))
						.serialize(
							decimals.includes(undefined)
								? undefined
								: (decimals as number[])
						)
				), // decimals
				tx.pure.bool(inputs.respectDecimals), // respect_decimals
				tx.pure(bcs.option(bcs.u8()).serialize(inputs.forceLpDecimals)), // force_lp_decimals
			],
		});
	};

	/**
	 * Returns the pool object ID for a given LP coin type transaction.
	 * @param inputs - An object containing the transaction block and LP coin type.
	 * @returns The pool object ID.
	 */
	public poolObjectIdForLpCoinTypeTx = (inputs: {
		tx: Transaction;
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

	public daoFeePoolNewTx = (inputs: {
		tx: Transaction;
		poolId: ObjectId | TransactionObjectArgument;
		feeBps: bigint;
		feeRecipient: SuiAddress;
		lpCoinType: CoinType;
	}) /* (DaoFeePool, OwnerCap) */ => {
		const { tx, poolId } = inputs;
		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.pool,
				"new"
			),
			typeArguments: [inputs.lpCoinType],
			arguments: [
				typeof poolId === "string" ? tx.object(poolId) : poolId, // Pool
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.pure.u16(Number(inputs.feeBps)),
				tx.pure.address(inputs.feeRecipient),
			],
		});
	};

	public daoFeePoolUpdateFeeBpsTx = (inputs: {
		tx: Transaction;
		daoFeePoolOwnerCapId: ObjectId;
		daoFeePoolId: ObjectId;
		newFeeBps: bigint;
		lpCoinType: CoinType;
	}) => {
		const { tx } = inputs;
		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.pool,
				"update_fee_bps"
			),
			typeArguments: [inputs.lpCoinType],
			arguments: [
				tx.object(inputs.daoFeePoolOwnerCapId), // OwnerCap
				tx.object(inputs.daoFeePoolId), // DaoFeePool
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.pure.u16(Number(inputs.newFeeBps)),
			],
		});
	};

	public daoFeePoolUpdateFeeRecipientTx = (inputs: {
		tx: Transaction;
		daoFeePoolOwnerCapId: ObjectId;
		daoFeePoolId: ObjectId;
		newFeeRecipient: SuiAddress;
		lpCoinType: CoinType;
	}) => {
		const { tx } = inputs;
		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.pool,
				"update_fee_recipient"
			),
			typeArguments: [inputs.lpCoinType],
			arguments: [
				tx.object(inputs.daoFeePoolOwnerCapId), // OwnerCap
				tx.object(inputs.daoFeePoolId), // DaoFeePool
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.pure.address(inputs.newFeeRecipient),
			],
		});
	};

	/**
	 * Executes a trade transaction on the specified pool.
	 * @param inputs An object containing the necessary inputs for the trade transaction.
	 * @returns A `TransactionObjectArgument` representing the trade transaction.
	 */
	public daoFeePoolTradeTx = (inputs: {
		tx: Transaction;
		daoFeePoolId: ObjectId;
		coinInId: ObjectId | TransactionObjectArgument;
		coinInType: CoinType;
		expectedCoinOutAmount: Balance;
		coinOutType: CoinType;
		lpCoinType: CoinType;
		slippage: Slippage;
	}): TransactionObjectArgument => {
		const {
			tx,
			daoFeePoolId,
			coinInId,
			coinInType,
			expectedCoinOutAmount,
			coinOutType,
			lpCoinType,
			slippage,
		} = inputs;

		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.swap,
				"swap_exact_in"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(daoFeePoolId),
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure.u64(expectedCoinOutAmount.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(slippage)),
			],
		});
	};

	/**
	 * Creates a transaction object argument for depositing multiple coins into a pool.
	 *
	 * @param inputs - An object containing the necessary parameters for the deposit transaction.
	 * @returns A transaction object argument representing the deposit transaction.
	 */
	public daoFeePoolMultiCoinDepositTx = (inputs: {
		tx: Transaction;
		daoFeePoolId: ObjectId;
		coinIds: ObjectId[] | TransactionObjectArgument[];
		coinTypes: CoinType[];
		expectedLpRatio: bigint;
		lpCoinType: CoinType;
		slippage: Slippage;
	}): TransactionObjectArgument => {
		const {
			tx,
			daoFeePoolId,
			coinIds,
			coinTypes,
			expectedLpRatio,
			lpCoinType,
			slippage,
		} = inputs;

		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		const poolSize = coinTypes.length;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.deposit,
				`deposit_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(daoFeePoolId),
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				...coinIds.map((coinId) =>
					typeof coinId === "string" ? tx.object(coinId) : coinId
				),
				tx.pure.u128(expectedLpRatio.toString()),
				tx.pure.u64(Pools.normalizeInvertSlippage(slippage)),
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
	 * @returns An array of transaction objects.
	 */
	public daoFeePoolAllCoinWithdrawTx = (inputs: {
		tx: Transaction;
		daoFeePoolId: ObjectId;
		lpCoinId: ObjectId | TransactionObjectArgument;
		lpCoinType: CoinType;
		coinTypes: CoinType[];
	}): TransactionObjectArgument[] => {
		const { tx, daoFeePoolId, lpCoinId, coinTypes, lpCoinType } = inputs;

		if (!this.addresses.daoFeePools)
			throw new Error(
				"dao fee pool addresses have not been set in provider"
			);

		const poolSize = coinTypes.length;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.daoFeePools.packages.amm,
				PoolsApi.constants.moduleNames.withdraw,
				`all_coin_withdraw_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(daoFeePoolId),
				tx.object(this.addresses.daoFeePools.objects.version),
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
			],
		});
	};

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
	 * @returns {Promise<Transaction>} A promise that resolves to the fetched transaction block.
	 */
	public fetchCreatePoolTx = async (
		inputs: ApiCreatePoolBody
	): Promise<Transaction> => {
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
	 * @returns {Promise<Transaction>} A promise that resolves to the fetched transaction block.
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
	}): Promise<Transaction> => {
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

		const tx = new Transaction();
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

		if (pool.pool.daoFeePoolObject) {
			const coinOutId = this.daoFeePoolTradeTx({
				tx,
				coinInId,
				daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
				expectedCoinOutAmount: amountOut,
				lpCoinType: pool.pool.lpCoinType,
				coinInType,
				coinOutType,
				slippage,
			});
			tx.transferObjects([coinOutId], walletAddress);
		} else {
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
		}

		return tx;
	};

	public fetchAddTradeTx = async (inputs: {
		tx: Transaction;
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

	/**
	 * Fetches a transaction block for depositing in a pool.
	 * @async
	 * @param {SuiAddress} inputs.walletAddress - The wallet address of the user depositing in the pool.
	 * @param {Pool} inputs.pool - The pool to deposit in.
	 * @param {CoinsToBalance} inputs.amountsIn - The amounts of coins being deposited.
	 * @param {Slippage} inputs.slippage - The slippage of the deposit.
	 * @param {SuiAddress} [inputs.referrer] - The referrer of the deposit.
	 * @param {boolean} [inputs.isSponsoredTx] - Whether the transaction is sponsored.
	 * @returns {Promise<Transaction>} A promise that resolves to the fetched transaction block.
	 */
	public fetchBuildDepositTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		amountsIn: CoinsToBalance;
		slippage: Slippage;
		referrer?: SuiAddress;
		isSponsoredTx?: boolean;
	}): Promise<Transaction> => {
		const {
			walletAddress,
			pool,
			amountsIn,
			slippage,
			referrer,
			isSponsoredTx,
		} = inputs;

		const tx = new Transaction();
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

		if (pool.pool.daoFeePoolObject) {
			const lpCoinId = this.daoFeePoolMultiCoinDepositTx({
				tx,
				daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
				lpCoinType: pool.pool.lpCoinType,
				coinIds,
				coinTypes,
				expectedLpRatio,
				slippage,
			});
			tx.transferObjects([lpCoinId], walletAddress);
		} else {
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
		}

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
	 * @returns {Promise<Transaction>} A promise that resolves to the fetched transaction block.
	 */
	public fetchBuildWithdrawTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		amountsOutDirection: CoinsToBalance;
		lpCoinAmount: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const {
			walletAddress,
			pool,
			amountsOutDirection,
			lpCoinAmount,
			slippage,
			referrer,
		} = inputs;

		const tx = new Transaction();
		tx.setSender(walletAddress);

		if (referrer)
			this.Provider.ReferralVault().updateReferrerTx({
				tx,
				referrer,
			});

		const lpRatio = pool.getMultiCoinWithdrawLpRatio({
			lpCoinAmountIn: lpCoinAmount,
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

		if (pool.pool.daoFeePoolObject) {
			// TODO: handle dao fee pool
			// TODO: handle transfer
		} else {
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
		}

		return tx;
	};

	/**
	 * Fetches a transaction block that withdraws all coins from a pool in exchange for the corresponding LP tokens.
	 * @param inputs An object containing the wallet address, pool, LP coin amount, and optional referrer.
	 * @returns A promise that resolves to a Transaction object.
	 */
	public fetchBuildAllCoinWithdrawTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: Pool;
		lpCoinAmount: Balance;
		referrer?: SuiAddress;
	}): Promise<Transaction> => {
		const { walletAddress, pool, lpCoinAmount, referrer } = inputs;

		const tx = new Transaction();
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

		if (pool.pool.daoFeePoolObject) {
			const withdrawnCoinIds = this.daoFeePoolAllCoinWithdrawTx({
				tx,
				daoFeePoolId: pool.pool.daoFeePoolObject.objectId,
				lpCoinType: pool.pool.lpCoinType,
				coinTypes,
				lpCoinId,
			});
			tx.transferObjects(
				coinTypes.map((_, index) => withdrawnCoinIds[index]),
				walletAddress
			);
		} else {
			this.allCoinWithdrawTx({
				tx,
				poolId: pool.pool.objectId,
				lpCoinType: pool.pool.lpCoinType,
				coinTypes,
				lpCoinId,
				withTransfer: true,
			});
		}

		return tx;
	};

	/**
	 * Builds a transaction block for publishing an LP coin.
	 * @param inputs - The input parameters for the transaction.
	 * @returns The built transaction block.
	 */
	public buildPublishLpCoinTx = (
		inputs: ApiPublishLpCoinBody
	): Transaction => {
		const { lpCoinDecimals } = inputs;

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const upgradeCap = this.publishLpCoinTx({ tx, lpCoinDecimals });
		tx.transferObjects([upgradeCap], inputs.walletAddress);

		return tx;
	};

	/**
	 * Fetches and builds a transaction for creating a new liquidity pool.
	 * @param inputs An object containing the necessary inputs for creating the pool.
	 * @returns A Promise that resolves to a Transaction object representing the built transaction.
	 */
	private fetchBuildCreatePoolTx = async (inputs: {
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
		burnLpCoin?: boolean;
		daoFeeInfo?: {
			feePercentage: Percentage;
			feeRecipient: SuiAddress;
		};
	}): Promise<Transaction> => {
		const { coinsInfo, isSponsoredTx, burnLpCoin, lpCoinType, daoFeeInfo } =
			inputs;

		const tx = new Transaction();
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

		const createPoolTxArgs = {
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
		};

		if (daoFeeInfo) {
			if (!this.objectTypes.daoFeePool)
				throw new Error(
					"dao fee pool addresses have not been set in provider"
				);

			const [poolId, lpCoinId] = this.createPoolTx(createPoolTxArgs);

			const [daoFeePoolId, daoFeePoolOwnerCapId] = this.daoFeePoolNewTx({
				tx,
				poolId,
				lpCoinType,
				feeRecipient: daoFeeInfo.feeRecipient,
				feeBps: Casting.percentageToBps(daoFeeInfo.feePercentage),
			});
			this.Provider.Objects().publicShareObjectTx({
				tx,
				object: daoFeePoolId,
				objectType: `${this.objectTypes.daoFeePool}<${lpCoinType}>`,
			});

			if (burnLpCoin) {
				this.Provider.Objects().burnObjectTx({
					tx,
					object: lpCoinId,
				});
				tx.transferObjects(
					[daoFeePoolOwnerCapId],
					inputs.walletAddress
				);
			} else {
				tx.transferObjects(
					[lpCoinId, daoFeePoolOwnerCapId],
					inputs.walletAddress
				);
			}
		} else {
			if (burnLpCoin) {
				const [poolId, lpCoinId] = this.createPoolTx(createPoolTxArgs);
				this.Provider.Objects().publicShareObjectTx({
					tx,
					object: poolId,
					objectType: `${this.objectTypes.pool}<${lpCoinType}>`,
				});
				this.Provider.Objects().burnObjectTx({
					tx,
					object: lpCoinId,
				});
			} else {
				this.createPoolTx({
					...createPoolTxArgs,
					withTransfer: true,
				});
			}
		}

		return tx;
	};

	public buildDaoFeePoolUpdateFeeBpsTx =
		Helpers.transactions.createBuildTxFunc(this.daoFeePoolUpdateFeeBpsTx);

	public buildDaoFeePoolUpdateFeeRecipientTx =
		Helpers.transactions.createBuildTxFunc(
			this.daoFeePoolUpdateFeeRecipientTx
		);

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * Fetches the pool object ID for a given LP coin type.
	 * @param inputs - An object containing the LP coin type.
	 * @returns A Promise that resolves to the pool object ID.
	 */
	public fetchPoolObjectIdForLpCoinType = this.Provider.withCache({
		key: "fetchPoolObjectIdForLpCoinType",
		expirationSeconds: -1,
		callback: async (inputs: {
			lpCoinType: CoinType;
		}): Promise<ObjectId | undefined> => {
			if (!Pools.isPossibleLpCoinType(inputs)) return "";

			const tx = new Transaction();

			this.poolObjectIdForLpCoinTypeTx({ tx, ...inputs });

			const bytes =
				await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
					tx,
				});

			return Casting.addressFromBytes(bytes);
		},
	});

	// TODO: add cache and generalize logic
	// public fetchPoolObjectIdForLpCoinTypes = this.Provider.withCache({
	// 	key: "fetchPoolObjectIdForLpCoinTypes",
	// 	expirationSeconds: -1,
	// 	callback: async (inputs: {
	// 		lpCoinType: CoinType;
	// 	}): Promise<ObjectId | undefined> => {
	// 		if (!Pools.isPossibleLpCoinType(inputs)) return "";

	// 		const tx = new Transaction();

	// 		this.poolObjectIdForLpCoinTypeTx({ tx, ...inputs });

	// 		const bytes =
	// 			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
	// 				tx,
	// 			});

	// 		return Casting.addressFromBytes(bytes);
	// 	},
	// });

	public fetchIsLpCoinType = this.Provider.withCache({
		key: "fetchIsLpCoinType",
		expirationSeconds: -1,
		callback: async (inputs: {
			lpCoinType: CoinType;
		}): Promise<boolean> => {
			const { lpCoinType } = inputs;

			const poolId = await this.fetchPoolObjectIdForLpCoinType({
				lpCoinType,
			});
			if (!poolId) return false;

			return true;
		},
	});

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

	/**
	 * Fetches statistics for a given pool.
	 * @param inputs An object containing the pool, trade events within a certain time frame, coins to price, and coins to decimals.
	 * @returns A Promise that resolves to a PoolStats object containing the volume, TVL, supply per LP token, LP token price, fees, and APY.
	 */
	public fetchPoolStats = this.Provider.withCache({
		key: "fetchPoolStats",
		expirationSeconds: 60 * 5,
		callback: async (inputs: { poolId: ObjectId }): Promise<PoolStats> => {
			const { poolId } = inputs;

			const pool = await this.fetchPool({ objectId: poolId });

			const poolCoins = pool.coins;
			const poolCoinTypes = Object.keys(pool.coins);

			// TODO: move common milliseconds to constants or use dayjs
			const durationMs24hrs = 86400000;

			const [coinsToPrice, coinsToDecimals, volumes] = await Promise.all([
				this.Provider.Prices().fetchCoinsToPrice({
					coins: poolCoinTypes,
				}),
				this.Provider.Coin().fetchCoinsToDecimals({
					coins: poolCoinTypes,
				}),
				this.fetchPoolVolume({
					poolId: pool.objectId,
					durationMs: durationMs24hrs,
				}),
			]);
			const volume = Helpers.calcIndexerVolumeUsd({
				volumes,
				coinsToDecimals,
				coinsToPrice,
			});

			const tvl = this.calcPoolTvl({
				poolCoins: pool.coins,
				coinsToPrice,
				coinsToDecimals,
			});
			const supplyPerLps = this.calcPoolSupplyPerLps(
				poolCoins,
				pool.lpCoinSupply
			);
			const lpPrice = this.calcPoolLpPrice({
				lpCoinDecimals: pool.lpCoinDecimals,
				lpCoinSupply: pool.lpCoinSupply,
				tvl,
			});

			// this is okay since all trade fees are currently the same for every coin
			const firstCoin = Object.values(pool.coins)[0];
			const fees =
				volume *
				FixedUtils.directCast(
					firstCoin.tradeFeeIn + firstCoin.tradeFeeOut
				);

			const apr = this.calcApr({
				fees24Hours: fees,
				tvl,
			});

			return {
				volume,
				tvl,
				supplyPerLps,
				lpPrice,
				fees,
				apr,
			};
		},
	});

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
		return this.Provider.indexerCaller.fetchIndexer<IndexerSwapVolumeResponse>(
			`pools/${poolId}/swap-volume/${durationMs}`
		);
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
	public calcPoolTvl = (inputs: {
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

	public fetchCalcPoolVolume24hrs = this.Provider.withCache({
		key: "fetchPool",
		expirationSeconds: 300, // 5 minutes
		callback: async (inputs: { poolId: ObjectId }) => {
			const { poolId } = inputs;

			const durationMs = 86400000; // 24hrs
			const volumes = await this.fetchPoolVolume({
				durationMs,
				poolId,
			});

			const coins = Helpers.uniqueArray([
				...volumes.map((vol) => vol.coinTypeIn),
				...volumes.map((vol) => vol.coinTypeOut),
			]);
			const [coinsToPrice, coinsToDecimals] = await Promise.all([
				this.Provider.Prices().fetchCoinsToPrice({ coins }),
				this.Provider.Coin().fetchCoinsToDecimals({ coins }),
			]);
			return Helpers.calcIndexerVolumeUsd({
				volumes,
				coinsToPrice,
				coinsToDecimals,
			});
		},
	});

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
	 * Calculates the APR (Annual Percentage Rate) based on the fees collected in the last 24 hours and the TVL (Total Value Locked) of a pool.
	 * @param inputs - An object containing the fees collected in the last 24 hours and the TVL of a pool.
	 * @returns The APR (Annual Percentage Rate) of the pool.
	 */
	public calcApr = (inputs: { fees24Hours: number; tvl: number }): number => {
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
	 * @param lpCoins The LP coins to fetch prices for.
	 * @returns An object containing the prices of the LP coins.
	 */
	public fetchLpCoinsToPrice = async (inputs: {
		lpCoins: CoinType[];
	}): Promise<CoinsToPrice> => {
		const { lpCoins } = inputs;

		const unsafeLpCoinPoolObjectIds = await Promise.all(
			lpCoins.map(async (lpCoinType) =>
				this.fetchPoolObjectIdForLpCoinType({
					lpCoinType,
				})
			)
		);

		const safeIndexes: number[] = [];
		const lpCoinPoolObjectIds = unsafeLpCoinPoolObjectIds.filter(
			(id, index) => {
				const isValid = id !== undefined;
				if (isValid) safeIndexes.push(index);
				return isValid;
			}
		) as ObjectId[];

		const poolStats = await Promise.all(
			lpCoinPoolObjectIds.map((poolId) => this.fetchPoolStats({ poolId }))
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
	 * @returns An array of pool data points.
	 */
	public fetchCalcPoolVolumeData = async (inputs: {
		poolId: ObjectId;
		timeframe: PoolGraphDataTimeframeKey;
	}) => {
		const { poolId, timeframe } = inputs;

		const pool = await this.fetchPool({ objectId: poolId });
		const coins = Object.keys(pool.coins);

		const [coinsToPrice, coinsToDecimals] = await Promise.all([
			this.Provider.Prices().fetchCoinsToPrice({
				coins,
			}),
			this.Provider.Coin().fetchCoinsToDecimals({ coins }),
		]);

		const { time, timeUnit } = PoolsApi.poolVolumeDataTimeframes[timeframe];
		const tradeEvents = await this.fetchTradeEventsWithinTime({
			time,
			timeUnit,
			poolId,
		});

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
					this.Provider.Coin().fetchCoinMetadata({ coin })
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
						.slice(0, -1)
						.map((baseCoinType, index) => {
							return Object.keys(pool.pool.coins)
								.slice(index + 1)
								.map((targetCoinType) => {
									if (!pool.stats)
										throw new Error(
											"pool is missing stats"
										);

									if (baseCoinType === targetCoinType)
										return undefined;

									const volumeData = (() => {
										const volumeDataIn = volumes.find(
											(volume) =>
												volume.coinTypeIn ===
												baseCoinType
										) ?? {
											totalAmountIn: 0,
											totalAmountOut: 0,
										};
										const volumeDataOut = volumes.find(
											(volume) =>
												volume.coinTypeOut ===
												baseCoinType
										) ?? {
											totalAmountIn: 0,
											totalAmountOut: 0,
										};

										return {
											baseVolume:
												volumeDataIn.totalAmountIn +
												volumeDataOut.totalAmountOut,
											targetVolume:
												volumeDataIn.totalAmountOut +
												volumeDataOut.totalAmountIn,
										};
									})();

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
										BigInt(volumeData.baseVolume),
										baseDecimals
									);
									const targetVolume =
										Coin.balanceWithDecimals(
											BigInt(volumeData.targetVolume),
											targetDecimals
										);

									const unscaledPrice = pool.getSpotPrice({
										coinInType: baseCoinType,
										coinOutType: targetCoinType,
									});
									const denominator =
										Coin.balanceWithDecimals(
											unscaledPrice,
											baseDecimals - targetDecimals
										);
									const price = denominator
										? 1 / denominator
										: 0;

									const data: CoinGeckoTickerData = {
										pool_id: pool.pool.objectId,
										base_currency: baseCoinType,
										target_currency: targetCoinType,
										ticker_id: `${baseCoinType}_${targetCoinType}`,
										liquidity_in_usd: pool.stats.tvl,
										base_volume: baseVolume,
										target_volume: targetVolume,
										last_price: price,
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

	// public fetchCoinGeckoHistoricalTradeData = async (inputs: {
	// 	limit: number;
	// 	baseCoinType: CoinType;
	// 	targetCoinType: CoinType;
	// 	coinsToDecimals: CoinsToDecimals;
	// }): Promise<CoinGeckoHistoricalTradeData[]> => {
	// 	const { coinsToDecimals } = inputs;
	// 	const trades = await this.fetchCoinGeckoHistoricalTrades(inputs);

	// 	return trades.map((trade) => {
	// 		const amountInWithDecimals = Coin.balanceWithDecimals(
	// 			BigInt(trade.amountIn),
	// 			coinsToDecimals[trade.coinTypeIn]
	// 		);
	// 		const amountOutWithDecimals = Coin.balanceWithDecimals(
	// 			BigInt(trade.amountOut),
	// 			coinsToDecimals[trade.coinTypeOut]
	// 		);

	// 		const [baseAmount, targetAmount, type]: [
	// 			number,
	// 			number,
	// 			"buy" | "sell"
	// 		] =
	// 			trade.coinTypeIn === inputs.baseCoinType
	// 				? [amountInWithDecimals, amountOutWithDecimals, "sell"]
	// 				: [amountOutWithDecimals, amountInWithDecimals, "buy"];
	// 		const price = baseAmount / targetAmount;
	// 		return {
	// 			price,
	// 			type,
	// 			trade_id: trade._id.$oid,
	// 			base_volume: baseAmount,
	// 			target_volume: targetAmount,
	// 			trade_timestamp: trade.timestampMs,
	// 		};
	// 	});
	// };

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	// private async fetchCoinGeckoHistoricalTrades(inputs: {
	// 	limit: number;
	// 	baseCoinType: CoinType;
	// 	targetCoinType: CoinType;
	// }): Promise<
	// 	{
	// 		_id: {
	// 			$oid: UniqueId;
	// 		};
	// 		amountIn: number;
	// 		amountOut: number;
	// 		timestampMs: Timestamp;
	// 		coinTypeIn: CoinType;
	// 		coinTypeOut: CoinType;
	// 	}[]
	// > {
	// 	const { limit, baseCoinType, targetCoinType } = inputs;
	// 	return this.Provider.indexerCaller.fetchIndexer(
	// 		`pools/coingecko/historical-trades/${Helpers.addLeadingZeroesToType(
	// 			baseCoinType
	// 		)}/${Helpers.addLeadingZeroesToType(targetCoinType)}`,
	// 		{
	// 			limit,
	// 		}
	// 	);
	// }

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

	private tradeV2EventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.eventsV2,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.swapV2
		);

	private depositV2EventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.eventsV2,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.depositV2
		);

	private withdrawV2EventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.eventsV2,
			PoolsApi.constants.moduleNames.events,
			PoolsApi.constants.eventNames.withdrawV2
		);
}

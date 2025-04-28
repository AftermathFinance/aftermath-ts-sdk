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
	ApiIndexerEventsBody,
	ObjectId,
	SuiAddress,
	ApiPublishLpCoinBodyV1,
	PoolLpInfo,
	CoinGeckoTickerData,
	CoinGeckoHistoricalTradeData,
	Timestamp,
	UniqueId,
	PoolObject,
	DaoFeePoolsAddresses,
	ApiCreatePoolBodyV1,
	ApiPoolsOwnedDaoFeePoolOwnerCapsBody,
	DaoFeePoolOwnerCapObject,
	ApiPublishLpCoinBodyV2,
} from "../../../types";
import {
	DaoFeePoolFieldsOnChain,
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
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
import { IndexerEventOnChain } from "../../../general/types/castingTypes";
import { FixedUtils } from "../../../general/utils/fixedUtils";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { bcs } from "@mysten/sui/bcs";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";
import {
	update_constants,
	update_identifiers,
} from "@mysten/move-bytecode-template";

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
			[this.addresses.pools.packages.ammV2]: {
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
				[PoolsApi.constants.moduleNames.interface]: {
					410: "Deprecated",
				},
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
			...(this.addresses.daoFeePools
				? {
						[this.addresses.daoFeePools.packages.ammV2]: {
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
					? this.addresses.pools.packages.ammInterfaceV2
					: this.addresses.pools.packages.ammV2,
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
	 * Executes a trade transaction on the specified pool.
	 * @param inputs An object containing the necessary inputs for the trade transaction.
	 * @returns A `TransactionObjectArgument` representing the trade transaction.
	 */
	public simpleTradeTx = (inputs: {
		tx: Transaction;
		poolId: ObjectId;
		coinInId: ObjectId | TransactionObjectArgument;
		coinInType: CoinType;
		minCoinOutAmount: Balance;
		coinOutType: CoinType;
		lpCoinType: CoinType;
	}): TransactionObjectArgument => {
		const {
			tx,
			poolId,
			coinInId,
			coinInType,
			minCoinOutAmount,
			coinOutType,
			lpCoinType,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.pools.packages.ammV2,
				PoolsApi.constants.moduleNames.swap,
				"swap_exact_in_direct"
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
				tx.pure.u64(minCoinOutAmount.toString()),
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
					? this.addresses.pools.packages.ammInterfaceV2
					: this.addresses.pools.packages.ammV2,
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
					? this.addresses.pools.packages.ammInterfaceV2
					: this.addresses.pools.packages.ammV2,
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
					? this.addresses.pools.packages.ammInterfaceV2
					: this.addresses.pools.packages.ammV2,
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
	public publishLpCoinTxV1 = (inputs: {
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

	/**
	 * Publishes a transaction block for creating a liquidity pool coin.
	 * @param inputs An object containing the transaction block and the decimal value of the liquidity pool coin.
	 * @returns A promise that resolves to the result of the transaction publishing.
	 */
	public publishLpCoinTxV2 = (inputs: {
		tx: Transaction;
		respectDecimals: boolean;
		poolFlatness: PoolFlatness;
		weights: PoolWeight[];
		lpCoinMetadata: {
			name: string;
			symbol: string;
			iconUrl: Url;
			decimals: CoinDecimal;
			description: string;
		};
	}) => {
		const compilation =
			this.addresses.pools.other?.createLpCoinCompilationV2;
		if (!compilation)
			throw new Error(
				"not all required addresses have been set in provider for lp coin publishing (requires bytecode compilation in `addresses.pools.other.createLpCoinCompilationV2`)"
			);

		const { tx, respectDecimals, poolFlatness, weights, lpCoinMetadata } =
			inputs;

		const encoder = new TextEncoder();
		const bytecode = encoder.encode(compilation);

		let updatedBytecode = update_identifiers(bytecode, {
			AF_LP: lpCoinMetadata.symbol.toUpperCase(),
			af_lp: lpCoinMetadata.symbol.toLowerCase(),
		});

		// update SYMBOL
		updatedBytecode = update_constants(
			bytecode,
			bcs.vector(bcs.string()).serialize(lpCoinMetadata.symbol).toBytes(), // new value
			bcs.vector(bcs.string()).serialize("1000").toBytes(), // current value
			"Vector(U8)" // type of the constant
		);
		// update NAME
		updatedBytecode = update_constants(
			bytecode,
			bcs.vector(bcs.string()).serialize(lpCoinMetadata.name).toBytes(), // new value
			bcs.vector(bcs.string()).serialize("1001").toBytes(), // current value
			"Vector(U8)" // type of the constant
		);
		// update DESCRIPTION
		updatedBytecode = update_constants(
			bytecode,
			bcs
				.vector(bcs.string())
				.serialize(lpCoinMetadata.description)
				.toBytes(), // new value
			bcs.vector(bcs.string()).serialize("1002").toBytes(), // current value
			"Vector(U8)" // type of the constant
		);
		// update URL
		updatedBytecode = update_constants(
			bytecode,
			bcs
				.vector(bcs.string())
				.serialize(lpCoinMetadata.iconUrl)
				.toBytes(), // new value
			bcs.vector(bcs.string()).serialize("empty").toBytes(), // current value
			"Vector(U8)" // type of the constant
		);
		// update POOL_COIN_DECIMALS
		updatedBytecode = update_constants(
			bytecode,
			bcs.u64().serialize(lpCoinMetadata.decimals).toBytes(), // new value
			bcs.u64().serialize(2313).toBytes(), // current value
			"U64" // type of the constant
		);
		// update RESPECT_DECIMALS
		updatedBytecode = update_constants(
			bytecode,
			bcs.bool().serialize(respectDecimals).toBytes(), // new value
			bcs.bool().serialize(false).toBytes(), // current value
			"Bool" // type of the constant
		);
		// update FLATNESS
		updatedBytecode = update_constants(
			bytecode,
			bcs.u64().serialize(poolFlatness).toBytes(), // new value
			bcs.u64().serialize(1014).toBytes(), // current value
			"U64" // type of the constant
		);

		for (const [index, weight] of weights.entries()) {
			// update WEIGHT_X
			updatedBytecode = update_constants(
				bytecode,
				bcs.u64().serialize(weight).toBytes(), // new value
				bcs
					.u64()
					.serialize(1006 + index)
					.toBytes(), // current value
				"U64" // type of the constant
			);
		}

		const decoder = new TextDecoder();
		const updatedCompilation = decoder.decode(updatedBytecode);
		const compiledModulesAndDeps = JSON.parse(updatedCompilation);

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
	public createPoolTxV1 = (inputs: {
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

	// TODO: handle bounds checks here instead of just on-chain ?
	/**
	 * Creates a transaction to create a new pool.
	 * @param inputs - An object containing the necessary inputs to create the pool.
	 * @returns A transaction block to create the pool.
	 */
	public createPoolTxV2 = (inputs: {
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
		lpCoinIconUrl: Url;
		createPoolCapId: ObjectId | TransactionObjectArgument;
		poolName: PoolName;
		poolFlatness: PoolFlatness;
		lpCoinDescription: string;
		respectDecimals: boolean;
		forceLpDecimals?: CoinDecimal;
		withTransfer?: boolean;
	}): TransactionObjectArgument[] /* (Pool<L>, Coin<L>) */ => {
		const { tx, lpCoinType, createPoolCapId, coinsInfo, withTransfer } =
			inputs;

		const poolSize = coinsInfo.length;
		const coinTypes = coinsInfo.map((coin) => coin.coinType);
		const decimals = coinsInfo.map((coin) => coin.decimals);

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				withTransfer
					? this.addresses.pools.packages.ammInterfaceV2
					: this.addresses.pools.packages.ammV2,
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
				this.addresses.pools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
				this.addresses.daoFeePools.packages.ammV2,
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
	public buildPublishLpCoinTxV1 = (
		inputs: ApiPublishLpCoinBodyV1
	): Transaction => {
		const { lpCoinDecimals } = inputs;

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const upgradeCap = this.publishLpCoinTxV1({ tx, lpCoinDecimals });
		tx.transferObjects([upgradeCap], inputs.walletAddress);

		return tx;
	};

	/**
	 * Builds a transaction block for publishing an LP coin.
	 * @param inputs - The input parameters for the transaction.
	 * @returns The built transaction block.
	 */
	public buildPublishLpCoinTxV2 = (
		inputs: ApiPublishLpCoinBodyV2
	): Transaction => {
		const { walletAddress, ...otherInputs } = inputs;

		const tx = new Transaction();
		tx.setSender(inputs.walletAddress);

		const upgradeCap = this.publishLpCoinTxV2({ tx, ...otherInputs });
		tx.transferObjects([upgradeCap], inputs.walletAddress);

		return tx;
	};

	public buildDaoFeePoolUpdateFeeBpsTx =
		Helpers.transactions.createBuildTxFunc(this.daoFeePoolUpdateFeeBpsTx);

	public buildDaoFeePoolUpdateFeeRecipientTx =
		Helpers.transactions.createBuildTxFunc(
			this.daoFeePoolUpdateFeeRecipientTx
		);

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

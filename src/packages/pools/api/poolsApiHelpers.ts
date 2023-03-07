import {
	GetObjectDataResponse,
	MoveCallTransaction,
	ObjectId,
	SignableTransaction,
	SuiAddress,
	getObjectId,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinDecimal,
	CoinType,
	GasBudget,
	IndicesPoolDataPoint,
	PoolVolumeDataTimeframe,
	PoolVolumeDataTimeframeKey,
	PoolDynamicFields,
	PoolObject,
	PoolTradeEvent,
	PoolsAddresses,
	AnyObjectType,
} from "../../../types";
import { CoinApiHelpers } from "../../coin/api/coinApiHelpers";
import { Coin } from "../../coin/coin";
import { Pools } from "../pools";
import dayjs, { ManipulateType } from "dayjs";

export class PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		modules: {
			pools: "interface",
			math: "math",
			events: "events",
		},
		functions: {
			swap: {
				name: "swap",
				defaultGasBudget: 10000,
			},
			deposit: {
				name: "deposit_X_coins",
				defaultGasBudget: 20000,
			},
			withdraw: {
				name: "withdraw_X_coins",
				defaultGasBudget: 20000,
			},
			// publish 30000
		},
		eventNames: {
			swap: "SwapEvent",
			deposit: "DepositEvent",
			withdraw: "WithdrawEvent",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: PoolsAddresses;
	public readonly eventTypes: {
		trade: AnyObjectType;
		deposit: AnyObjectType;
		withdraw: AnyObjectType;
	};

	protected readonly poolVolumeDataTimeframes: Record<
		PoolVolumeDataTimeframeKey,
		PoolVolumeDataTimeframe
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

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(protected readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.pools;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = addresses;

		this.eventTypes = {
			trade: this.tradeEventType(),
			deposit: this.depositEventType(),
			withdraw: this.withdrawEventType(),
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	protected spotPriceMoveCall = (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType
	): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "calc_spot_price",
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [poolId],
		};
	};

	protected tradeAmountOutMoveCall = (
		poolId: ObjectId,
		coinInType: CoinType,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		coinInAmount: bigint
	): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "calc_swap_amount_out",
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [poolId, coinInAmount.toString()],
		};
	};

	protected depositLpMintAmountMoveCall = (
		poolId: ObjectId,
		lpCoinType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "dev_inspect_calc_deposit_lp_mint_amount_u8",
			typeArguments: [lpCoinType],
			arguments: [
				poolId,
				CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
				coinAmounts.map((amount) => amount.toString()),
			],
		};
	};

	protected withdrawAmountOutMoveCall = (
		poolId: ObjectId,
		lpCoinType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): MoveCallTransaction => {
		return {
			packageObjectId: this.addresses.packages.cmmm,
			module: PoolsApiHelpers.constants.modules.math,
			function: "dev_inspect_calc_withdraw_amount_out_u8",
			typeArguments: [lpCoinType],
			arguments: [
				poolId,
				CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
				coinAmounts.map((amount) => amount.toString()),
			],
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	protected tradeTransaction = (
		poolId: ObjectId,
		coinInId: ObjectId,
		coinInType: CoinType,
		coinOutMin: Balance,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.swap
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "swap",
				typeArguments: [lpCoinType, coinInType, coinOutType],
				arguments: [poolId, coinInId, coinOutMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected singleCoinDepositTransaction = (
		poolId: ObjectId,
		coinId: ObjectId,
		coinType: CoinType,
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "single_coin_deposit",
				typeArguments: [lpCoinType, coinType],
				arguments: [poolId, coinId, lpMintMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected multiCoinDepositTransaction = (
		poolId: ObjectId,
		coinIds: ObjectId[],
		coinTypes: CoinType[],
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): SignableTransaction => {
		const poolSize = coinTypes.length;
		if (poolSize != coinIds.length)
			throw new Error(
				`invalid coinIds size: ${coinIds.length} != ${poolSize}`
			);

		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: `deposit_${poolSize}_coins`,
				typeArguments: [lpCoinType, ...coinTypes],
				arguments: [poolId, ...coinIds, lpMintMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected singleCoinWithdrawTransaction = (
		poolId: ObjectId,
		lpCoinId: ObjectId,
		lpCoinType: CoinType,
		amountOutMin: Balance,
		coinOutType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): SignableTransaction => {
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: "single_coin_withdraw",
				typeArguments: [lpCoinType, coinOutType],
				arguments: [poolId, lpCoinId, amountOutMin.toString()],
				gasBudget: gasBudget,
			},
		};
	};

	protected multiCoinWithdrawTransaction = (
		poolId: ObjectId,
		lpCoinId: ObjectId,
		lpCoinType: CoinType,
		amountsOutMin: Balance[],
		coinsOutType: CoinType[],
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): SignableTransaction => {
		const poolSize = coinsOutType.length;
		return {
			kind: "moveCall",
			data: {
				packageObjectId: this.addresses.packages.cmmm,
				module: PoolsApiHelpers.constants.modules.pools,
				function: `withdraw_${poolSize}_coins`,
				typeArguments: [lpCoinType, ...coinsOutType],
				arguments: [
					poolId,
					lpCoinId,
					amountsOutMin.map((amountOutMin) =>
						amountOutMin.toString()
					),
				],
				gasBudget: gasBudget,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	// TODO: abstract i and ii into a new function that can also be called by swap/deposit/withdraw.

	protected fetchBuildTradeTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		fromCoinType: CoinType,
		fromCoinAmount: Balance,
		toCoinType: CoinType
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of coin to swap from
		const response =
			await this.Provider.CoinHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				fromCoinType,
				fromCoinAmount
			);

		const coinInId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `fromCoinType` with exact
		// value of `fromCoinAmount`, so we need to create it
		const joinAndSplitTransactions =
			this.Provider.CoinHelpers.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				fromCoinType,
				fromCoinAmount
			);

		transactions.push(...joinAndSplitTransactions);

		// iii. trade `coinInId` to for coins of type `toCoinType`
		transactions.push(
			this.tradeTransaction(
				poolObjectId,
				coinInId,
				fromCoinType,
				BigInt(0), // TODO: calc slippage amount
				toCoinType,
				poolLpType
			)
		);

		return transactions;
	};

	protected fetchBuildDepositTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of `coinTypes` to deposit
		const responses = (
			await Promise.all(
				coinTypes.map((coinType, index) =>
					this.Provider.CoinHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
						walletAddress,
						coinType,
						coinAmounts[index]
					)
				)
			)
		)
			// safe check as responses is guaranteed to not contain undefined
			.filter(
				(response): response is GetObjectDataResponse[] => !!response
			);

		let allCoinIds: ObjectId[] = [];
		let allCoinIdsToJoin: [ObjectId[]] = [[]];

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `coinType` with exact
		// value of `coinAmount`, so we need to create it
		responses.forEach((response, index) => {
			const joinAndSplitTransactions =
				this.Provider.CoinHelpers.coinJoinAndSplitWithExactAmountTransactions(
					response[0],
					response.slice(1),
					coinTypes[index],
					coinAmounts[index]
				);
			if (!joinAndSplitTransactions) return;
			transactions.push(...joinAndSplitTransactions);

			const [coinId, ...coinIdsToJoin] = response.map(
				(getObjectDataResponse) => getObjectId(getObjectDataResponse)
			);
			allCoinIds.push(coinId);
			allCoinIdsToJoin.push(coinIdsToJoin);
		});

		// iii. deposit `allCoinIds` into `pool.objectId`
		transactions.push(
			this.multiCoinDepositTransaction(
				poolObjectId,
				allCoinIds,
				coinTypes,
				BigInt(0), // TODO: calc slippage amount
				poolLpType
			)
		);

		return transactions;
	};

	protected fetchBuildWithdrawTransactions = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		lpCoinAmount: Balance,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<SignableTransaction[]> => {
		// i. obtain object ids of `lpCoinType` to burn
		const response =
			await this.Provider.CoinHelpers.fetchSelectCoinSetWithCombinedBalanceGreaterThanOrEqual(
				walletAddress,
				poolLpType,
				lpCoinAmount
			);

		const lpCoinInId = getObjectId(response[0]);

		let transactions: SignableTransaction[] = [];
		// ii. the user doesn't have a coin of type `fromCoinType` with exact
		// value of `fromCoinAmount`, so we need to create it
		const joinAndSplitTransactions =
			this.Provider.CoinHelpers.coinJoinAndSplitWithExactAmountTransactions(
				response[0],
				response.slice(1),
				poolLpType,
				lpCoinAmount
			);

		transactions.push(...joinAndSplitTransactions);

		// iii. burn `lpCoinInId` and withdraw a pro-rata amount of the Pool's underlying coins.
		transactions.push(
			this.multiCoinWithdrawTransaction(
				poolObjectId,
				lpCoinInId,
				poolLpType,
				coinAmounts, // TODO: calc slippage amount
				coinTypes
			)
		);

		return transactions;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// NOTE: should this volume calculation also take into account deposits and withdraws
	// (not just swaps) ?
	protected fetchCalcPoolVolume = (
		poolObjectId: ObjectId,
		poolCoins: CoinType[],
		swapEvents: PoolTradeEvent[],
		prices: number[],
		coinsToDecimals: Record<CoinType, CoinDecimal>
	) => {
		const swapsForPool = swapEvents.filter(
			(swap) => swap.poolId === poolObjectId
		);

		let volume = 0;
		for (const swap of swapsForPool) {
			const decimals = coinsToDecimals[swap.typeIn];
			const swapAmount = Coin.balanceWithDecimals(
				swap.amountIn,
				decimals
			);

			const priceIndex = poolCoins.findIndex(
				(coin) => coin === swap.typeIn
			);
			const coinInPrice = prices[priceIndex];

			const amountUsd = swapAmount * coinInPrice;
			volume += amountUsd;
		}

		return volume;
	};

	protected fetchCalcPoolTvl = async (
		dynamicFields: PoolDynamicFields,
		prices: number[],
		coinsToDecimals: Record<CoinType, CoinDecimal>
	) => {
		const amountsWithDecimals: number[] = [];
		for (const amountField of dynamicFields.amountFields) {
			const amountWithDecimals = Coin.balanceWithDecimals(
				amountField.value,
				coinsToDecimals[amountField.coin]
			);
			amountsWithDecimals.push(amountWithDecimals);
		}

		const tvl = amountsWithDecimals
			.map((amount, index) => amount * prices[index])
			.reduce((prev, cur) => prev + cur, 0);

		return tvl;
	};

	protected calcPoolSupplyPerLps = (dynamicFields: PoolDynamicFields) => {
		const lpSupply = dynamicFields.lpFields[0].value;
		const supplyPerLps = dynamicFields.amountFields.map(
			(field) => Number(field.value) / Number(lpSupply)
		);

		return supplyPerLps;
	};

	protected calcPoolLpPrice = (
		dynamicFields: PoolDynamicFields,
		tvl: Number
	) => {
		const lpSupply = dynamicFields.lpFields[0].value;
		const lpCoinDecimals = Pools.constants.lpCoinDecimals;
		const lpPrice = Number(
			Number(tvl) / Coin.balanceWithDecimals(lpSupply, lpCoinDecimals)
		);

		return lpPrice;
	};

	/////////////////////////////////////////////////////////////////////
	//// Prices
	/////////////////////////////////////////////////////////////////////

	protected findPriceForCoinInPool = (
		coin: CoinType,
		lpCoins: CoinType[],
		nonLpCoins: CoinType[],
		lpPrices: number[],
		nonLpPrices: number[]
	) => {
		if (Pools.isLpCoin(coin)) {
			const index = lpCoins.findIndex((lpCoin) => lpCoin === coin);
			return lpPrices[index];
		}

		const index = nonLpCoins.findIndex((nonLpCoin) => nonLpCoin === coin);
		return nonLpPrices[index];
	};

	/////////////////////////////////////////////////////////////////////
	//// Graph Data
	/////////////////////////////////////////////////////////////////////

	protected fetchCalcPoolVolumeData = async (
		pool: PoolObject,
		tradeEvents: PoolTradeEvent[],
		timeUnit: ManipulateType,
		time: number,
		buckets: number
	) => {
		// TODO: use promise.all for pool fetching and swap fetching

		const coinsToDecimalsAndPrices =
			await this.Provider.CoinHelpers.fetchCoinsToDecimalsAndPrices(
				pool.fields.coins
			);

		const now = Date.now();
		const maxTimeAgo = dayjs(now).subtract(time, timeUnit);
		const timeGap = dayjs(now).diff(maxTimeAgo);

		const bucketTimestampSize = timeGap / buckets;
		const emptyDataPoints: IndicesPoolDataPoint[] = Array(buckets)
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

		const dataPoints = tradeEvents.reduce((acc, swap) => {
			const bucketIndex =
				acc.length -
				Math.floor(
					dayjs(now).diff(swap.timestamp) / bucketTimestampSize
				) -
				1;
			const amountUsd = Coin.balanceWithDecimalsUsd(
				swap.amountIn,
				coinsToDecimalsAndPrices[swap.typeIn].decimals,
				coinsToDecimalsAndPrices[swap.typeIn].price
			);

			acc[bucketIndex].value += amountUsd;

			return acc;
		}, emptyDataPoints);

		return dataPoints;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	// TODO: change all swap naming to trade
	private tradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.swap
		);

	private depositEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.deposit
		);

	private withdrawEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.modules.events,
			PoolsApiHelpers.constants.eventNames.withdraw
		);
}

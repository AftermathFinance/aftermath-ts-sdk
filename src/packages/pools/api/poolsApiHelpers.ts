import {
	ObjectId,
	TransactionBlock,
	SuiAddress,
	VECTOR,
	TransactionArgument,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinDecimal,
	CoinType,
	GasBudget,
	PoolDataPoint,
	PoolVolumeDataTimeframe,
	PoolVolumeDataTimeframeKey,
	PoolDynamicFields,
	PoolObject,
	PoolTradeEvent,
	PoolsAddresses,
	AnyObjectType,
} from "../../../types";
import { Coin } from "../../coin/coin";
import { Pools } from "../pools";
import dayjs, { ManipulateType } from "dayjs";

export class PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			pools: "interface",
			math: "math",
			events: "events",
		},
		functions: {
			swap: {
				name: "swap",
				defaultGasBudget: 100000000,
			},
			deposit: {
				name: "deposit_X_coins",
				defaultGasBudget: 2000000,
			},
			withdraw: {
				name: "withdraw_X_coins",
				defaultGasBudget: 2000000,
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

	public readonly poolVolumeDataTimeframes: Record<
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

	constructor(public readonly Provider: AftermathApi) {
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
	//// Move Calls
	/////////////////////////////////////////////////////////////////////

	// public spotPriceDevInspectTransaction = (
	// 	poolId: ObjectId,
	// 	coinInType: CoinType,
	// 	coinOutType: CoinType,
	// 	lpCoinType: CoinType
	// ): Transaction => {
	// 	const tx = new Transaction();

	// 	tx.moveCall({
	// 		target: AftermathApi.helpers.transactions.createTransactionTarget(
	// 			this.addresses.packages.cmmm,
	// 			PoolsApiHelpers.constants.moduleNames.math,
	// 			"calc_spot_price"
	// 		),
	// 		typeArguments: [lpCoinType, coinInType, coinOutType],
	// 		arguments: [tx.object(poolId)],
	// 	});

	// 	return tx;
	// };

	// public tradeAmountOutDevInspectTransaction = (
	// 	poolId: ObjectId,
	// 	coinInType: CoinType,
	// 	coinOutType: CoinType,
	// 	lpCoinType: CoinType,
	// 	coinInAmount: bigint
	// ): Transaction => {
	// 	const tx = new Transaction();

	// 	tx.moveCall({
	// 		target: AftermathApi.helpers.transactions.createTransactionTarget(
	// 			this.addresses.packages.cmmm,
	// 			PoolsApiHelpers.constants.moduleNames.math,
	// 			"calc_swap_amount_out"
	// 		),
	// 		typeArguments: [lpCoinType, coinInType, coinOutType],
	// 		arguments: [tx.object(poolId), tx.pure(coinInAmount.toString())],
	// 	});

	// 	return tx;
	// };

	// public depositLpMintAmountDevInspectTransaction = (
	// 	poolId: ObjectId,
	// 	lpCoinType: CoinType,
	// 	coinTypes: CoinType[],
	// 	coinAmounts: Balance[]
	// ): Transaction => {
	// 	return {
	// 		 this.addresses.packages.cmmm,
	// 		 PoolsApiHelpers.constants.moduleNames.math,
	// 		 "dev_inspect_calc_deposit_lp_mint_amount_u8",
	// 		typeArguments: [lpCoinType],
	// 		arguments: [
	// 			poolId,
	// 			CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
	// 			coinAmounts.map((amount) => amount.toString()),
	// 		],
	// 	};
	// };

	// public withdrawAmountOutDevInspectTransaction = (
	// 	poolId: ObjectId,
	// 	lpCoinType: CoinType,
	// 	coinTypes: CoinType[],
	// 	coinAmounts: Balance[]
	// ): Transaction => {
	// 	return {
	// 		 this.addresses.packages.cmmm,
	// 		 PoolsApiHelpers.constants.moduleNames.math,
	// 		 "dev_inspect_calc_withdraw_amount_out_u8",
	// 		typeArguments: [lpCoinType],
	// 		arguments: [
	// 			poolId,
	// 			CoinApiHelpers.formatCoinTypesForMoveCall(coinTypes),
	// 			coinAmounts.map((amount) => amount.toString()),
	// 		],
	// 	};
	// };

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	public addTradeCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinInId: ObjectId | TransactionArgument,
		coinInType: CoinType,
		coinOutMin: Balance,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.swap
			.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				"swap"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(poolId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(coinOutMin.toString()),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addSingleCoinDepositCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinId: ObjectId,
		coinType: CoinType,
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				"single_coin_deposit"
			),
			typeArguments: [lpCoinType, coinType],
			arguments: [
				tx.object(poolId),
				tx.object(coinId),
				tx.pure(lpMintMin.toString()),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addMultiCoinDepositCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinIds: ObjectId[] | TransactionArgument[],
		coinTypes: CoinType[],
		lpMintMin: Balance,
		lpCoinType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.deposit
			.defaultGasBudget
	): TransactionBlock => {
		const poolSize = coinTypes.length;
		if (poolSize != coinIds.length)
			throw new Error(
				`invalid coinIds size: ${coinIds.length} != ${poolSize}`
			);

		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				`deposit_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(poolId),
				...coinIds.map((coinId) =>
					typeof coinId === "string" ? tx.object(coinId) : coinId
				),
				tx.pure(lpMintMin.toString()),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addSingleCoinWithdrawCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		lpCoinId: ObjectId,
		lpCoinType: CoinType,
		amountOutMin: Balance,
		coinOutType: CoinType,
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				"single_coin_withdraw"
			),
			typeArguments: [lpCoinType, coinOutType],
			arguments: [
				tx.object(poolId),
				tx.object(lpCoinId),
				tx.pure(amountOutMin.toString()),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	public addMultiCoinWithdrawCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		lpCoinId: ObjectId | TransactionArgument,
		lpCoinType: CoinType,
		amountsOutMin: Balance[],
		coinsOutType: CoinType[],
		gasBudget: GasBudget = PoolsApiHelpers.constants.functions.withdraw
			.defaultGasBudget
	): TransactionBlock => {
		const poolSize = coinsOutType.length;

		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				`withdraw_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinsOutType],
			arguments: [
				tx.object(poolId),
				typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
				tx.pure(
					amountsOutMin.map((amountOutMin) => amountOutMin.toString())
				),
			],
		});
		tx.setGasBudget(gasBudget);

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	// TODO: abstract i and ii into a new function that can also be called by swap/deposit/withdraw.

	public fetchBuildTradeTransaction = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		fromCoinType: CoinType,
		fromCoinAmount: Balance,
		toCoinType: CoinType
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				fromCoinType,
				fromCoinAmount
			);

		const finalTx = this.addTradeCommandToTransaction(
			txWithCoinWithAmount,
			poolObjectId,
			coinArgument,
			fromCoinType,
			BigInt(0), // TODO: calc slippage amount
			toCoinType,
			poolLpType
		);

		return finalTx;
	};

	public fetchBuildDepositTransaction = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		const { coinArguments, txWithCoinsWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinsWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				coinTypes,
				coinAmounts
			);

		const finalTx = this.addMultiCoinDepositCommandToTransaction(
			txWithCoinsWithAmount,
			poolObjectId,
			coinArguments,
			coinTypes,
			BigInt(0), // TODO: calc slippage amount
			poolLpType
		);

		return finalTx;
	};

	public fetchBuildWithdrawTransaction = async (
		walletAddress: SuiAddress,
		poolObjectId: ObjectId,
		poolLpType: CoinType,
		lpCoinAmount: Balance,
		coinTypes: CoinType[],
		coinAmounts: Balance[]
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();

		const { coinArgument: lpCoinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				poolLpType,
				lpCoinAmount
			);

		const finalTx = this.addMultiCoinWithdrawCommandToTransaction(
			txWithCoinWithAmount,
			poolObjectId,
			lpCoinArgument,
			poolLpType,
			coinAmounts, // TODO: calc slippage amount
			coinTypes
		);

		return finalTx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	// NOTE: should this volume calculation also take into account deposits and withdraws
	// (not just swaps) ?
	public fetchCalcPoolVolume = (
		poolObjectId: ObjectId,
		poolCoins: CoinType[],
		tradeEvents: PoolTradeEvent[],
		prices: number[],
		coinsToDecimals: Record<CoinType, CoinDecimal>
	) => {
		const tradesForPool = tradeEvents.filter(
			(trade) => trade.poolId === poolObjectId
		);

		let volume = 0;
		for (const trade of tradesForPool) {
			const decimals = coinsToDecimals[trade.typeIn];
			const tradeAmount = Coin.balanceWithDecimals(
				trade.amountIn,
				decimals
			);

			const priceIndex = poolCoins.findIndex(
				(coin) => coin === trade.typeIn
			);
			const coinInPrice = prices[priceIndex];

			const amountUsd = tradeAmount * coinInPrice;
			volume += amountUsd;
		}

		return volume;
	};

	public fetchCalcPoolTvl = async (
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

	public calcPoolSupplyPerLps = (dynamicFields: PoolDynamicFields) => {
		const lpSupply = dynamicFields.lpFields[0].value;
		const supplyPerLps = dynamicFields.amountFields.map(
			(field) => Number(field.value) / Number(lpSupply)
		);

		return supplyPerLps;
	};

	public calcPoolLpPrice = (
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

	public findPriceForCoinInPool = (
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

	public fetchCalcPoolVolumeData = async (
		pool: PoolObject,
		tradeEvents: PoolTradeEvent[],
		timeUnit: ManipulateType,
		time: number,
		buckets: number
	) => {
		// TODO: use promise.all for pool fetching and swap fetching

		const coinsToDecimalsAndPrices =
			await this.Provider.Coin().Helpers.fetchCoinsToDecimalsAndPrices(
				pool.fields.coins
			);

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
			const bucketIndex =
				acc.length -
				Math.floor(
					dayjs(now).diff(trade.timestamp) / bucketTimestampSize
				) -
				1;
			const amountUsd = Coin.balanceWithDecimalsUsd(
				trade.amountIn,
				coinsToDecimalsAndPrices[trade.typeIn].decimals,
				coinsToDecimalsAndPrices[trade.typeIn].price
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

	private tradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.swap
		);

	private depositEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.deposit
		);

	private withdrawEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.withdraw
		);
}

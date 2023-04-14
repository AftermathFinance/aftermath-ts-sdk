import {
	ObjectId,
	TransactionBlock,
	SuiAddress,
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
	PoolObject,
	PoolTradeEvent,
	PoolsAddresses,
	AnyObjectType,
	PoolCoins,
	CoinsToPrice,
	Slippage,
} from "../../../types";
import { Coin } from "../../coin/coin";
import { Pools } from "../pools";
import dayjs, { ManipulateType } from "dayjs";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";
import { Pool } from "..";

export class PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			pools: "interface",
			swap: "swap",
			math: "math",
			events: "events",
			poolRegistry: "pool_registry",
		},
		functions: {
			swap: {
				name: "swap",
			},
			deposit: {
				name: "deposit_X_coins",
			},
			withdraw: {
				name: "withdraw_X_coins",
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
	//// Dev Inspects
	/////////////////////////////////////////////////////////////////////

	public poolObjectIdForLpCoinTypeDevInspectTransaction = (
		lpCoinType: CoinType
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.poolRegistry,
				"lp_type_to_pool_id"
			),
			typeArguments: [lpCoinType],
			arguments: [tx.object(this.addresses.objects.poolRegistry)],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	public addTradeCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinInId: ObjectId | TransactionArgument,
		coinInType: CoinType,
		expectedAmountOut: Balance,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		slippage: Slippage,
		referrer?: SuiAddress
	): TransactionBlock => {
		tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.pools,
				"swap_exact_in"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(expectedAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				),
			],
		});

		return tx;
	};

	public addTradeCommandWithCoinOutToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinInId: ObjectId | TransactionArgument,
		coinInType: CoinType,
		expectedAmountOut: Balance,
		coinOutType: CoinType,
		lpCoinType: CoinType,
		slippage: Slippage,
		referrer?: SuiAddress
	): {
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	} => {
		const [coinOut] = tx.add({
			kind: "MoveCall",
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.swap,
				"swap_exact_in"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(expectedAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				),
			],
		});

		return {
			tx,
			coinOut,
		};
	};

	public addMultiCoinDepositCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		coinIds: ObjectId[] | TransactionArgument[],
		coinTypes: CoinType[],
		expectedLpRatio: Balance,
		lpCoinType: CoinType,
		slippage: Slippage,
		referrer?: SuiAddress
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
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				...coinIds.map((coinId) =>
					typeof coinId === "string" ? tx.object(coinId) : coinId
				),
				tx.pure(expectedLpRatio.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				),
			],
		});

		return tx;
	};

	public addMultiCoinWithdrawCommandToTransaction = (
		tx: TransactionBlock,
		poolId: ObjectId,
		lpCoinId: ObjectId | TransactionArgument,
		lpCoinType: CoinType,
		expectedAmountsOut: Balance[],
		coinsOutType: CoinType[],
		slippage: Slippage,
		referrer?: SuiAddress
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
				tx.object(this.addresses.objects.protocolFeeVault),
				tx.object(this.addresses.objects.treasury),
				tx.object(this.addresses.objects.insuranceFund),
				typeof lpCoinId === "string" ? tx.object(lpCoinId) : lpCoinId,
				tx.pure(expectedAmountsOut.map((amount) => amount.toString())),
				tx.pure(Pools.normalizeSlippage(slippage)),
				tx.pure(
					TransactionsApiHelpers.createOptionObject(referrer),
					"Option<address>"
				),
			],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildTradeTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		fromCoinType: CoinType,
		fromCoinAmount: Balance,
		toCoinType: CoinType,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const { coinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				fromCoinType,
				fromCoinAmount
			);

		const { coinOutAmount: amountOut, error } = pool.getTradeAmountOut({
			coinInAmount: fromCoinAmount,
			coinInType: fromCoinType,
			coinOutType: toCoinType,
		});
		if (error !== undefined) throw new Error(error);

		const finalTx = this.addTradeCommandToTransaction(
			txWithCoinWithAmount,
			pool.pool.objectId,
			coinArgument,
			fromCoinType,
			amountOut,
			toCoinType,
			pool.pool.lpCoinType,
			slippage,
			referrer
		);

		return finalTx;
	};

	public fetchBuildDepositTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		coinTypes: CoinType[],
		coinAmounts: Balance[],
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const { coinArguments, txWithCoinsWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinsWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				coinTypes,
				coinAmounts
			);

		// PRODUCTION: do calc here !
		const expectedLpRatio = BigInt(0);

		const finalTx = this.addMultiCoinDepositCommandToTransaction(
			txWithCoinsWithAmount,
			pool.pool.objectId,
			coinArguments,
			coinTypes,
			expectedLpRatio,
			pool.pool.lpCoinType,
			slippage,
			referrer
		);

		return finalTx;
	};

	public fetchBuildWithdrawTransaction = async (
		walletAddress: SuiAddress,
		pool: Pool,
		coinTypes: CoinType[],
		coinAmounts: Balance[],
		lpCoinAmount: Balance,
		slippage: Slippage,
		referrer?: SuiAddress
	): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		// PRODUCTION: do calc here !
		// const lpCoinAmount = BigInt(0);

		const { coinArgument: lpCoinArgument, txWithCoinWithAmount } =
			await this.Provider.Coin().Helpers.fetchAddCoinWithAmountCommandsToTransaction(
				tx,
				walletAddress,
				pool.pool.lpCoinType,
				lpCoinAmount
			);

		const finalTx = this.addMultiCoinWithdrawCommandToTransaction(
			txWithCoinWithAmount,
			pool.pool.objectId,
			lpCoinArgument,
			pool.pool.lpCoinType,
			coinAmounts, // TODO: calc slippage amount
			coinTypes,
			slippage,
			referrer
		);

		return finalTx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

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

	public fetchCalcPoolTvl = async (
		poolCoins: PoolCoins,
		prices: CoinsToPrice,
		coinsToDecimals: Record<CoinType, CoinDecimal>
	) => {
		let tvl = 0;

		for (const [poolCoinType, poolCoin] of Object.entries(poolCoins)) {
			const amountWithDecimals = Coin.balanceWithDecimals(
				poolCoin.balance,
				coinsToDecimals[poolCoinType]
			);
			tvl += amountWithDecimals * prices[poolCoinType];
		}

		return tvl;
	};

	public calcPoolSupplyPerLps = (poolCoins: PoolCoins, lpSupply: Balance) => {
		const supplyPerLps = Object.values(poolCoins).map(
			(poolCoin) => Number(poolCoin.balance) / Number(lpSupply)
		);

		return supplyPerLps;
	};

	public calcPoolLpPrice = (lpSupply: Balance, tvl: number) => {
		const lpCoinDecimals = Pools.constants.decimals.lpCoinDecimals;
		const lpPrice = Number(
			Number(tvl) / Coin.balanceWithDecimals(lpSupply, lpCoinDecimals)
		);

		return lpPrice;
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
		// PRODUCTION: pass in prices/decimals from elsewhere
	) => {
		// TODO: use promise.all for pool fetching and swap fetching

		const coinsToDecimalsAndPrices =
			await this.Provider.Coin().Helpers.fetchCoinsToDecimalsAndPrices(
				Object.keys(pool.coins)
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
			if (trade.timestamp === undefined) return acc;

			const tradeDate = dayjs.unix(trade.timestamp / 1000);
			const bucketIndex =
				acc.length -
				Math.floor(dayjs(now).diff(tradeDate) / bucketTimestampSize) -
				1;

			const amountUsd = trade.typesIn.reduce((acc, cur, index) => {
				const amountInUsd = Coin.balanceWithDecimalsUsd(
					trade.amountsIn[index],
					coinsToDecimalsAndPrices[cur].decimals,
					coinsToDecimalsAndPrices[cur].price
				);
				return acc + (amountInUsd < 0 ? 0 : amountInUsd);
			}, 0);

			acc[bucketIndex].value += amountUsd;

			return acc;
		}, emptyDataPoints);

		return dataPoints;
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	// PRODUCTION: should this perform a dev inspect to pool registry instead of using string alone ?
	public isLpCoin = (coin: CoinType) => {
		return (
			coin.split("::").length === 3 &&
			coin.split("::")[1].includes("af_lp_") &&
			coin.split("::")[2].includes("AF_LP_")
		);
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

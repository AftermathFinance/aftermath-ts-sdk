import {
	ObjectId,
	TransactionBlock,
	SuiAddress,
	TransactionArgument,
	fromB64,
	normalizeSuiObjectId,
} from "@mysten/sui.js";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	CoinDecimal,
	CoinType,
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
	CoinsToBalance,
	ReferralVaultAddresses,
	Url,
	PoolName,
	PoolCreationCoinInfo,
	PoolFlatness,
	PoolCreationLpCoinMetadata,
	PoolWeight,
	PoolTradeFee,
	PoolDepositFee,
	PoolWithdrawFee,
} from "../../../types";
import { Coin } from "../../coin/coin";
import { Pools } from "../pools";
import dayjs, { ManipulateType } from "dayjs";
import { Pool } from "..";
import { Casting, Helpers } from "../../../general/utils";
import { EventOnChain } from "../../../general/types/castingTypes";

export class PoolsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			pool: "pool",
			swap: "swap",
			deposit: "deposit",
			withdraw: "withdraw",
			math: "math",
			events: "events",
			poolRegistry: "pool_registry",
			poolFactory: "pool_factory",
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
		},
		eventNames: {
			swap: "SwapEvent",
			deposit: "DepositEvent",
			withdraw: "WithdrawEvent",
		},
		defaultLpCoinIconImageUrl:
			"https://aftermath.finance/coins/lp/af_lp.svg",
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};
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

	constructor(private readonly Provider: AftermathApi) {
		const addresses = {
			pools: this.Provider.addresses.pools,
			referralVault: this.Provider.addresses.referralVault,
		};
		if (!addresses.pools || !addresses.referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		// @ts-ignore
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
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPoolObjectIds = async (): Promise<ObjectId[]> => {
		const objectIds = await this.Provider.Events().fetchAllEvents(
			(cursor, limit) =>
				this.Provider.Events().fetchCastEventsWithCursor<
					EventOnChain<{
						pool_id: ObjectId;
					}>,
					ObjectId
				>(
					{
						MoveEventType: EventsApiHelpers.createEventType(
							this.addresses.pools.packages.cmmm,
							"events",
							"CreatedPoolEvent"
						),
					},
					(eventOnChain) => eventOnChain.parsedJson.pool_id,
					cursor,
					limit
				)
		);

		return objectIds;
	};

	/////////////////////////////////////////////////////////////////////
	//// Dev Inspects
	/////////////////////////////////////////////////////////////////////

	public poolObjectIdForLpCoinTypeDevInspectTransaction = (
		lpCoinType: CoinType
	): TransactionBlock => {
		const tx = new TransactionBlock();

		tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.pools.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.poolRegistry,
				"lp_type_to_pool_id"
			),
			typeArguments: [lpCoinType],
			arguments: [tx.object(this.addresses.pools.objects.poolRegistry)],
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Creation
	/////////////////////////////////////////////////////////////////////

	public tradeTx = (inputs: {
		tx: TransactionBlock;
		poolId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		expectedAmountOut: Balance;
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
			expectedAmountOut,
			coinOutType,
			lpCoinType,
			slippage,
			withTransfer,
		} = inputs;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.pools.packages.cmmm,
				withTransfer
					? PoolsApiHelpers.constants.moduleNames.interface
					: PoolsApiHelpers.constants.moduleNames.swap,
				"swap_exact_in"
			),
			typeArguments: [lpCoinType, coinInType, coinOutType],
			arguments: [
				tx.object(poolId),
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
				tx.pure(expectedAmountOut.toString()),
				tx.pure(Pools.normalizeSlippage(slippage)),
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
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.pools.packages.cmmm,
				withTransfer
					? PoolsApiHelpers.constants.moduleNames.interface
					: PoolsApiHelpers.constants.moduleNames.deposit,
				`deposit_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				tx.object(poolId),
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
		coinsOutType: CoinType[];
		slippage: Slippage;
		withTransfer?: boolean;
	}): TransactionArgument => {
		const {
			tx,
			poolId,
			lpCoinId,
			expectedAmountsOut,
			coinsOutType,
			lpCoinType,
			slippage,
			withTransfer,
		} = inputs;

		const poolSize = coinsOutType.length;

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.pools.packages.cmmm,
				withTransfer
					? PoolsApiHelpers.constants.moduleNames.interface
					: PoolsApiHelpers.constants.moduleNames.withdraw,
				`withdraw_${poolSize}_coins`
			),

			typeArguments: [lpCoinType, ...coinsOutType],
			arguments: [
				tx.object(poolId),
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

	public publishLpCoinTx = (inputs: { tx: TransactionBlock }) => {
		const { tx } = inputs;

		const compiledModulesAndDeps = JSON.parse(
			`{"modules":["oRzrCwYAAAAJAQAGAgYIAw4LBBkCBRsQBytLCHZgCtYBBQzbAQ0AAgIGAQcAAAIAAgECAAAFAAEAAQMDAQECAQICCAAHCAEAAQgAAgkABwgBBUFGX0xQCVR4Q29udGV4dAVhZl9scA5jcmVhdGVfbHBfY29pbgtkdW1teV9maWVsZARpbml0CWludGVyZmFjZQp0eF9jb250ZXh0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAow71XMzftPi+9pR8EqdL/eYJsADkZRpZks5VH3k3OVaAAIBBAEAAAAAAQQLAAsBOAACAA=="],"dependencies":["0x8c3bd573337ed3e2fbda51f04a9d2ff79826c003919469664b39547de4dce55a","0x321a50c956db8b0b8fe53af2756e33212e18ea1a6ba82b9dd4308114b6944289","0x0000000000000000000000000000000000000000000000000000000000000001","0x5112fbe004d3f5f6e9f763e797ebe1c0ade0ec9e64857b05d7f6cd81047269e0","0x484d68333fe65c4910a5c708c9aa6469bfc59d343bc5ed898a18226ae422959f","0x0000000000000000000000000000000000000000000000000000000000000002","0x0000000000000000000000000000000000000000000000000000000000000003","0x373c265b27110d08e500ebb2a2e40aab08e1dd7d7f40eb878094ed260c4e5afa","0x8557c63b231fef86509fdde6855b032d346c50936cd335f53d4619222d7440fd"],"digest":[198,50,34,59,60,154,130,53,149,118,13,47,167,196,218,166,194,198,4,120,56,107,244,42,171,141,55,79,122,88,160,154]}`
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
	public fetchCreatePoolTx = async (inputs: {
		tx: TransactionBlock;
		lpCoinType: CoinType;
		coinsInfo: {
			coinId: ObjectId | TransactionArgument;
			coinType: CoinType;
			weight: PoolWeight;
			tradeFeeIn: PoolTradeFee;
			tradeFeeOut: PoolTradeFee;
			depositFee: PoolDepositFee;
			withdrawFee: PoolWithdrawFee;
		}[];
		lpCoinMetadata: PoolCreationLpCoinMetadata;
		createPoolCapId: ObjectId | TransactionArgument;
		poolName: PoolName;
		poolFlatness: PoolFlatness;
	}) => {
		const { tx, lpCoinType, createPoolCapId, coinsInfo, lpCoinMetadata } =
			inputs;
		const poolSize = coinsInfo.length;

		const coinTypes = coinsInfo.map((coin) => coin.coinType);

		const lpCoinDescription = await this.createLpCoinMetadataDescription({
			...inputs,
			coinTypes,
		});

		coinsInfo.sort((a, b) => {
			const coinA = a.coinType.toUpperCase();
			const coinB = b.coinType.toUpperCase();
			return coinA < coinB ? -1 : coinA > coinB ? 1 : 0;
		});

		return tx.add({
			kind: "MoveCall",
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.pools.packages.cmmm,
				PoolsApiHelpers.constants.moduleNames.interface,
				`create_pool_${poolSize}_coins`
			),
			typeArguments: [lpCoinType, ...coinTypes],
			arguments: [
				typeof createPoolCapId === "string"
					? tx.object(createPoolCapId)
					: createPoolCapId,
				tx.object(this.addresses.pools.objects.poolRegistry),
				tx.pure(Casting.u8VectorFromString(inputs.poolName)),
				tx.pure(Casting.u8VectorFromString(lpCoinMetadata.name)),
				tx.pure(
					Casting.u8VectorFromString(
						lpCoinMetadata.symbol.toUpperCase()
					)
				),
				tx.pure(Casting.u8VectorFromString(lpCoinDescription)),
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
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

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
			this.Provider.ReferralVault().Helpers.addUpdateReferrerCommandToTransaction(
				{
					tx,
					referrer,
				}
			);

		const amountOut = pool.getTradeAmountOut({
			coinInAmount,
			coinInType,
			coinOutType,
			referral: referrer !== undefined,
		});

		const coinInId =
			await this.Provider.Coin().Helpers.fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: coinInType,
				coinAmount: coinInAmount,
			});

		this.tradeTx({
			tx,
			coinInId,
			poolId: pool.pool.objectId,
			expectedAmountOut: amountOut,
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
			this.Provider.ReferralVault().Helpers.addUpdateReferrerCommandToTransaction(
				{
					tx,
					referrer,
				}
			);

		const { coins: coinTypes, balances: coinAmounts } =
			Coin.coinsAndBalancesOverZero(amountsIn);

		const { lpRatio } = pool.getDepositLpAmountOut({
			amountsIn,
			referral: referrer !== undefined,
		});

		// TODO: move this somewhere else and into its own func
		const expectedLpRatio = Casting.numberToFixedBigInt(lpRatio);

		const coinIds =
			await this.Provider.Coin().Helpers.fetchCoinsWithAmountTx({
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
			this.Provider.ReferralVault().Helpers.addUpdateReferrerCommandToTransaction(
				{
					tx,
					referrer,
				}
			);

		const lpRatio = pool.getWithdrawLpRatio({
			lpCoinAmountOut: lpCoinAmount,
		});

		const amountsOut = pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection,
			referral: referrer !== undefined,
		});

		const { coins: coinTypes, balances: coinAmounts } =
			Coin.coinsAndBalancesOverZero(amountsOut);

		const lpCoinId =
			await this.Provider.Coin().Helpers.fetchCoinWithAmountTx({
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
			coinsOutType: coinTypes,
			lpCoinId,
			slippage,
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
	}): Promise<TransactionBlock> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

		// TODO: make this fetching work

		// const createPoolCapId =
		// 	inputs.createPoolCapId !== undefined
		// 		? inputs.createPoolCapId
		// 		: (
		// 				await this.Provider.Objects().fetchObjectsOfTypeOwnedByAddress(
		// 					inputs.walletAddress,
		// 					`${this.addresses.pools.packages.cmmm}::${PoolsApiHelpers.constants.moduleNames.pool}::CreatePoolCap<${inputs.lpCoinType}>`
		// 				)
		// 		  )[0].data?.objectId;

		// if (createPoolCapId === undefined)
		// 	throw new Error(
		// 		"no CreatePoolCap for LP Coin Type found owned by address"
		// 	);

		const coinArgs =
			await this.Provider.Coin().Helpers.fetchCoinsWithAmountTx({
				tx,
				...inputs,
				coinTypes: inputs.coinsInfo.map((info) => info.coinType),
				coinAmounts: inputs.coinsInfo.map(
					(info) => info.initialDeposit
				),
			});

		await this.fetchCreatePoolTx({
			tx,
			...inputs,
			// createPoolCapId,
			coinsInfo: inputs.coinsInfo.map((info, index) => {
				return {
					...info,
					coinId: coinArgs[index],
				};
			}),
		});

		return tx;
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
			const price = prices[poolCoinType];

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
				const price = coinsToDecimalsAndPrices[cur].price;
				const amountInUsd =
					price < 0
						? 0
						: Coin.balanceWithDecimalsUsd(
								trade.amountsIn[index],
								coinsToDecimalsAndPrices[cur].decimals,
								price
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
			coin.split("::")[1].includes("af_lp") &&
			coin.split("::")[2].includes("AF_LP")
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Event Types
	/////////////////////////////////////////////////////////////////////

	private tradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.swap
		);

	private depositEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.deposit
		);

	private withdrawEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.pools.packages.cmmm,
			PoolsApiHelpers.constants.moduleNames.events,
			PoolsApiHelpers.constants.eventNames.withdraw
		);

	/////////////////////////////////////////////////////////////////////
	//// LP Coin Metadata
	/////////////////////////////////////////////////////////////////////

	private createLpCoinMetadataDescription = async (inputs: {
		poolName: PoolName;
		coinTypes: CoinType[];
	}) => {
		// TODO: do all of this a little bit cleaner
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
}

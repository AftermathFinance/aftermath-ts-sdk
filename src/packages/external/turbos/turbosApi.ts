import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { bcs } from "@mysten/sui.js/bcs";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	Balance,
	BigIntAsString,
	PoolsAddresses,
	ReferralVaultAddresses,
	TurbosAddresses,
	ObjectId,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import {
	TurbosCalcTradeResult,
	TurbosPartialPoolObject,
	TurbosPoolObject,
} from "./turbosTypes";
import { TypeNameOnChain } from "../../../general/types/castingTypes";
import { BCS } from "@mysten/bcs";
import { RouterAsyncApiInterface } from "../../router/utils/async/routerAsyncApiInterface";
import { SuiObjectResponse } from "@mysten/sui.js/client";
import { RouterPoolTradeTxInputs } from "../../router";
import { Sui } from "../../sui";

export class TurbosApi implements RouterAsyncApiInterface<TurbosPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			poolFetcher: "pool_fetcher",
			swapRouter: "swap_router",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		turbos: TurbosAddresses;
		referralVault: ReferralVaultAddresses;
		pools: PoolsAddresses;
	};

	private static MIN_TICK_INDEX = -443636;
	private static MAX_TICK_INDEX = 443636;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly Provider: AftermathApi) {
		const turbos = this.Provider.addresses.router?.turbos;
		const referralVault = this.Provider.addresses.referralVault;
		const pools = this.Provider.addresses.pools;

		if (!turbos || !referralVault || !pools)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			turbos,
			referralVault,
			pools,
		};
	}
	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<TurbosPoolObject[]> => {
		const poolsSimpleInfo =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.turbos.objects.poolsTable,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								TurbosApi.partialPoolFromSuiObjectResponse,
						}),
				}
			);

		const poolsMoreInfo =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: poolsSimpleInfo.map((poolInfo) => poolInfo.id),
				objectFromSuiObjectResponse: (data) => {
					const fields = Helpers.getObjectFields(data);
					if (!fields)
						throw new Error(
							"no fields found on turbos pool object"
						);

					const sqrtPrice = BigInt(fields.sqrt_price);
					const coinABalance = BigInt(fields.coin_a);
					const coinBBalance = BigInt(fields.coin_b);
					const isUnlocked = fields.unlocked as unknown as boolean;

					return {
						coinABalance,
						coinBBalance,
						isUnlocked,
						sqrtPrice,
					};
				},
			});

		const completePools = poolsSimpleInfo.map((info, index) => ({
			...info,
			...poolsMoreInfo[index],
		}));
		const usablePools = completePools.filter(
			(pool) =>
				pool.isUnlocked &&
				pool.coinABalance > BigInt(0) &&
				pool.coinBBalance > BigInt(0)
		);

		return usablePools;
	};

	public filterPoolsForTrade = (inputs: {
		pools: TurbosPoolObject[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): {
		partialMatchPools: TurbosPoolObject[];
		exactMatchPools: TurbosPoolObject[];
	} => {
		const possiblePools = inputs.pools
			.filter((pool) =>
				TurbosApi.isPoolForCoinType({
					pool,
					coinType: inputs.coinOutType,
				})
			)
			.sort((a, b) => {
				const coinType = inputs.coinOutType;

				const aPoolLiquidity = TurbosApi.isCoinA({ pool: a, coinType })
					? a.coinABalance
					: a.coinBBalance;
				const bPoolLiquidity = TurbosApi.isCoinA({ pool: b, coinType })
					? b.coinABalance
					: b.coinBBalance;

				return Number(bPoolLiquidity - aPoolLiquidity);
			});

		const [exactMatchPools, partialMatchPools] = Helpers.bifilter(
			possiblePools,
			(pool) =>
				TurbosApi.isPoolForCoinTypes({
					pool,
					coinType1: inputs.coinInType,
					coinType2: inputs.coinOutType,
				})
		);

		return {
			exactMatchPools,
			partialMatchPools,
		};
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public tradeCoinAToCoinBTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
			feeCoinType: CoinType;
		}
	) => {
		const { tx, coinInId, routerSwapCap, minAmountOut } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.turbos.packages.wrapper,
				TurbosApi.constants.moduleNames.wrapper,
				"swap_a_b"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(this.addresses.turbos.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_a
				tx.pure(minAmountOut.toString(), "u64"), // amount_threshold
				tx.pure(TurbosApi.calcSqrtPriceLimit(true).toString(), "u128"), // sqrt_price_limit
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),

				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
			],
		});
	};

	public tradeCoinBToCoinATx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
			feeCoinType: CoinType;
		}
	) => {
		const { tx, coinInId, routerSwapCap, minAmountOut } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.turbos.packages.wrapper,
				TurbosApi.constants.moduleNames.wrapper,
				"swap_b_a"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinOutType,
				inputs.coinInType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(this.addresses.turbos.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_b
				tx.pure(minAmountOut.toString(), "u64"), // amount_threshold
				tx.pure(TurbosApi.calcSqrtPriceLimit(false).toString(), "u128"), // sqrt_price_limit
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),

				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),
			],
		});
	};

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: TurbosPoolObject;
		}
	) => {
		const { coinInType, pool } = inputs;

		const commandInputs = {
			...inputs,
			...pool,
			poolObjectId: pool.id,
		};

		if (TurbosApi.isCoinA({ pool, coinType: coinInType }))
			return this.tradeCoinAToCoinBTx(commandInputs);

		return this.tradeCoinBToCoinATx(commandInputs);
	};

	// =========================================================================
	//  Transaction Inspection Commands
	// =========================================================================

	public calcTradeResultTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInType: CoinType;
		coinOutType: CoinType;
		feeCoinType: CoinType;
		coinTypeA: CoinType;
		coinTypeB: CoinType;
		coinInAmount: Balance;
		sqrtPrice: bigint;
	}) =>
		/*

			struct ComputeSwapState has copy, drop {
				amount_a: u128,
				amount_b: u128, 
				amount_specified_remaining: u128,
				amount_calculated: u128,
				sqrt_price: u128,
				tick_current_index: I32,
				fee_growth_global: u128,
				protocol_fee: u128,
				liquidity: u128,
				fee_amount: u128,
			}

		*/
		{
			const { tx } = inputs;

			const isCoinAToCoinB =
				Helpers.addLeadingZeroesToType(inputs.coinInType) ===
				Helpers.addLeadingZeroesToType(inputs.coinTypeA);

			return tx.moveCall({
				target: Helpers.transactions.createTxTarget(
					this.addresses.turbos.packages.clmm,
					TurbosApi.constants.moduleNames.poolFetcher,
					"compute_swap_result"
				),
				typeArguments: [
					inputs.coinTypeA,
					inputs.coinTypeB,
					inputs.feeCoinType,
				],
				arguments: [
					tx.object(inputs.poolObjectId),
					tx.pure(isCoinAToCoinB, "bool"), // a2b
					tx.pure(inputs.coinInAmount, "u128"), // amount_specified
					tx.pure(true, "bool"), // amount_specified_is_input
					tx.pure(
						TurbosApi.calcSqrtPriceLimit(isCoinAToCoinB).toString(),
						"u128"
					), // sqrt_price_limit
					tx.object(Sui.constants.addresses.suiClockId),
					tx.object(this.addresses.turbos.objects.versioned),
				],
			});
		};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchSupportedCoins = async () => {
		const pools = await this.fetchAllPools();

		const allCoins = pools.reduce(
			(acc, pool) => [...acc, pool.coinTypeA, pool.coinTypeB],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	public fetchTradeAmountOut = async (inputs: {
		pool: TurbosPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<Balance> => {
		const tradeResult = await this.fetchCalcTradeResult(inputs);
		return tradeResult.amountOut;
	};

	public otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: TurbosPoolObject;
	}) => {
		return TurbosApi.otherCoinInPool(inputs);
	};

	public fetchCalcTradeResult = async (inputs: {
		pool: TurbosPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<TurbosCalcTradeResult> => {
		const tx = new TransactionBlock();
		tx.setSender(Helpers.inspections.constants.devInspectSigner);

		this.calcTradeResultTx({
			tx,
			poolObjectId: inputs.pool.id,
			...inputs.pool,
			...inputs,
		});

		try {
			const resultBytes =
				await this.Provider.Inspections().fetchFirstBytesFromTxOutput(
					tx
				);

			bcs.registerStructType("I32", {
				bits: BCS.U32,
			});

			bcs.registerStructType("ComputeSwapState", {
				amount_a: BCS.U128,
				amount_b: BCS.U128,
				amount_specified_remaining: BCS.U128,
				amount_calculated: BCS.U128,
				sqrt_price: BCS.U128,
				tick_current_index: "I32",
				fee_growth_global: BCS.U128,
				protocol_fee: BCS.U128,
				liquidity: BCS.U128,
				fee_amount: BCS.U128,
			});

			const data = bcs.de(
				"ComputeSwapState",
				new Uint8Array(resultBytes)
			);

			const amountIn =
				BigInt(data.amount_a) <= BigInt(0)
					? BigInt(data.amount_b)
					: BigInt(data.amount_a);

			return {
				amountIn,
				amountOut: BigInt(data.amount_calculated),
				feeAmount: BigInt(data.fee_amount),
				protocolFee: BigInt(data.protocol_fee),
			};
		} catch (e) {
			throw new Error("e");
		}
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: TurbosPoolObject;
	}) => {
		return this.isCoinA(inputs)
			? inputs.pool.coinTypeB
			: inputs.pool.coinTypeA;
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Casting
	// =========================================================================

	private static partialPoolFromSuiObjectResponse = (
		data: SuiObjectResponse
	): TurbosPartialPoolObject => {
		const fields = Helpers.getObjectFields(data).value.fields as {
			pool_id: ObjectId;
			coin_type_a: TypeNameOnChain;
			coin_type_b: TypeNameOnChain;
			fee_type: TypeNameOnChain;
			fee: BigIntAsString;
			sqrt_price: BigIntAsString;
		};

		return {
			id: fields.pool_id,
			coinTypeA: Helpers.addLeadingZeroesToType(
				"0x" + fields.coin_type_a.fields.name
			),
			coinTypeB: Helpers.addLeadingZeroesToType(
				"0x" + fields.coin_type_b.fields.name
			),
			feeCoinType: Helpers.addLeadingZeroesToType(
				"0x" + fields.fee_type.fields.name
			),
			fee: BigInt(fields.fee),
		};
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static isPoolForCoinTypes = (inputs: {
		pool: TurbosPoolObject;
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const { pool, coinType1, coinType2 } = inputs;

		return (
			(pool.coinTypeA === Helpers.addLeadingZeroesToType(coinType1) &&
				pool.coinTypeB === Helpers.addLeadingZeroesToType(coinType2)) ||
			(pool.coinTypeA === Helpers.addLeadingZeroesToType(coinType2) &&
				pool.coinTypeB === Helpers.addLeadingZeroesToType(coinType1))
		);
	};

	private static isPoolForCoinType = (inputs: {
		pool: TurbosPoolObject;
		coinType: CoinType;
	}) => {
		const { pool, coinType } = inputs;

		return (
			pool.coinTypeA === Helpers.addLeadingZeroesToType(coinType) ||
			pool.coinTypeB === Helpers.addLeadingZeroesToType(coinType)
		);
	};

	private static isCoinA = (inputs: {
		pool: TurbosPoolObject;
		coinType: CoinType;
	}) => {
		const { coinType, pool } = inputs;
		return Helpers.addLeadingZeroesToType(coinType) === pool.coinTypeA;
	};

	// private static calcSqrtPriceLimit = (inputs: {
	// 	sqrtPrice: bigint;
	// 	isCoinAToCoinB: boolean;
	// }) => {
	// 	const { sqrtPrice, isCoinAToCoinB } = inputs;

	// 	const change = sqrtPrice / BigInt(100);
	// 	const sqrtPriceLimit = isCoinAToCoinB
	// 		? sqrtPrice - change
	// 		: sqrtPrice + change;

	// 	return sqrtPriceLimit;
	// };

	private static calcSqrtPriceLimit = (a2b: boolean) => {
		return this.tickIndexToSqrtPriceX64(
			a2b ? TurbosApi.MIN_TICK_INDEX : TurbosApi.MAX_TICK_INDEX
		);
	};

	private static tickIndexToSqrtPriceX64(tickIndex: number): bigint {
		if (tickIndex > 0) {
			return BigInt(this.tickIndexToSqrtPricePositive(tickIndex));
		} else {
			return BigInt(this.tickIndexToSqrtPriceNegative(tickIndex));
		}
	}

	private static tickIndexToSqrtPricePositive(tick: number) {
		let ratio: bigint;

		if ((tick & 1) != 0) {
			ratio = BigInt("79232123823359799118286999567");
		} else {
			ratio = BigInt("79228162514264337593543950336");
		}

		if ((tick & 2) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79236085330515764027303304731"),
				96,
				256
			);
		}
		if ((tick & 4) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79244008939048815603706035061"),
				96,
				256
			);
		}
		if ((tick & 8) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79259858533276714757314932305"),
				96,
				256
			);
		}
		if ((tick & 16) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79291567232598584799939703904"),
				96,
				256
			);
		}
		if ((tick & 32) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79355022692464371645785046466"),
				96,
				256
			);
		}
		if ((tick & 64) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79482085999252804386437311141"),
				96,
				256
			);
		}
		if ((tick & 128) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("79736823300114093921829183326"),
				96,
				256
			);
		}
		if ((tick & 256) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("80248749790819932309965073892"),
				96,
				256
			);
		}
		if ((tick & 512) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("81282483887344747381513967011"),
				96,
				256
			);
		}
		if ((tick & 1024) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("83390072131320151908154831281"),
				96,
				256
			);
		}
		if ((tick & 2048) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("87770609709833776024991924138"),
				96,
				256
			);
		}
		if ((tick & 4096) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("97234110755111693312479820773"),
				96,
				256
			);
		}
		if ((tick & 8192) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("119332217159966728226237229890"),
				96,
				256
			);
		}
		if ((tick & 16384) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("179736315981702064433883588727"),
				96,
				256
			);
		}
		if ((tick & 32768) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("407748233172238350107850275304"),
				96,
				256
			);
		}
		if ((tick & 65536) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("2098478828474011932436660412517"),
				96,
				256
			);
		}
		if ((tick & 131072) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("55581415166113811149459800483533"),
				96,
				256
			);
		}
		if ((tick & 262144) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("38992368544603139932233054999993551"),
				96,
				256
			);
		}

		return this.signedShiftRight(ratio, 32, 256);
	}

	private static tickIndexToSqrtPriceNegative(tickIndex: number) {
		let tick = Math.abs(tickIndex);
		let ratio: bigint;

		if ((tick & 1) != 0) {
			ratio = BigInt("18445821805675392311");
		} else {
			ratio = BigInt("18446744073709551616");
		}

		if ((tick & 2) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18444899583751176498"),
				64,
				256
			);
		}
		if ((tick & 4) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18443055278223354162"),
				64,
				256
			);
		}
		if ((tick & 8) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18439367220385604838"),
				64,
				256
			);
		}
		if ((tick & 16) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18431993317065449817"),
				64,
				256
			);
		}
		if ((tick & 32) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18417254355718160513"),
				64,
				256
			);
		}
		if ((tick & 64) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18387811781193591352"),
				64,
				256
			);
		}
		if ((tick & 128) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18329067761203520168"),
				64,
				256
			);
		}
		if ((tick & 256) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("18212142134806087854"),
				64,
				256
			);
		}
		if ((tick & 512) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("17980523815641551639"),
				64,
				256
			);
		}
		if ((tick & 1024) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("17526086738831147013"),
				64,
				256
			);
		}
		if ((tick & 2048) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("16651378430235024244"),
				64,
				256
			);
		}
		if ((tick & 4096) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("15030750278693429944"),
				64,
				256
			);
		}
		if ((tick & 8192) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("12247334978882834399"),
				64,
				256
			);
		}
		if ((tick & 16384) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("8131365268884726200"),
				64,
				256
			);
		}
		if ((tick & 32768) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("3584323654723342297"),
				64,
				256
			);
		}
		if ((tick & 65536) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("696457651847595233"),
				64,
				256
			);
		}
		if ((tick & 131072) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("26294789957452057"),
				64,
				256
			);
		}
		if ((tick & 262144) != 0) {
			ratio = this.signedShiftRight(
				ratio * BigInt("37481735321082"),
				64,
				256
			);
		}

		return ratio;
	}

	private static signedShiftLeft(
		n0: bigint,
		shiftBy: number,
		bitWidth: number
	) {
		// let twosN0 = n0.toTwos(bitWidth).shln(shiftBy);
		// twosN0.imaskn(bitWidth + 1);
		// return twosN0.fromTwos(bitWidth);

		return n0 << BigInt(shiftBy);
	}

	private static signedShiftRight(
		n0: bigint,
		shiftBy: number,
		bitWidth: number
	) {
		// let twoN0 = n0.toTwos(bitWidth).shrn(shiftBy);
		// twoN0.imaskn(bitWidth - shiftBy + 1);
		// return twoN0.fromTwos(bitWidth - shiftBy);

		return n0 >> BigInt(shiftBy);
	}
}

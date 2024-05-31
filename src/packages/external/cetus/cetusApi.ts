import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { Transaction } from "@mysten/sui/transactions";
import {
	CetusCalcTradeResult,
	CetusPoolObject,
	CetusPoolSimpleInfo,
} from "./cetusTypes";
import {
	AnyObjectType,
	Balance,
	CetusAddresses,
	ObjectId,
} from "../../../types";
import { Helpers } from "../../../general/utils";
import { TypeNameOnChain } from "../../../general/types/castingTypes";
import { RouterAsyncApiInterface } from "../../router/utils/async/routerAsyncApiInterface";
import { bcs } from "@mysten/sui/bcs";
import { SuiObjectResponse } from "@mysten/sui/client";
import { RouterPoolTradeTxInputs } from "../../router";
import { Sui } from "../../sui";

export class CetusApi implements RouterAsyncApiInterface<CetusPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			poolScript: "pool_script",
			pool: "pool",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: CetusAddresses;

	public readonly objectTypes: {
		pool: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const cetusAddresses = this.Provider.addresses.router?.cetus;

		if (!cetusAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = cetusAddresses;
		this.objectTypes = {
			pool: `${cetusAddresses.packages.clmm}::pool::Pool`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<CetusPoolObject[]> => {
		const uncastedPools = await this.Provider.indexerCaller.fetchIndexer<
			CetusPoolObject[]
		>("router/pools/cetus");

		return uncastedPools.map((pool) => ({
			coinABalance: BigInt(pool.coinABalance),
			coinBBalance: BigInt(pool.coinBBalance),
			coinTypeA: Helpers.addLeadingZeroesToType(pool.coinTypeA),
			coinTypeB: Helpers.addLeadingZeroesToType(pool.coinTypeB),
			isPaused: pool.isPaused,
			id: Helpers.addLeadingZeroesToType(pool.id),
		}));
	};

	public filterPoolsForTrade = (inputs: {
		pools: CetusPoolObject[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): {
		partialMatchPools: CetusPoolObject[];
		exactMatchPools: CetusPoolObject[];
	} => {
		const possiblePools = inputs.pools
			.filter((pool) =>
				CetusApi.isPoolForCoinType({
					pool,
					coinType: inputs.coinOutType,
				})
			)
			.sort((a, b) => {
				const coinType = inputs.coinOutType;

				const aPoolLiquidity = CetusApi.isCoinA({ pool: a, coinType })
					? a.coinABalance
					: a.coinBBalance;
				const bPoolLiquidity = CetusApi.isCoinA({ pool: b, coinType })
					? b.coinABalance
					: b.coinBBalance;

				return Number(bPoolLiquidity - aPoolLiquidity);
			});

		const [exactMatchPools, partialMatchPools] = Helpers.bifilter(
			possiblePools,
			(pool) =>
				CetusApi.isPoolForCoinTypes({
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
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}) => {
		const tradeResult = await this.fetchCalcTradeResult(inputs);
		return {
			coinOutAmount: tradeResult.amountOut,
			feeInAmount: tradeResult.feeAmount,
			feeOutAmount: BigInt(0),
		};
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchCalcTradeResult = async (inputs: {
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<CetusCalcTradeResult> => {
		const tx = new Transaction();
		tx.setSender(Helpers.inspections.constants.devInspectSigner);

		this.calcTradeResultTx({
			tx,
			poolObjectId: inputs.pool.id,
			...inputs.pool,
			...inputs,
		});

		const resultBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const SwapStepResult = bcs.struct("SwapStepResult", {
			current_sqrt_price: bcs.u128(),
			target_sqrt_price: bcs.u128(),
			current_liquidity: bcs.u128(),
			amount_in: bcs.u64(),
			amount_out: bcs.u64(),
			fee_amount: bcs.u64(),
			remainer_amount: bcs.u64(),
		});

		const CalculatedSwapResult = bcs.struct("CalculatedSwapResult", {
			amount_in: bcs.u64(),
			amount_out: bcs.u64(),
			fee_amount: bcs.u64(),
			fee_rate: bcs.u64(),
			after_sqrt_price: bcs.u128(),
			is_exceed: bcs.bool(),
			step_results: bcs.vector(SwapStepResult),
		});

		const data = CalculatedSwapResult.parse(new Uint8Array(resultBytes));

		return {
			amountIn: BigInt(data.amount_in),
			amountOut: BigInt(data.amount_out),
			feeAmount: BigInt(data.fee_amount),
			feeRate: BigInt(data.fee_rate),
		};
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public tradeCoinAToCoinBTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				CetusApi.constants.moduleNames.wrapper,
				"swap_a_to_b_by_a"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.objects.globalConfig),
				tx.object(inputs.poolObjectId), // pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_a
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public tradeCoinBToCoinATx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				CetusApi.constants.moduleNames.wrapper,
				"swap_b_to_a_by_b"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinOutType,
				inputs.coinInType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.objects.globalConfig),
				tx.object(inputs.poolObjectId), // pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_b
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: CetusPoolObject;
		}
	) => {
		const { coinInType, pool } = inputs;

		const commandInputs = {
			...inputs,
			poolObjectId: pool.id,
		};

		if (CetusApi.isCoinA({ pool, coinType: coinInType }))
			return this.tradeCoinAToCoinBTx(commandInputs);

		return this.tradeCoinBToCoinATx(commandInputs);
	};

	// =========================================================================
	//  Transaction Inspection Commands
	// =========================================================================

	public calcTradeResultTx = (
		inputs: {
			tx: Transaction;
			poolObjectId: ObjectId;
			coinInType: CoinType;
			coinOutType: CoinType;
			coinTypeA: CoinType;
			coinTypeB: CoinType;
		} & (
			| {
					coinInAmount: Balance;
			  }
			| {
					coinOutAmount: Balance;
			  }
		)
	) =>
		/*
			struct CalculatedSwapResult has copy, drop, store {
				amount_in: u64,
				amount_out: u64,
				fee_amount: u64,
				fee_rate: u64,
				after_sqrt_price: u128,
				is_exceed: bool,
				step_results: vector<SwapStepResult>
			}

			struct SwapStepResult has copy, drop, store {
				current_sqrt_price: u128,
				target_sqrt_price: u128,
				current_liquidity: u128,
				amount_in: u64,
				amount_out: u64,
				fee_amount: u64,
				remainer_amount: u64
			}
		*/
		{
			const { tx } = inputs;

			return tx.moveCall({
				target: Helpers.transactions.createTxTarget(
					this.addresses.packages.clmm,
					CetusApi.constants.moduleNames.pool,
					"calculate_swap_result"
				),
				typeArguments: [inputs.coinTypeA, inputs.coinTypeB],
				arguments: [
					tx.object(inputs.poolObjectId),
					tx.pure.bool(inputs.coinInType === inputs.coinTypeA), // a2b
					tx.pure.bool("coinInAmount" in inputs), // by_amount_in
					tx.pure.u64(
						"coinInAmount" in inputs
							? inputs.coinInAmount
							: inputs.coinOutAmount
					), // amount
				],
			});
		};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: CetusPoolObject;
	}) => {
		return CetusApi.isCoinA(inputs)
			? inputs.pool.coinTypeB
			: inputs.pool.coinTypeA;
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static isPoolForCoinTypes = (inputs: {
		pool: CetusPoolObject;
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
		pool: CetusPoolObject;
		coinType: CoinType;
	}) => {
		const { pool, coinType } = inputs;

		return (
			pool.coinTypeA === Helpers.addLeadingZeroesToType(coinType) ||
			pool.coinTypeB === Helpers.addLeadingZeroesToType(coinType)
		);
	};

	private static isCoinA = (inputs: {
		pool: CetusPoolObject;
		coinType: CoinType;
	}) => {
		const { coinType, pool } = inputs;
		return Helpers.addLeadingZeroesToType(coinType) === pool.coinTypeA;
	};
}

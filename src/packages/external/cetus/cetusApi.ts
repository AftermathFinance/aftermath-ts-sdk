import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import {
	ObjectId,
	SuiObjectResponse,
	TransactionBlock,
	bcs,
	getObjectFields,
} from "@mysten/sui.js";
import {
	CetusCalcTradeResult,
	CetusPoolObject,
	CetusPoolSimpleInfo,
} from "./cetusTypes";
import { AnyObjectType, Balance, CetusAddresses } from "../../../types";
import { Helpers } from "../../../general/utils";
import { RouterPoolTradeTxInputs, Sui } from "../..";
import { TypeNameOnChain } from "../../../general/types/castingTypes";
import { BCS } from "@mysten/bcs";
import { RouterAsyncApiInterface } from "../../router/utils/async/routerAsyncApiInterface";

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
		const poolsSimpleInfo =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.objects.poolsTable,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								CetusApi.poolSimpleInfoFromSuiObjectResponse,
						}),
				}
			);

		const poolsMoreInfo =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: poolsSimpleInfo.map((poolInfo) => poolInfo.id),
				objectFromSuiObjectResponse: (data) => {
					const fields = getObjectFields(data);
					if (!fields)
						throw new Error("no fields found on cetus pool object");

					const coinABalance = BigInt(fields.coin_a);
					const coinBBalance = BigInt(fields.coin_b);
					const isPaused = fields.is_pause as unknown as boolean;

					return {
						coinABalance,
						coinBBalance,
						isPaused,
					};
				},
			});

		const pools = poolsSimpleInfo.map((info, index) => ({
			...info,
			...poolsMoreInfo[index],
		}));

		const usablePools = pools.filter(
			(pool) =>
				!pool.isPaused &&
				pool.coinABalance > BigInt(0) &&
				pool.coinBBalance > BigInt(0)
		);

		return usablePools;
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
	}): Promise<Balance> => {
		const tradeResult = await this.fetchCalcTradeResult(inputs);
		return tradeResult.amountOut;
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
		const tx = new TransactionBlock();
		tx.setSender(Helpers.rpc.constants.devInspectSigner);

		this.calcTradeResultTx({
			tx,
			poolObjectId: inputs.pool.id,
			...inputs.pool,
			...inputs,
		});

		const resultBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput(tx);

		bcs.registerStructType("SwapStepResult", {
			current_sqrt_price: BCS.U128,
			target_sqrt_price: BCS.U128,
			current_liquidity: BCS.U128,
			amount_in: BCS.U64,
			amount_out: BCS.U64,
			fee_amount: BCS.U64,
			remainer_amount: BCS.U64,
		});

		bcs.registerStructType("CalculatedSwapResult", {
			amount_in: BCS.U64,
			amount_out: BCS.U64,
			fee_amount: BCS.U64,
			fee_rate: BCS.U64,
			after_sqrt_price: BCS.U128,
			is_exceed: BCS.BOOL,
			step_results: "vector<SwapStepResult>",
		});

		const data = bcs.de(
			"CalculatedSwapResult",
			new Uint8Array(resultBytes)
		);

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
			tx: TransactionBlock;
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
					tx.pure(inputs.coinInType === inputs.coinTypeA, "bool"), // a2b
					tx.pure("coinInAmount" in inputs, "bool"), // by_amount_in
					tx.pure(
						"coinInAmount" in inputs
							? inputs.coinInAmount
							: inputs.coinOutAmount,
						"u64"
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
	//  Casting
	// =========================================================================

	private static poolSimpleInfoFromSuiObjectResponse = (
		data: SuiObjectResponse
	): CetusPoolSimpleInfo => {
		const content = data.data?.content;
		if (content?.dataType !== "moveObject")
			throw new Error("sui object response is not an object");

		const fields = content.fields.value.fields.value.fields as {
			coin_type_a: TypeNameOnChain;
			coin_type_b: TypeNameOnChain;
			pool_id: ObjectId;
		};

		return {
			coinTypeA: "0x" + fields.coin_type_a.fields.name,
			coinTypeB: "0x" + fields.coin_type_b.fields.name,
			id: fields.pool_id,
		};
	};

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

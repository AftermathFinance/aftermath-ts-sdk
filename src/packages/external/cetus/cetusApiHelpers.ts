import {
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	TransactionArgument,
	TransactionBlock,
	bcs,
	getObjectFields,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	BigIntAsString,
	CetusAddresses,
	CoinType,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { Sui } from "../../sui";
import { CetusCalcTradeResult, CetusPoolObject } from "./cetusTypes";
import { Helpers } from "../../../general/utils";
import { BCS } from "@mysten/bcs";
import { TypeNameOnChain } from "../../../general/types/castingTypes";
import { CetusApi } from "./cetusApi";

export class CetusApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			poolScript: "pool_script",
			pool: "pool",
		},
		inputs: {
			minSqrtPriceLimit: BigInt("4295048016"),
			maxSqrtPriceLimit: BigInt("79226673515401279992447579055"),
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		cetus: CetusAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	public readonly objectTypes: {
		pool: AnyObjectType;
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const cetus = this.Provider.addresses.externalRouter?.cetus;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!cetus || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = {
			cetus,
			pools,
			referralVault,
		};

		this.objectTypes = {
			pool: `${cetus.packages.clmm}::pool::Pool`,
		};
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchAllPools = async () => {
		const poolsSimpleInfo =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				this.addresses.cetus.objects.poolsTable,
				(objectIds) =>
					this.Provider.Objects().fetchCastObjectBatch(
						objectIds,
						CetusApiHelpers.poolFromSuiObjectResponse
					),
				() => true
			);

		const poolsMoreInfo =
			await this.Provider.Objects().fetchCastObjectBatch(
				poolsSimpleInfo.map((poolInfo) => poolInfo.id),
				(data) => {
					const fields = getObjectFields(data);
					if (!fields)
						throw new Error("no fields found on cetus pool object");

					const liquidity = BigInt(fields.liquidity);
					const isPaused = fields.is_pause as unknown as boolean;

					return {
						liquidity,
						isPaused,
					};
				}
			);

		const usablePools = poolsSimpleInfo.filter(
			(_, index) =>
				!poolsMoreInfo[index].isPaused &&
				poolsMoreInfo[index].liquidity > BigInt(0)
		);

		return usablePools;
	};

	public fetchPoolsForTrade = async (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<{
		partialMatchPools: CetusPoolObject[];
		exactMatchPools: CetusPoolObject[];
	}> => {
		const possiblePools = await this.fetchPoolsForCoinType({
			coinType: inputs.coinOutType,
		});

		const [exactMatchPools, partialMatchPools] = Helpers.bifilter(
			possiblePools,
			(pool) =>
				CetusApiHelpers.isPoolForCoinTypes({
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

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public tradeCoinAToCoinBTx = (
		inputs: {
			tx: TransactionBlock;
			poolObjectId: ObjectId;
			coinInId: ObjectId | TransactionArgument;
			coinInType: CoinType;
			coinOutType: CoinType;
		} & (
			| {
					coinInAmount: Balance;
			  }
			| {
					coinOutAmount: Balance;
			  }
		)
	) => {
		const { tx, coinInId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.cetus.packages.scripts,
				CetusApiHelpers.constants.moduleNames.poolScript,
				"swap_a2b"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(this.addresses.cetus.objects.globalConfig),
				tx.object(inputs.poolObjectId),
				tx.makeMoveVec({
					objects: [
						typeof coinInId === "string"
							? tx.object(coinInId)
							: coinInId,
					],
				}),
				tx.pure("coinInAmount" in inputs, "bool"), // by_amount_in
				tx.pure(
					"coinInAmount" in inputs
						? inputs.coinInAmount
						: inputs.coinOutAmount,
					"u64"
				), // amount
				tx.pure(
					// "coinInAmount" in inputs
					// 	? inputs.coinInAmount
					// 	: inputs.coinOutAmount,
					"0",
					"u64"
				), // amount_limit
				tx.pure(
					CetusApiHelpers.constants.inputs.minSqrtPriceLimit,
					"u128"
				), // sqrt_price_limit
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public tradeCoinBToCoinATx = (
		inputs: {
			tx: TransactionBlock;
			poolObjectId: ObjectId;
			coinInId: ObjectId | TransactionArgument;
			coinInType: CoinType;
			coinOutType: CoinType;
		} & (
			| {
					coinInAmount: Balance;
			  }
			| {
					coinOutAmount: Balance;
			  }
		)
	) => {
		const { tx, coinInId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.cetus.packages.scripts,
				CetusApiHelpers.constants.moduleNames.poolScript,
				"swap_b2a"
			),
			typeArguments: [inputs.coinOutType, inputs.coinInType],
			arguments: [
				tx.object(this.addresses.cetus.objects.globalConfig),
				tx.object(inputs.poolObjectId),
				tx.makeMoveVec({
					objects: [
						typeof coinInId === "string"
							? tx.object(coinInId)
							: coinInId,
					],
				}),
				tx.pure("coinInAmount" in inputs, "bool"), // by_amount_in
				tx.pure(
					"coinInAmount" in inputs
						? inputs.coinInAmount
						: inputs.coinOutAmount,
					"u64"
				), // amount
				tx.pure(
					// "coinInAmount" in inputs
					// 	? inputs.coinInAmount
					// 	: inputs.coinOutAmount,
					"0",
					"u64"
				), // amount_limit
				tx.pure(
					CetusApiHelpers.constants.inputs.maxSqrtPriceLimit,
					"u128"
				), // sqrt_price_limit
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public tradeTx = (
		inputs: {
			tx: TransactionBlock;
			pool: CetusPoolObject;
			coinInId: ObjectId | TransactionArgument;
			coinInType: CoinType;
			coinOutType: CoinType;
		} & (
			| {
					coinInAmount: Balance;
			  }
			| {
					coinOutAmount: Balance;
			  }
		)
	) => {
		const { coinInType, pool } = inputs;

		const commandInputs = {
			...inputs,
			poolObjectId: pool.id,
		};

		if (CetusApiHelpers.isCoinA({ pool, coinType: coinInType }))
			return this.tradeCoinAToCoinBTx(commandInputs);

		return this.tradeCoinBToCoinATx(commandInputs);
	};

	public flashTradeTx = (
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
	) /* (Coin<CoinTypeA>, Coin<CoinTypeB>, FlashSwapReceipt<CoinTypeA, CoinTypeB>) */ => {
		const { tx } = inputs;

		const isCoinAToCoinB = inputs.coinInType === inputs.coinTypeA;
		const sqrtPriceLimit = isCoinAToCoinB
			? CetusApiHelpers.constants.inputs.minSqrtPriceLimit
			: CetusApiHelpers.constants.inputs.maxSqrtPriceLimit;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.cetus.packages.clmm,
				CetusApiHelpers.constants.moduleNames.pool,
				"flash_swap"
			),
			typeArguments: [inputs.coinTypeA, inputs.coinTypeB],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.pure(isCoinAToCoinB, "bool"), // a2b
				tx.pure("coinInAmount" in inputs, "bool"), // by_amount_in
				tx.pure(
					"coinInAmount" in inputs
						? inputs.coinInAmount
						: inputs.coinOutAmount,
					"u64"
				), // amount
				tx.pure(sqrtPriceLimit, "u128"), // sqrt_price_limit
			],
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Inspection Commands
	/////////////////////////////////////////////////////////////////////

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
		
			The calculated swap result:
			
			struct CalculatedSwapResult has copy, drop, store {
				amount_in: u64,
				amount_out: u64,
				fee_amount: u64,
				fee_rate: u64,
				after_sqrt_price: u128,
				is_exceed: bool,
				step_results: vector<SwapStepResult>
			}

			The step swap result:

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
				target: Helpers.transactions.createTransactionTarget(
					this.addresses.cetus.packages.clmm,
					CetusApiHelpers.constants.moduleNames.pool,
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

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildTradeTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<TransactionBlock> => {
		const { walletAddress, coinInType, coinInAmount } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const coinInId =
			await this.Provider.Coin().Helpers.fetchCoinWithAmountTx({
				tx,
				walletAddress,
				coinType: coinInType,
				coinAmount: coinInAmount,
			});

		this.tradeTx({
			tx,
			...inputs,
			coinInId,
		});

		return tx;
	};

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCalcTradeResult = async (inputs: {
		walletAddress: SuiAddress;
		pool: CetusPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<CetusCalcTradeResult> => {
		const tx = new TransactionBlock();
		tx.setSender(inputs.walletAddress);

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

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: CetusPoolObject;
	}) => {
		return this.isCoinA(inputs)
			? inputs.pool.coinTypeB
			: inputs.pool.coinTypeA;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	private fetchPoolForCoinTypes = async (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const allPools = await this.fetchAllPools();

		// NOTE: will there ever be more than 1 valid pool (is this unsafe ?)
		const foundPool = allPools.find((pool) =>
			CetusApiHelpers.isPoolForCoinTypes({
				pool,
				...inputs,
			})
		);

		if (!foundPool)
			throw new Error("no cetus pools found for given coin types");

		return foundPool;
	};

	private fetchPoolsForCoinType = async (inputs: { coinType: CoinType }) => {
		const allPools = await this.fetchAllPools();

		const foundPools = allPools.filter((pool) =>
			CetusApiHelpers.isPoolForCoinType({
				pool,
				...inputs,
			})
		);

		return foundPools;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	private static poolFromSuiObjectResponse = (
		data: SuiObjectResponse
	): CetusPoolObject => {
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

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

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

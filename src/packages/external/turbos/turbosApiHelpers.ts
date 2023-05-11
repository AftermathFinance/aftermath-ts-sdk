import {
	ObjectId,
	SuiAddress,
	SuiObjectResponse,
	TransactionArgument,
	TransactionBlock,
	bcs,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	Balance,
	TurbosAddresses,
	CoinType,
	PoolsAddresses,
	ReferralVaultAddresses,
	BigIntAsString,
} from "../../../types";
import { Sui } from "../../sui";
import { Casting, Helpers } from "../../../general/utils";
import { BCS } from "@mysten/bcs";
import { TurbosCalcTradeResult, TurbosPoolObject } from "./turbosTypes";
import { TypeNameOnChain } from "../../../general/types/castingTypes";

export class TurbosApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			poolFetcher: "pool_fetcher",
			swapRouter: "swap_router",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly addresses: {
		turbos: TurbosAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	// public readonly objectTypes: {
	// 	pool: AnyObjectType;
	// };

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly Provider: AftermathApi) {
		const turbos = this.Provider.addresses.externalRouter?.turbos;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!turbos || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.Provider = Provider;
		this.addresses = {
			turbos,
			pools,
			referralVault,
		};

		// this.objectTypes = {
		// 	pool: `${turbos.packages.clmm}::pool::Pool`,
		// };
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
				this.addresses.turbos.objects.poolsTable,
				(objectIds) =>
					this.Provider.Objects().fetchCastObjectBatch(
						objectIds,
						TurbosApiHelpers.poolFromSuiObjectResponse
					),
				() => true
			);

		return poolsSimpleInfo;
	};

	public fetchPoolForCoinTypes = async (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const allPools = await this.fetchAllPools();

		// NOTE: will there ever be more than 1 valid pool (is this unsafe ?)
		const foundPool = allPools.find((pool) =>
			TurbosApiHelpers.isPoolForCoinTypes({
				pool,
				...inputs,
			})
		);

		if (!foundPool)
			throw new Error("no turbos pools found for given coin types");

		return foundPool;
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Commands
	/////////////////////////////////////////////////////////////////////

	public tradeCoinAToCoinBTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		feeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { tx, coinInId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.turbos.packages.poolFetcher,
				TurbosApiHelpers.constants.moduleNames.swapRouter,
				"swap_a_b"
			),
			typeArguments: [
				inputs.coinInType,
				inputs.coinOutType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.makeMoveVec({
					objects: [
						typeof coinInId === "string"
							? tx.object(coinInId)
							: coinInId,
					],
				}), // coins_a
				tx.pure(inputs.coinInAmount, "u64"), // amount
				tx.pure(inputs.coinInAmount, "u64"), // amount_threshold
				tx.pure("0", "u128"), // sqrt_price_limit
				tx.pure(true, "u128"), // is_exact_in
				tx.pure(inputs.walletAddress, "address"), // recipient
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // deadline
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),
			],
		});
	};

	public tradeCoinBToCoinATx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		feeCoinType: CoinType;
		walletAddress: SuiAddress;
	}) => {
		const { tx, coinInId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.turbos.packages.poolFetcher,
				TurbosApiHelpers.constants.moduleNames.swapRouter,
				"swap_b2a"
			),
			typeArguments: [
				inputs.coinInType,
				inputs.coinOutType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(inputs.poolObjectId),
				tx.makeMoveVec({
					objects: [
						typeof coinInId === "string"
							? tx.object(coinInId)
							: coinInId,
					],
				}), // coins_a
				tx.pure(inputs.coinInAmount, "u64"), // amount
				tx.pure(inputs.coinInAmount, "u64"), // amount_threshold
				tx.pure("0", "u128"), // sqrt_price_limit
				tx.pure(true, "u128"), // is_exact_in
				tx.pure(inputs.walletAddress, "address"), // recipient
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // deadline
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),
			],
		});
	};

	public tradeTx = (inputs: {
		tx: TransactionBlock;
		pool: TurbosPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		walletAddress: SuiAddress;
	}) => {
		const { coinInType, pool } = inputs;

		const commandInputs = {
			...inputs,
			poolObjectId: pool.id,
			feeCoinType: pool.feeCoinType,
		};

		if (TurbosApiHelpers.isCoinA(coinInType, pool))
			return this.tradeCoinAToCoinBTx(commandInputs);

		return this.tradeCoinBToCoinATx(commandInputs);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Inspection Commands
	/////////////////////////////////////////////////////////////////////

	public calcTradeResultTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInType: CoinType;
		coinOutType: CoinType;
		feeCoinType: CoinType;
		coinTypeA: CoinType;
		coinTypeB: CoinType;
		coinInAmount: Balance;
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

			return tx.moveCall({
				target: Helpers.transactions.createTransactionTarget(
					this.addresses.turbos.packages.poolFetcher,
					TurbosApiHelpers.constants.moduleNames.poolFetcher,
					"compute_swap_result"
				),
				typeArguments: [
					inputs.coinTypeA,
					inputs.coinTypeB,
					inputs.feeCoinType,
				],
				arguments: [
					tx.object(inputs.poolObjectId),
					tx.pure(inputs.coinInType === inputs.coinTypeA, "bool"), // a2b
					tx.pure(inputs.coinInAmount, "u128"), // amount_specified
					// tx.pure("coinInAmount" in inputs, "bool"), // amount_specified_is_input
					tx.pure(true, "bool"), // amount_specified_is_input
					tx.pure("0", "u128"), // sqrt_price_limit
					tx.object(Sui.constants.addresses.suiClockId),
				],
			});
		};

	/////////////////////////////////////////////////////////////////////
	//// Transaction Builders
	/////////////////////////////////////////////////////////////////////

	public fetchBuildTradeTx = async (inputs: {
		walletAddress: SuiAddress;
		pool: TurbosPoolObject;
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
		pool: TurbosPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<TurbosCalcTradeResult> => {
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

		const data = bcs.de("ComputeSwapState", new Uint8Array(resultBytes));

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
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	private static poolFromSuiObjectResponse = (
		data: SuiObjectResponse
	): TurbosPoolObject => {
		const content = data.data?.content;
		if (content?.dataType !== "moveObject")
			throw new Error("sui object response is not an object");

		const fields = content.fields.value.fields.value.fields as {
			pool_id: ObjectId;
			coin_type_a: TypeNameOnChain;
			coin_type_b: TypeNameOnChain;
			fee_type: TypeNameOnChain;
			fee: BigIntAsString;
		};

		return {
			id: fields.pool_id,
			coinTypeA: "0x" + fields.coin_type_a.fields.name,
			coinTypeB: "0x" + fields.coin_type_b.fields.name,
			feeCoinType: "0x" + fields.fee_type.fields.name,
			fee: BigInt(fields.fee),
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static isPoolForCoinTypes = (inputs: {
		pool: TurbosPoolObject;
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const { pool, coinType1, coinType2 } = inputs;

		return (
			(pool.coinTypeA === coinType1 && pool.coinTypeB === coinType2) ||
			(pool.coinTypeA === coinType2 && pool.coinTypeB === coinType1)
		);
	};

	private static isCoinA = (coin: CoinType, pool: TurbosPoolObject) =>
		coin === pool.coinTypeA;
}

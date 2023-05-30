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
	Balance,
	TurbosAddresses,
	CoinType,
	PoolsAddresses,
	ReferralVaultAddresses,
	BigIntAsString,
	RouterExternalFee,
} from "../../../types";
import { Sui } from "../../sui";
import { Casting, Helpers } from "../../../general/utils";
import { BCS } from "@mysten/bcs";
import { TurbosCalcTradeResult, TurbosPoolObject } from "./turbosTypes";
import { TypeNameOnChain } from "../../../general/types/castingTypes";
import { TransactionsApiHelpers } from "../../../general/api/transactionsApiHelpers";

export class TurbosApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			poolFetcher: "pool_fetcher",
			swapRouter: "swap_router",
			wrapper: "turbos",
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
		const turbos = this.Provider.addresses.router?.turbos;
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

	public fetchAllPools = async (): Promise<TurbosPoolObject[]> => {
		const poolsSimpleInfo =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.turbos.objects.poolsTable,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								TurbosApiHelpers.partialPoolFromSuiObjectResponse,
						}),
				}
			);

		const poolsMoreInfo =
			await this.Provider.Objects().fetchCastObjectBatch({
				objectIds: poolsSimpleInfo.map((poolInfo) => poolInfo.id),
				objectFromSuiObjectResponse: (data) => {
					const fields = getObjectFields(data);
					if (!fields)
						throw new Error(
							"no fields found on turbos pool object"
						);

					const sqrtPrice = BigInt(fields.sqrt_price);
					const liquidity = BigInt(fields.liquidity);
					const isUnlocked = fields.unlocked as unknown as boolean;

					return {
						liquidity,
						isUnlocked,
						sqrtPrice,
					};
				},
			});

		const completePools = poolsSimpleInfo.map((info, index) => {
			return {
				...info,
				sqrtPrice: poolsMoreInfo[index].sqrtPrice,
			};
		});

		const usablePools = completePools.filter(
			(_, index) =>
				poolsMoreInfo[index].isUnlocked &&
				poolsMoreInfo[index].liquidity > BigInt(0)
		);

		return usablePools;
	};

	public fetchPoolsForTrade = async (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}): Promise<{
		partialMatchPools: TurbosPoolObject[];
		exactMatchPools: TurbosPoolObject[];
	}> => {
		const possiblePools = await this.fetchPoolsForCoinType({
			coinType: inputs.coinOutType,
		});

		const [exactMatchPools, partialMatchPools] = Helpers.bifilter(
			possiblePools,
			(pool) =>
				TurbosApiHelpers.isPoolForCoinTypes({
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

	public tradeCoinAToCoinBTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		feeCoinType: CoinType;
		walletAddress: SuiAddress;
		sqrtPrice: bigint;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		expectedCoinOutAmount: Balance;
		externalFee?: RouterExternalFee;
	}) => {
		const {
			tx,
			coinInId,
			externalFee,
			tradePotato,
			isFirstSwapForPath,
			expectedCoinOutAmount,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.turbos.packages.wrapper,
				TurbosApiHelpers.constants.moduleNames.wrapper,
				"swap_a_b"
			),
			typeArguments: [
				inputs.coinInType,
				inputs.coinOutType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(inputs.poolObjectId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_a
				tx.pure(Casting.zeroBigInt.toString(), "u64"), // amount_threshold
				tx.pure(
					TurbosApiHelpers.calcSqrtPriceLimit({
						...inputs,
						isCoinAToCoinB: true,
					}).toString(),
					"u128"
				), // sqrt_price_limit
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // deadline
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),

				// router fees
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee
							? Casting.numberToFixedBigInt(
									externalFee.feePercentage
							  )
							: undefined
					),
					"Option<u64>"
				), // router_fee
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee?.recipient
					),
					"Option<address>"
				), // router_fee_recipient

				// potato
				tradePotato,
				tx.pure(isFirstSwapForPath, "bool"),
				tx.pure(expectedCoinOutAmount, "u64"),
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
		sqrtPrice: bigint;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		expectedCoinOutAmount: Balance;
		externalFee?: RouterExternalFee;
	}) => {
		const {
			tx,
			coinInId,
			externalFee,
			tradePotato,
			isFirstSwapForPath,
			expectedCoinOutAmount,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTransactionTarget(
				this.addresses.turbos.packages.wrapper,
				TurbosApiHelpers.constants.moduleNames.wrapper,
				"swap_b_a"
			),
			typeArguments: [
				inputs.coinOutType,
				inputs.coinInType,
				inputs.feeCoinType,
			],
			arguments: [
				tx.object(inputs.poolObjectId),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // coin_b
				tx.pure(Casting.zeroBigInt.toString(), "u64"), // amount_threshold
				tx.pure(
					TurbosApiHelpers.calcSqrtPriceLimit({
						...inputs,
						isCoinAToCoinB: false,
					}).toString(),
					"u128"
				), // sqrt_price_limit
				tx.pure(Casting.u64MaxBigInt.toString(), "u64"), // deadline
				tx.object(Sui.constants.addresses.suiClockId),
				tx.object(this.addresses.turbos.objects.versioned),

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),

				// router fees
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee
							? Casting.numberToFixedBigInt(
									externalFee.feePercentage
							  )
							: undefined
					),
					"Option<u64>"
				), // router_fee
				tx.pure(
					TransactionsApiHelpers.createOptionObject(
						externalFee?.recipient
					),
					"Option<address>"
				), // router_fee_recipient

				// potato
				tradePotato,
				tx.pure(isFirstSwapForPath, "bool"),
				tx.pure(expectedCoinOutAmount, "u64"),
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
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		expectedCoinOutAmount: Balance;
		externalFee?: RouterExternalFee;
	}) => {
		const { coinInType, pool } = inputs;

		const commandInputs = {
			...inputs,
			...pool,
			poolObjectId: pool.id,
		};

		if (TurbosApiHelpers.isCoinA({ pool, coinType: coinInType }))
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
				target: Helpers.transactions.createTransactionTarget(
					this.addresses.turbos.packages.clmm,
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
					tx.pure(isCoinAToCoinB, "bool"), // a2b
					tx.pure(inputs.coinInAmount, "u128"), // amount_specified
					tx.pure(true, "bool"), // amount_specified_is_input
					tx.pure(
						TurbosApiHelpers.calcSqrtPriceLimit({
							...inputs,
							isCoinAToCoinB,
						}).toString(),
						"u128"
					), // sqrt_price_limit
					tx.object(Sui.constants.addresses.suiClockId),
					tx.object(this.addresses.turbos.objects.versioned),
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
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		expectedCoinOutAmount: Balance;
	}): Promise<TransactionBlock> => {
		const { walletAddress, coinInType, coinInAmount } = inputs;

		const tx = new TransactionBlock();
		tx.setSender(walletAddress);

		const coinInId = await this.Provider.Coin().fetchCoinWithAmountTx({
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

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: TurbosPoolObject;
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
			TurbosApiHelpers.isPoolForCoinTypes({
				pool,
				...inputs,
			})
		);

		if (!foundPool)
			throw new Error("no turbos pools found for given coin types");

		return foundPool;
	};

	private fetchPoolsForCoinType = async (inputs: { coinType: CoinType }) => {
		const allPools = await this.fetchAllPools();

		const foundPools = allPools.filter((pool) =>
			TurbosApiHelpers.isPoolForCoinType({
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

	private static partialPoolFromSuiObjectResponse = (
		data: SuiObjectResponse
	): Omit<TurbosPoolObject, "sqrtPrice"> => {
		const content = data.data?.content;
		if (content?.dataType !== "moveObject")
			throw new Error("sui object response is not an object");

		const fields = content.fields.value.fields as {
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

	private static calcSqrtPriceLimit = (inputs: {
		sqrtPrice: bigint;
		isCoinAToCoinB: boolean;
	}) => {
		const { sqrtPrice, isCoinAToCoinB } = inputs;

		const change = sqrtPrice / BigInt(100);
		const sqrtPriceLimit = isCoinAToCoinB
			? sqrtPrice - change
			: sqrtPrice + change;

		return sqrtPriceLimit;
	};
}

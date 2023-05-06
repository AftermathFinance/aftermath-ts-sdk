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
	AnyObjectType,
	Balance,
	CetusAddresses,
	CoinType,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { Sui } from "../../sui";
import { CetusPoolSimpleInfo } from "./cetusTypes";
import { Helpers } from "../../../general/utils";

export class CetusApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			poolScript: "pool_script",
			pool: "pool",
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

		return poolsSimpleInfo;
	};

	public fetchPoolForCoinTypes = async (inputs: {
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
					"coinInAmount" in inputs
						? inputs.coinInAmount
						: inputs.coinOutAmount,
					"u64"
				), // amount_limit
				tx.pure(BigInt("79226673515401279992447579055"), "u128"), // sqrt_price_limit (set to max_sqrt_price)
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
					"coinInAmount" in inputs
						? inputs.coinInAmount
						: inputs.coinOutAmount,
					"u64"
				), // amount_limit
				tx.pure(BigInt("4295048016"), "u128"), // sqrt_price_limit (set to min_sqrt_price)
				tx.object(Sui.constants.addresses.suiClockId),
			],
		});
	};

	public tradeTx = (
		inputs: {
			tx: TransactionBlock;
			pool: CetusPoolSimpleInfo;
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
			poolObjectId: pool.poolObjectId,
		};

		if (CetusApiHelpers.isCoinA(coinInType, pool))
			return this.tradeCoinAToCoinBTx(commandInputs);

		return this.tradeCoinBToCoinATx(commandInputs);
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
		pool: CetusPoolSimpleInfo;
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
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	private static poolFromSuiObjectResponse = (
		data: SuiObjectResponse
	): CetusPoolSimpleInfo => {
		const content = data.data?.content;
		if (content?.dataType !== "moveObject")
			throw new Error("sui object response is not an object");

		const fields = content.fields.value.fields.value.fields as {
			coin_type_a: {
				fields: {
					name: CoinType;
				};
			};
			coin_type_b: {
				fields: {
					name: CoinType;
				};
			};
			pool_id: ObjectId;
			pool_key: ObjectId;
		};

		return {
			coinTypeA: "0x" + fields.coin_type_a.fields.name,
			coinTypeB: "0x" + fields.coin_type_b.fields.name,
			poolObjectId: fields.pool_id,
			poolKeyId: fields.pool_key,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private static isPoolForCoinTypes = (inputs: {
		pool: CetusPoolSimpleInfo;
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const { pool, coinType1, coinType2 } = inputs;

		return (
			(pool.coinTypeA === coinType1 && pool.coinTypeB === coinType2) ||
			(pool.coinTypeA === coinType2 && pool.coinTypeB === coinType1)
		);
	};

	private static isCoinA = (coin: CoinType, pool: CetusPoolSimpleInfo) =>
		coin === pool.coinTypeA;
}

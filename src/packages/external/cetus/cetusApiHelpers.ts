import {
	ObjectId,
	TransactionArgument,
	TransactionBlock,
	bcs,
} from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	AnyObjectType,
	Balance,
	Byte,
	CetusAddresses,
	CoinType,
	DeepBookAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { Sui } from "../../sui";
import { EventOnChain } from "../../../general/types/castingTypes";
import { EventsApiHelpers } from "../../../general/api/eventsApiHelpers";
import { Coin } from "../../coin";
import { Casting, Helpers } from "../../../general/utils";

export class CetusApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		moduleNames: {
			pool: "pool_script",
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

	public fetchPoolForTypes = async (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const poolType1 = this.createCompletePoolObjectType(inputs);
		const poolType2 = this.createCompletePoolObjectType({
			coinType1: inputs.coinType2,
			coinType2: inputs.coinType1,
		});

		const foundPools =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType(
				this.addresses.cetus.objects.poolsTable,
				(type) => true // type === poolType1 || type === poolType2
			);

		console.log("foundPools", foundPools);

		if (foundPools.length <= 0)
			throw new Error("no cetus pools found for given coin types");

		// NOTE: will there ever be more than 1 valid pool ?
		return foundPools[0];
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.cetus.packages.scripts,
				CetusApiHelpers.constants.moduleNames.pool,
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
					type: `Coin<${inputs.coinInType}>`,
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
			target: AftermathApi.helpers.transactions.createTransactionTarget(
				this.addresses.cetus.packages.scripts,
				CetusApiHelpers.constants.moduleNames.pool,
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
					type: `Coin<${inputs.coinInType}>`,
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

	/////////////////////////////////////////////////////////////////////
	//// Transaction Inspection Commands
	/////////////////////////////////////////////////////////////////////

	public calcTradeResultTx = (
		inputs: {
			tx: TransactionBlock;
			poolObjectId: ObjectId;
			coinInType: CoinType;
			coinOutType: CoinType;
			coinAType: CoinType;
			coinBType: CoinType;
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
				target: AftermathApi.helpers.transactions.createTransactionTarget(
					this.addresses.cetus.packages.scripts,
					CetusApiHelpers.constants.moduleNames.pool,
					"calculate_swap_result"
				),
				typeArguments: [inputs.coinAType, inputs.coinBType],
				arguments: [
					tx.object(inputs.poolObjectId),
					tx.pure(inputs.coinInType === inputs.coinAType, "bool"), // a2b
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
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	private createCompletePoolObjectType = (inputs: {
		coinType1: CoinType;
		coinType2: CoinType;
	}) => `${this.objectTypes.pool}<${inputs.coinType1}, ${inputs.coinType2}>`;

	/////////////////////////////////////////////////////////////////////
	//// Private Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	// private static poolObjectFromDynamicField
}

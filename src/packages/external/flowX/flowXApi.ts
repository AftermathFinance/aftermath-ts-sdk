import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { Helpers } from "../../../general/utils";
import { TransactionBlock } from "@mysten/sui.js";
import { Balance, FlowXAddresses } from "../../../types";
import { Coin } from "../../coin";
import { RouterPoolTradeTxInputs } from "../../router";
import { RouterAsyncApiInterface } from "../../router/utils/async/routerAsyncApiInterface";
import { RouterAsyncApiHelpers } from "../../router/api/routerAsyncApiHelpers";
import { FlowXPoolObject } from "./flowXTypes";

export class FlowXApi implements RouterAsyncApiInterface<FlowXPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: FlowXAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const flowXAddresses = this.Provider.addresses.external?.flowX;

		if (!flowXAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = flowXAddresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<FlowXPoolObject[]> => {
		const dynamicFields =
			await this.Provider.DynamicFields().fetchAllDynamicFieldsOfType({
				parentObjectId: this.addresses.objects.pairsBag,
			});

		return dynamicFields.map((field) => {
			const coinTypes = Coin.getInnerCoinType(field.objectType)
				.replaceAll(" ", "")
				.split(",")
				.map((coin) => Helpers.addLeadingZeroesToType(coin));

			return {
				objectId: field.objectId,
				objectType: field.objectType,
				dummyField: "FlowX",
				coinTypeX: coinTypes[0],
				coinTypeY: coinTypes[1],
			};
		});
	};

	// =========================================================================
	//  Async Router Pool Api Interface Methods
	// =========================================================================

	public filterPoolsForTrade = (inputs: {
		pools: FlowXPoolObject[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): {
		partialMatchPools: FlowXPoolObject[];
		exactMatchPools: FlowXPoolObject[];
	} => {
		const possiblePools = inputs.pools.filter((pool) =>
			FlowXApi.isPoolForCoinType({
				pool,
				coinType: inputs.coinOutType,
			})
		);

		// const [allExactMatchPools, allPartialMatchPools] = Helpers.bifilter(
		const [exactMatchPools, partialMatchPools] = Helpers.bifilter(
			possiblePools,
			(pool) =>
				FlowXApi.isPoolForCoinTypes({
					pool,
					coinType1: inputs.coinInType,
					coinType2: inputs.coinOutType,
				})
		);

		// const exactMatchPools =
		// 	allExactMatchPools.length > 0
		// 		? [allExactMatchPools[0]]
		// 		: allExactMatchPools;

		// let partialMatchPools: FlowXPoolObject[] = [];
		// for (const partialPool of allPartialMatchPools) {
		// 	if (
		// 		partialMatchPools.some((pool) =>
		// 			FlowXApi.isPoolForCoinTypes({
		// 				pool,
		// 				coinType1: partialPool.coinTypeX,
		// 				coinType2: partialPool.coinTypeY,
		// 			})
		// 		)
		// 	)
		// 		continue;

		// 	partialMatchPools.push(partialPool);
		// }

		return {
			exactMatchPools,
			partialMatchPools,
		};
	};

	public fetchTradeAmountOut = async (inputs: {
		pool: FlowXPoolObject;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
	}): Promise<Balance> => {
		return RouterAsyncApiHelpers.devInspectTradeAmountOut({
			...inputs,
			Provider: this.Provider,
			devInspectTx: (txInputs: {
				tx: TransactionBlock;
				coinInBytes: Uint8Array;
				routerSwapCapBytes: Uint8Array;
			}) =>
				this.tradeDevInspectTx({
					...inputs,
					...txInputs,
					routerSwapCapCoinType: inputs.coinInType,
				}),
		});
	};

	public otherCoinInPool = (inputs: {
		coinType: CoinType;
		pool: FlowXPoolObject;
	}) => {
		return FlowXApi.isCoinTypeX(inputs)
			? inputs.pool.coinTypeY
			: inputs.pool.coinTypeX;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public tradeTx = (inputs: RouterPoolTradeTxInputs) /* (Coin) */ => {
		const { tx, coinInId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				FlowXApi.constants.moduleNames.wrapper,
				"swap_exact_input_direct"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				inputs.routerSwapCap,

				tx.object(this.addresses.objects.container),
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId,
			],
		});
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Dev Inspect Transaction Commands
	// =========================================================================

	private tradeDevInspectTx = (inputs: {
		tx: TransactionBlock;
		coinInType: CoinType;
		coinOutType: CoinType;
		routerSwapCapCoinType: CoinType;
		routerSwapCapBytes: Uint8Array;
		coinInBytes: Uint8Array;
	}) /* (Coin) */ => {
		const { tx } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				FlowXApi.constants.moduleNames.wrapper,
				"swap_exact_input_direct"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				tx.pure(inputs.routerSwapCapBytes),

				tx.object(this.addresses.objects.container),
				tx.pure(inputs.coinInBytes),
			],
		});
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static isPoolForCoinTypes = (inputs: {
		pool: FlowXPoolObject;
		coinType1: CoinType;
		coinType2: CoinType;
	}) => {
		const { pool, coinType1, coinType2 } = inputs;

		return (
			(pool.coinTypeX === Helpers.addLeadingZeroesToType(coinType1) &&
				pool.coinTypeY === Helpers.addLeadingZeroesToType(coinType2)) ||
			(pool.coinTypeX === Helpers.addLeadingZeroesToType(coinType2) &&
				pool.coinTypeY === Helpers.addLeadingZeroesToType(coinType1))
		);
	};

	private static isPoolForCoinType = (inputs: {
		pool: FlowXPoolObject;
		coinType: CoinType;
	}) => {
		const { pool, coinType } = inputs;

		return (
			pool.coinTypeX === Helpers.addLeadingZeroesToType(coinType) ||
			pool.coinTypeY === Helpers.addLeadingZeroesToType(coinType)
		);
	};

	private static isCoinTypeX = (inputs: {
		pool: FlowXPoolObject;
		coinType: CoinType;
	}) => {
		const { coinType, pool } = inputs;
		return Helpers.addLeadingZeroesToType(coinType) === pool.coinTypeX;
	};
}

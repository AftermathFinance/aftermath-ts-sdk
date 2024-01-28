import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import {
	AnyObjectType,
	Balance,
	BlueMoveAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
	ObjectId,
} from "../../../types";
import {
	BlueMoveCreatedPoolEventOnChain,
	BlueMoveCreatedStablePoolEventOnChain,
	BlueMovePoolCreatedEvent,
	BlueMovePoolFieldsOnChain,
	BlueMovePoolObject,
	BlueMoveStablePoolFieldsOnChain,
} from "./blueMoveTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { RouterPoolTradeTxInputs } from "../../router";
import { SuiObjectResponse } from "@mysten/sui.js/client";

export class BlueMoveApi
	implements RouterSynchronousApiInterface<BlueMovePoolObject>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			swap: "swap",
			stableSwap: "stable_swap",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: BlueMoveAddresses;

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
		stablePoolCreated: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const blueMoveAddresses = this.Provider.addresses.router?.blueMove;

		if (!blueMoveAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = blueMoveAddresses;

		this.eventTypes = {
			poolCreated: `${blueMoveAddresses.packages.dex}::${BlueMoveApi.constants.moduleNames.swap}::Created_Pool_Event`,
			stablePoolCreated: `${blueMoveAddresses.packages.dex}::${BlueMoveApi.constants.moduleNames.stableSwap}::Created_Stable_Pool_Event`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async () => {
		const pools = await this.Provider.indexerCaller.fetchIndexer<
			{
				objectId: ObjectId;
				type: AnyObjectType;
				content: any;
			}[]
		>("router/pools/blue_move");

		return pools.map((pool) => {
			return pool.type
				.toLowerCase()
				.includes("::stable_swap::stable_pool<")
				? BlueMoveApi.blueMoveStablePoolObjectFromIndexer(pool)
				: BlueMoveApi.blueMovePoolObjectFromIndexer(pool);
		});
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public swapExactInputTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				BlueMoveApi.constants.moduleNames.wrapper,
				"swap_exact_input"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.object(this.addresses.objects.dexInfo), // Dex_Info
			],
		});
	};

	public swapExactInputStableTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				BlueMoveApi.constants.moduleNames.wrapper,
				"swap_exact_input_stable"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.object(this.addresses.objects.dexStableInfo), // Dex_Stable_Info
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: BlueMovePoolObject;
		}
	) => {
		return this.swapExactInputTx({
			...inputs,
			poolObjectId: inputs.pool.objectId,
		});
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: BlueMovePoolObject;
		coinType: CoinType;
	}) => {
		const { coinType, pool } = inputs;
		return Helpers.addLeadingZeroesToType(coinType) === pool.coinTypeX;
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Casting
	// =========================================================================

	private static blueMovePoolObjectFromIndexer = (data: {
		objectId: ObjectId;
		type: AnyObjectType;
		content: any;
	}): BlueMovePoolObject => {
		const objectType = Helpers.addLeadingZeroesToType(data.type);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = data.content as BlueMovePoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(data.objectId),
			creator: fields.creator,
			tokenXValue: BigInt(fields.token_x),
			tokenYValue: BigInt(fields.token_y),
			lspSupplyValue: BigInt(fields.lsp_supply.fields.value),
			feeXValue: BigInt(fields.fee_x),
			feeYValue: BigInt(fields.fee_y),
			isFreeze: fields.is_freeze,
			uncorrelated: {
				feeAmountValue: BigInt(fields.fee_amount),
				// minimumLiqValue: BigInt(fields.minimum_liq),
				// kLast: BigInt(fields.k_last),
				// reserveX: BigInt(fields.reserve_x),
				// reserveY: BigInt(fields.reserve_y),
			},
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
		};
	};

	private static blueMoveStablePoolObjectFromIndexer = (data: {
		objectId: ObjectId;
		type: AnyObjectType;
		content: any;
	}): BlueMovePoolObject => {
		const objectType = Helpers.addLeadingZeroesToType(data.type);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = data.content as BlueMoveStablePoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(data.objectId),
			creator: fields.creator,
			tokenXValue: BigInt(fields.token_x),
			tokenYValue: BigInt(fields.token_y),
			lspSupplyValue: BigInt(fields.lsp_supply.fields.value),
			feeXValue: BigInt(fields.fee_x),
			feeYValue: BigInt(fields.fee_y),
			isFreeze: fields.is_freeze,
			stable: {
				xScale: BigInt(fields.x_scale),
				yScale: BigInt(fields.y_scale),
				fee: BigInt(fields.fee),
				daoFee: BigInt(fields.dao_fee),
			},
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
		};
	};
}

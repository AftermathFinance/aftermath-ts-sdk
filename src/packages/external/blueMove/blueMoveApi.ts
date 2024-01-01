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

	public fetchAllPoolIds = async () => {
		const [poolObjectIds, stablePoolObjectIds] = await Promise.all([
			this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventsInputs) =>
					this.Provider.Events().fetchCastEventsWithCursor({
						...eventsInputs,
						query: {
							MoveEventType: this.eventTypes.poolCreated,
						},
						eventFromEventOnChain: (eventOnChain) =>
							BlueMoveApi.blueMoveCreatedPoolEventFromOnChain(
								eventOnChain as BlueMoveCreatedPoolEventOnChain
							).poolId,
					}),
			}),
			this.Provider.Events().fetchAllEvents({
				fetchEventsFunc: (eventsInputs) =>
					this.Provider.Events().fetchCastEventsWithCursor({
						...eventsInputs,
						query: {
							MoveEventType: this.eventTypes.stablePoolCreated,
						},
						eventFromEventOnChain: (eventOnChain) =>
							BlueMoveApi.blueMoveCreatedStablePoolEventFromOnChain(
								eventOnChain as BlueMoveCreatedStablePoolEventOnChain
							).poolId,
					}),
			}),
		]);

		return [...poolObjectIds, ...stablePoolObjectIds];
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		const { objectIds } = inputs;

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse: (data) =>
				data.data?.type?.toLowerCase().includes("stable")
					? BlueMoveApi.blueMoveStablePoolObjectFromSuiObjectResponse(
							data
					  )
					: BlueMoveApi.blueMovePoolObjectFromSuiObjectResponse(data),
		});

		const unlockedPools = pools.filter(
			(pool) =>
				!pool.isFreeze &&
				pool.tokenXValue > BigInt(0) &&
				pool.tokenYValue > BigInt(0)
		);
		return unlockedPools;
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

	private static blueMovePoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): BlueMovePoolObject => {
		const objectType = Helpers.getObjectType(data);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = Helpers.getObjectFields(
			data
		) as BlueMovePoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
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

	private static blueMoveStablePoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): BlueMovePoolObject => {
		const objectType = Helpers.getObjectType(data);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = Helpers.getObjectFields(
			data
		) as BlueMoveStablePoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
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

	private static blueMoveCreatedPoolEventFromOnChain = (
		eventOnChain: BlueMoveCreatedPoolEventOnChain
	): BlueMovePoolCreatedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			creator: fields.creator,
			tokenXName: fields.token_x_name,
			tokenYName: fields.token_y_name,
			tokenXAmountIn: BigInt(fields.token_x_amount_in),
			tokenYAmountIn: BigInt(fields.token_y_amount_in),
			lspBalance: BigInt(fields.lsp_balance),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	private static blueMoveCreatedStablePoolEventFromOnChain = (
		eventOnChain: BlueMoveCreatedStablePoolEventOnChain
	): BlueMovePoolCreatedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			creator: fields.creator,
			tokenXName: fields.token_x_name,
			tokenYName: fields.token_y_name,
			tokenXAmountIn: BigInt(fields.token_x_amount_in),
			tokenYAmountIn: BigInt(fields.token_y_amount_in),
			lspBalance: BigInt(fields.lsp_balance),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

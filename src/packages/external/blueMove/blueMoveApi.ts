import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterApiInterface } from "../../router/utils/synchronous/interfaces/routerApiInterface";
import {
	ObjectId,
	SuiObjectResponse,
	TransactionArgument,
	TransactionBlock,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	AnyObjectType,
	Balance,
	BlueMoveAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
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

export class BlueMoveApi implements RouterApiInterface<BlueMovePoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			swap: "swap",
			stableSwap: "stable_swap",
			wrapper: "bluemove",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		blueMove: BlueMoveAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
		stablePoolCreated: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const blueMove = this.Provider.addresses.router?.blueMove;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!blueMove || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			blueMove,
			pools,
			referralVault,
		};

		this.eventTypes = {
			poolCreated: `${blueMove.packages.dex}::${BlueMoveApi.constants.moduleNames.swap}::Created_Pool_Event`,
			stablePoolCreated: `${blueMove.packages.dex}::${BlueMoveApi.constants.moduleNames.stableSwap}::Created_Stable_Pool_Event`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<BlueMovePoolObject[]> => {
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

		const [pools, stablePools] = await Promise.all([
			this.Provider.Objects().fetchCastObjectBatch({
				objectIds: poolObjectIds,
				objectFromSuiObjectResponse:
					BlueMoveApi.blueMovePoolObjectFromSuiObjectResponse,
			}),
			this.Provider.Objects().fetchCastObjectBatch({
				objectIds: stablePoolObjectIds,
				objectFromSuiObjectResponse:
					BlueMoveApi.blueMoveStablePoolObjectFromSuiObjectResponse,
			}),
		]);

		const unlockedPools = [...pools, ...stablePools].filter(
			(pool) =>
				!pool.isFreeze &&
				pool.tokenXValue > BigInt(0) &&
				pool.tokenYValue > BigInt(0)
		);
		return unlockedPools;
	};

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchSupportedCoins = async (): Promise<CoinType[]> => {
		const pools = await this.fetchAllPools();
		const allCoins = pools.reduce(
			(acc, pool) => [...acc, pool.coinTypeX, pool.coinTypeY],
			[] as CoinType[]
		);
		return Helpers.uniqueArray(allCoins);
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public swapExactInputTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
	}) => {
		const {
			tx,
			coinInId,
			tradePotato,
			isFirstSwapForPath,
			isLastSwapForPath,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.blueMove.packages.wrapper,
				BlueMoveApi.constants.moduleNames.wrapper,
				"swap_exact_input"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.coinInAmount, "U64"),
				tx.pure(inputs.minAmountOut, "U64"),
				tx.object(this.addresses.blueMove.objects.dexInfo), // Dex_Info
				tx.object(Sui.constants.addresses.suiClockId), // Clock

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),

				// potato
				tradePotato,
				tx.pure(isFirstSwapForPath, "bool"),
				tx.pure(isLastSwapForPath, "bool"),
			],
		});
	};

	public swapExactInputStableTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
	}) => {
		const {
			tx,
			coinInId,
			tradePotato,
			isFirstSwapForPath,
			isLastSwapForPath,
		} = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.blueMove.packages.wrapper,
				BlueMoveApi.constants.moduleNames.wrapper,
				"swap_exact_input_stable"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.coinInAmount, "U64"),
				tx.pure(inputs.minAmountOut, "U64"),
				tx.object(this.addresses.blueMove.objects.dexStableInfo), // Dex_Stable_Info
				tx.object(Sui.constants.addresses.suiClockId), // Clock

				// AF fees
				tx.object(this.addresses.pools.objects.protocolFeeVault),
				tx.object(this.addresses.pools.objects.treasury),
				tx.object(this.addresses.pools.objects.insuranceFund),
				tx.object(this.addresses.referralVault.objects.referralVault),

				// potato
				tradePotato,
				tx.pure(isFirstSwapForPath, "bool"),
				tx.pure(isLastSwapForPath, "bool"),
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (inputs: {
		tx: TransactionBlock;
		pool: BlueMovePoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
	}) => {
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as BlueMovePoolFieldsOnChain;

		return {
			// objectType,
			objectId: getObjectId(data),
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as BlueMoveStablePoolFieldsOnChain;

		return {
			// objectType,
			objectId: getObjectId(data),
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

import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
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
	SuiswapAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import {
	SuiswapPoolCreateEvent,
	SuiswapPoolCreateEventOnChain,
	SuiswapPoolFieldsOnChain,
	SuiswapPoolObject,
} from "./suiswapTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { RouterPoolTradeTxInputs } from "../../router";

export class SuiswapApi
	implements RouterSynchronousApiInterface<SuiswapPoolObject>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			pool: "pool",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: SuiswapAddresses;

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const suiswapAddresses = this.Provider.addresses.router?.suiswap;

		if (!suiswapAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = suiswapAddresses;
		this.eventTypes = {
			poolCreated: `${suiswapAddresses.packages.dex}::${SuiswapApi.constants.moduleNames.pool}::PoolCreateEvent`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPoolIds = async () => {
		return this.Provider.Events().fetchAllEvents({
			fetchEventsFunc: (eventsInputs) =>
				this.Provider.Events().fetchCastEventsWithCursor({
					...eventsInputs,
					query: {
						MoveEventType: this.eventTypes.poolCreated,
					},
					eventFromEventOnChain: (eventOnChain) =>
						SuiswapApi.suiswapPoolCreatedEventFromOnChain(
							eventOnChain as SuiswapPoolCreateEventOnChain
						).poolId,
				}),
		});
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		const { objectIds } = inputs;

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				SuiswapApi.suiswapPoolObjectFromSuiObjectResponse,
		});

		const unlockedPools = pools.filter(
			(pool) =>
				!pool.isFrozen &&
				pool.xValue > BigInt(0) &&
				pool.yValue > BigInt(0)
		);
		return unlockedPools;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public doSwapXToYDirectTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				SuiswapApi.constants.moduleNames.wrapper,
				"swap_x_to_y"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	public doSwapYToXDirectTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				SuiswapApi.constants.moduleNames.wrapper,
				"swap_y_to_x"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinOutType,
				inputs.coinInType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.object(Sui.constants.addresses.suiClockId), // Clock
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: SuiswapPoolObject;
		}
	) => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
		};

		if (SuiswapApi.isCoinX({ ...inputs, coinType: inputs.coinInType })) {
			return this.doSwapXToYDirectTx(commandInputs);
		}

		return this.doSwapYToXDirectTx(commandInputs);
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: SuiswapPoolObject;
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

	private static suiswapPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): SuiswapPoolObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as SuiswapPoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
			version: BigInt(fields.version),
			owner: fields.owner,
			index: BigInt(fields.index),
			poolType: Number(fields.pool_type) === 100 ? "v2" : "stable",
			lspSupply: BigInt(fields.lsp_supply),
			isFrozen: BigInt(fields.freeze) === BigInt(0),
			tradeEpoch: BigInt(fields.trade_epoch),
			feeDirection:
				Number(fields.fee.fields.direction) === 200 ? "X" : "Y",
			feeAdmin: BigInt(fields.fee.fields.admin),
			feeLp: BigInt(fields.fee.fields.lp),
			feeTh: BigInt(fields.fee.fields.th),
			feeWithdraw: BigInt(fields.fee.fields.withdraw),
			stableAmp: BigInt(fields.stable.fields.amp),
			stableXScale: BigInt(fields.stable.fields.x_scale),
			stableYScale: BigInt(fields.stable.fields.y_scale),
			xValue: BigInt(fields.balance.fields.x),
			yValue: BigInt(fields.balance.fields.y),
			xAdminValue: BigInt(fields.balance.fields.x_admin),
			yAdminValue: BigInt(fields.balance.fields.y_admin),
			xThValue: BigInt(fields.balance.fields.x_th),
			yThValue: BigInt(fields.balance.fields.y_th),
			bx: BigInt(fields.balance.fields.bx),
			by: BigInt(fields.balance.fields.by),
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
		};
	};

	private static suiswapPoolCreatedEventFromOnChain = (
		eventOnChain: SuiswapPoolCreateEventOnChain
	): SuiswapPoolCreateEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

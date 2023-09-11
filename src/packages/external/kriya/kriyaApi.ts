import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	AnyObjectType,
	Balance,
	KriyaAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
	ObjectId,
} from "../../../types";
import {
	KriyaPoolCreatedEvent,
	KriyaPoolCreatedEventOnChain,
	KriyaPoolFieldsOnChain,
	KriyaPoolObject,
} from "./kriyaTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { RouterPoolTradeTxInputs } from "../../router";

export class KriyaApi
	implements RouterSynchronousApiInterface<KriyaPoolObject>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			spotDex: "spot_dex",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: KriyaAddresses;

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const kriyaAddresses = this.Provider.addresses.router?.kriya;

		if (!kriyaAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = kriyaAddresses;
		this.eventTypes = {
			poolCreated: `${kriyaAddresses.packages.dex}::${KriyaApi.constants.moduleNames.spotDex}::PoolCreatedEvent`,
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
						KriyaApi.kriyaPoolCreatedEventFromOnChain(
							eventOnChain as KriyaPoolCreatedEventOnChain
						).poolId,
				}),
		});
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		const { objectIds } = inputs;

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				KriyaApi.kriyaPoolObjectFromSuiObjectResponse,
		});

		const unlockedPools = pools.filter(
			(pool) =>
				pool.isSwapEnabled &&
				pool.tokenXValue > BigInt(0) &&
				pool.tokenYValue > BigInt(0)
		);
		return unlockedPools;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public swapTokenXTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_x"
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
			],
		});
	};

	public swapTokenYTx = (
		inputs: RouterPoolTradeTxInputs & {
			poolObjectId: ObjectId;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_y"
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
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: KriyaPoolObject;
		}
	) => {
		const commandInputs = {
			...inputs,
			poolObjectId: inputs.pool.objectId,
		};

		if (KriyaApi.isCoinX({ ...inputs, coinType: inputs.coinInType })) {
			return this.swapTokenXTx(commandInputs);
		}

		return this.swapTokenYTx(commandInputs);
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: KriyaPoolObject;
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

	private static kriyaPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): KriyaPoolObject => {
		const objectType = Helpers.getObjectType(data);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = Helpers.getObjectFields(data) as KriyaPoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(Helpers.getObjectId(data)),
			tokenYValue: BigInt(fields.token_y),
			tokenXValue: BigInt(fields.token_x),
			lspSupplyValue: BigInt(fields.lsp_supply.fields.value),
			lspLockedValue: BigInt(fields.lsp_locked),
			lpFeePercent: BigInt(fields.lp_fee_percent),
			protocolFeePercent: BigInt(fields.protocol_fee_percent),
			protocolFeeXValue: BigInt(fields.protocol_fee_x),
			protocolFeeYValue: BigInt(fields.protocol_fee_y),
			isStable: fields.is_stable,
			scaleX: BigInt(fields.scaleX),
			scaleY: BigInt(fields.scaleY),
			isSwapEnabled: fields.is_swap_enabled,
			isDepositEnabled: fields.is_deposit_enabled,
			isWithdrawEnabled: fields.is_withdraw_enabled,
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
		};
	};

	private static kriyaPoolCreatedEventFromOnChain = (
		eventOnChain: KriyaPoolCreatedEventOnChain
	): KriyaPoolCreatedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			creator: fields.creator,
			lpFeePercent: BigInt(fields.lp_fee_percent),
			protocolFeePercent: BigInt(fields.protocol_fee_percent),
			isStable: fields.is_stable,
			scaleX: BigInt(fields.scaleX),
			scaleY: BigInt(fields.scaleY),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

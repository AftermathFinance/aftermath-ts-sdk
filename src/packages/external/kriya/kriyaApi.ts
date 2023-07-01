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
	KriyaAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
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

export class KriyaApi implements RouterApiInterface<KriyaPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			spotDex: "spot_dex",
			wrapper: "kriya",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		kriya: KriyaAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	public readonly eventTypes: {
		poolCreated: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const kriya = this.Provider.addresses.router?.kriya;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!kriya || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			kriya,
			pools,
			referralVault,
		};

		this.eventTypes = {
			poolCreated: `${kriya.packages.dex}::${KriyaApi.constants.moduleNames.spotDex}::PoolCreatedEvent`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<KriyaPoolObject[]> => {
		const poolObjectIds = await this.Provider.Events().fetchAllEvents({
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

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds: poolObjectIds,
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

	public swapTokenXTx = (inputs: {
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
				this.addresses.kriya.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_x"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.coinInAmount, "U64"),
				tx.pure(inputs.minAmountOut, "U64"),

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

	public swapTokenYTx = (inputs: {
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
				this.addresses.kriya.packages.wrapper,
				KriyaApi.constants.moduleNames.wrapper,
				"swap_token_y"
			),
			typeArguments: [inputs.coinOutType, inputs.coinInType],
			arguments: [
				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.coinInAmount, "U64"),
				tx.pure(inputs.minAmountOut, "U64"),

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
		pool: KriyaPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
	}) => {
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
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as KriyaPoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(getObjectId(data)),
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

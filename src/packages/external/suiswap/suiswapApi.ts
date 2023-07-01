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

export class SuiswapApi implements RouterApiInterface<SuiswapPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			pool: "pool",
			wrapper: "suiswap",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		suiswap: SuiswapAddresses;
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
		const suiswap = this.Provider.addresses.router?.suiswap;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!suiswap || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			suiswap,
			pools,
			referralVault,
		};

		this.eventTypes = {
			poolCreated: `${suiswap.packages.dex}::${SuiswapApi.constants.moduleNames.pool}::PoolCreateEvent`,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<SuiswapPoolObject[]> => {
		const poolObjectIds = await this.Provider.Events().fetchAllEvents({
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

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds: poolObjectIds,
			objectFromSuiObjectResponse:
				SuiswapApi.suiswapPoolObjectFromSuiObjectResponse,
		});

		const unlockedPools = pools.filter(
			(pool) =>
				// !pool.freeze &&
				// pool.xValue > BigInt(0) &&
				// pool.yValue > BigInt(0)
				true
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

	public doSwapXToYDirectTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
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
				this.addresses.suiswap.packages.wrapper,
				SuiswapApi.constants.moduleNames.wrapper,
				"do_swap_x_to_y_direct"
			),
			typeArguments: [inputs.coinInType, inputs.coinOutType],
			arguments: [
				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.minAmountOut, "U64"),
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

	public doSwapYToXDirectTx = (inputs: {
		tx: TransactionBlock;
		poolObjectId: ObjectId;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
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
				this.addresses.suiswap.packages.wrapper,
				SuiswapApi.constants.moduleNames.wrapper,
				"do_swap_y_to_x_direct"
			),
			typeArguments: [inputs.coinOutType, inputs.coinInType],
			arguments: [
				tx.object(inputs.poolObjectId), // Pool
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.minAmountOut, "U64"),
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
		pool: SuiswapPoolObject;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
	}) => {
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

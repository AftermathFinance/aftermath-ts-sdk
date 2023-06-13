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
	BaySwapAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { BaySwapPoolFieldsOnChain, BaySwapPoolObject } from "./baySwapTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";

export class BaySwapApi implements RouterApiInterface<BaySwapPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			router: "router",
			wrapper: "bayswap",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		baySwap: BaySwapAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const baySwap = this.Provider.addresses.router?.baySwap;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!baySwap || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			baySwap,
			pools,
			referralVault,
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (): Promise<BaySwapPoolObject[]> => {
		const pools =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.baySwap.objects.poolsBag,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								BaySwapApi.baySwapPoolObjectFromSuiObjectResponse,
						}),
				}
			);

		const unlockedPools = pools.filter(
			(pool) =>
				!pool.isLocked &&
				pool.coinXReserveValue > BigInt(0) &&
				pool.coinYReserveValue > BigInt(0)
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

	public swapExactCoinXForCoinYTx = (inputs: {
		tx: TransactionBlock;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
		curveType: AnyObjectType;
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
				this.addresses.baySwap.packages.wrapper,
				BaySwapApi.constants.moduleNames.wrapper,
				"swap_exact_coin_x_for_coin_y"
			),
			typeArguments: [
				inputs.coinInType,
				inputs.coinOutType,
				inputs.curveType,
			],
			arguments: [
				tx.object(this.addresses.baySwap.objects.globalStorage), // GlobalStorage
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

	public swapExactCoinYForCoinXTx = (inputs: {
		tx: TransactionBlock;
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
		coinInAmount: Balance;
		curveType: AnyObjectType;
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
				this.addresses.baySwap.packages.wrapper,
				BaySwapApi.constants.moduleNames.wrapper,
				"swap_exact_coin_y_for_coin_x"
			),
			typeArguments: [
				inputs.coinOutType,
				inputs.coinInType,
				inputs.curveType,
			],
			arguments: [
				tx.object(this.addresses.baySwap.objects.globalStorage), // GlobalStorage
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
		pool: BaySwapPoolObject;
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
			curveType: inputs.pool.curveType,
		};

		if (BaySwapApi.isCoinX({ ...inputs, coinType: inputs.coinInType })) {
			return this.swapExactCoinXForCoinYTx(commandInputs);
		}

		return this.swapExactCoinYForCoinXTx(commandInputs);
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: BaySwapPoolObject;
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

	private static baySwapPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): BaySwapPoolObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as BaySwapPoolFieldsOnChain;

		const curveType = coinTypes[2];
		return {
			// objectType,
			objectId: getObjectId(data),
			coinXReserveValue: BigInt(fields.coin_x_reserve),
			coinYReserveValue: BigInt(fields.coin_y_reserve),
			lpTokenSupplyValue: BigInt(fields.lp_token_supply.fields.value),
			feePercent: BigInt(fields.fee_percent),
			daoFeePercent: BigInt(fields.dao_fee_percent),
			isLocked: fields.is_locked,
			xScale: BigInt(fields.x_scale),
			yScale: BigInt(fields.y_scale),
			coinTypeX: coinTypes[0],
			coinTypeY: coinTypes[1],
			isStable: curveType.toLowerCase().includes("stable"),
			curveType,
		};
	};
}

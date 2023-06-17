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
import { RouterPoolTradeTxInputs } from "../../router";

export class BaySwapApi implements RouterApiInterface<BaySwapPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			router: "router",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: BaySwapAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const baySwapAddresses = this.Provider.addresses.router?.baySwap;

		if (!baySwapAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = baySwapAddresses;
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
					parentObjectId: this.addresses.objects.poolsBag,
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

	public swapExactCoinXForCoinYTx = (
		inputs: RouterPoolTradeTxInputs & {
			curveType: AnyObjectType;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				BaySwapApi.constants.moduleNames.wrapper,
				"swap_exact_coin_x_for_coin_y"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinInType,
				inputs.coinOutType,
				inputs.curveType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.objects.globalStorage), // GlobalStorage
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	public swapExactCoinYForCoinXTx = (
		inputs: RouterPoolTradeTxInputs & {
			curveType: AnyObjectType;
		}
	) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				BaySwapApi.constants.moduleNames.wrapper,
				"swap_exact_coin_y_for_coin_x"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinOutType,
				inputs.coinInType,
				inputs.curveType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.objects.globalStorage), // GlobalStorage
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			tx: TransactionBlock;
			pool: BaySwapPoolObject;
		}
	) => {
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

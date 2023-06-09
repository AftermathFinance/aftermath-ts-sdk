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
	InterestAddresses,
	PoolsAddresses,
	ReferralVaultAddresses,
} from "../../../types";
import { InterestPoolFieldsOnChain, InterestPoolObject } from "./interestTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";

export class InterestApi implements RouterApiInterface<InterestPoolObject> {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			wrapper: "interest",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: {
		interest: InterestAddresses;
		pools: PoolsAddresses;
		referralVault: ReferralVaultAddresses;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const interest = this.Provider.addresses.router?.interest;
		const pools = this.Provider.addresses.pools;
		const referralVault = this.Provider.addresses.referralVault;

		if (!interest || !pools || !referralVault)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = {
			interest,
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

	public fetchAllPools = async (): Promise<InterestPoolObject[]> => {
		const pools =
			await this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType(
				{
					parentObjectId: this.addresses.interest.objects.poolsBag,
					objectsFromObjectIds: (objectIds) =>
						this.Provider.Objects().fetchCastObjectBatch({
							objectIds,
							objectFromSuiObjectResponse:
								InterestApi.interestPoolObjectFromSuiObjectResponse,
						}),
				}
			);

		const unlockedPools = pools.filter(
			(pool) =>
				!pool.locked &&
				pool.balanceXValue > BigInt(0) &&
				pool.balanceYValue > BigInt(0)
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
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
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
				this.addresses.interest.packages.wrapper,
				InterestApi.constants.moduleNames.wrapper,
				"swap_token_x"
			),
			typeArguments: [
				inputs.curveType,
				inputs.coinInType,
				inputs.coinOutType,
			],
			arguments: [
				tx.object(this.addresses.interest.objects.dexStorage), // DEXStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.minAmountOut, "U64"), // coin_y_min_value

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
		coinInId: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		minAmountOut: Balance;
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
				this.addresses.interest.packages.wrapper,
				InterestApi.constants.moduleNames.wrapper,
				"swap_token_y"
			),
			typeArguments: [
				inputs.curveType,
				inputs.coinOutType,
				inputs.coinInType,
			],
			arguments: [
				tx.object(this.addresses.interest.objects.dexStorage), // DEXStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
				tx.pure(inputs.minAmountOut, "U64"), // coin_y_min_value

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
		pool: InterestPoolObject;
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
			curveType: inputs.pool.curveType,
		};

		if (InterestApi.isCoinX({ ...inputs, coinType: inputs.coinInType })) {
			return this.swapTokenXTx(commandInputs);
		}

		return this.swapTokenYTx(commandInputs);
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	public static isCoinX = (inputs: {
		pool: InterestPoolObject;
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

	private static interestPoolObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): InterestPoolObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = getObjectFields(data) as InterestPoolFieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			kLast: BigInt(fields.k_last),
			lpCoinSupplyValue: BigInt(fields.lp_coin_supply.fields.value),
			balanceXValue: BigInt(fields.balance_x),
			balanceYValue: BigInt(fields.balance_y),
			decimalsX: BigInt(fields.decimals_x),
			decimalsY: BigInt(fields.decimals_y),
			isStable: fields.is_stable,
			timestampLast: BigInt(fields.timestamp_last),
			balanceXCumulativeLast: BigInt(fields.balance_x_cumulative_last),
			balanceYCumulativeLast: BigInt(fields.balance_y_cumulative_last),
			locked: fields.locked,
			coinTypeX: coinTypes[1],
			coinTypeY: coinTypes[2],
			curveType: coinTypes[0],
		};
	};
}

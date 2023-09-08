import { AftermathApi } from "../../../general/providers";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousApiInterface } from "../../router/utils/synchronous/interfaces/routerSynchronousApiInterface";
import { SuiObjectResponse } from "@mysten/sui.js/client";
import { InterestAddresses, ObjectId } from "../../../types";
import { InterestPoolFieldsOnChain, InterestPoolObject } from "./interestTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { Sui } from "../../sui";
import { RouterPoolTradeTxInputs } from "../../router";

export class InterestApi
	implements RouterSynchronousApiInterface<InterestPoolObject>
{
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			interface: "interface",
			wrapper: "router",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: InterestAddresses;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const interestAddresses = this.Provider.addresses.router?.interest;

		if (!interestAddresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = interestAddresses;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPoolIds = async () => {
		return this.Provider.DynamicFields().fetchCastAllDynamicFieldsOfType({
			parentObjectId: this.addresses.objects.poolsBag,
			objectsFromObjectIds: (objectIds) => objectIds,
		});
	};

	public fetchPoolsFromIds = async (inputs: { objectIds: ObjectId[] }) => {
		const { objectIds } = inputs;

		const pools = await this.Provider.Objects().fetchCastObjectBatch({
			objectIds,
			objectFromSuiObjectResponse:
				InterestApi.interestPoolObjectFromSuiObjectResponse,
		});

		const unlockedPools = pools.filter(
			(pool) =>
				!pool.locked &&
				pool.balanceXValue > BigInt(0) &&
				pool.balanceYValue > BigInt(0)
		);
		return unlockedPools;
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public swapTokenXTx = (inputs: RouterPoolTradeTxInputs) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				InterestApi.constants.moduleNames.wrapper,
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

				tx.object(this.addresses.objects.dexStorage), // DEXStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	public swapTokenYTx = (inputs: RouterPoolTradeTxInputs) => {
		const { tx, coinInId, routerSwapCap } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.wrapper,
				InterestApi.constants.moduleNames.wrapper,
				"swap_token_y"
			),
			typeArguments: [
				inputs.routerSwapCapCoinType,
				inputs.coinOutType,
				inputs.coinInType,
			],
			arguments: [
				tx.object(this.addresses.objects.wrapperApp),
				routerSwapCap,

				tx.object(this.addresses.objects.dexStorage), // DEXStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				typeof coinInId === "string" ? tx.object(coinInId) : coinInId, // Coin
			],
		});
	};

	// =========================================================================
	//  Transaction Command Wrappers
	// =========================================================================

	public tradeTx = (
		inputs: RouterPoolTradeTxInputs & {
			pool: InterestPoolObject;
		}
	) => {
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
		const objectType = Helpers.getObjectType(data);

		const coinTypes = Coin.getInnerCoinType(objectType)
			.replaceAll(" ", "")
			.split(",")
			.map((coin) => Helpers.addLeadingZeroesToType(coin));

		const fields = Helpers.getObjectFields(
			data
		) as InterestPoolFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.addLeadingZeroesToType(Helpers.getObjectId(data)),
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

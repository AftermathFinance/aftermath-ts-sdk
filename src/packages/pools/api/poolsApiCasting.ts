import {
	ObjectId,
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	PoolCoins,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../poolsTypes";
import {
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { AnyObjectType } from "../../../types";

export class PoolsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static poolObjectFromSuiObject = (
		suiObject: SuiObjectResponse
	): PoolObject => {
		const objectId = getObjectId(suiObject);
		const objectType = getObjectType(suiObject);
		if (!objectType) throw new Error("no object type found");

		const poolFieldsOnChain = getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		const lpCoinType = Helpers.addLeadingZeroesToType(
			new Coin(poolFieldsOnChain.lp_supply.type).innerCoinType
		);

		const coins: PoolCoins = poolFieldsOnChain.type_names.reduce(
			(acc, cur, index) => {
				return {
					...acc,
					["0x" + cur]: {
						weight: BigInt(poolFieldsOnChain.weights[index]),
						balance:
							BigInt(
								poolFieldsOnChain.normalized_balances[index]
							) /
							BigInt(poolFieldsOnChain.decimal_scalars[index]),
						tradeFeeIn: BigInt(
							poolFieldsOnChain.fees_swap_in[index]
						),
						tradeFeeOut: BigInt(
							poolFieldsOnChain.fees_swap_out[index]
						),
						depositFee: BigInt(
							poolFieldsOnChain.fees_deposit[index]
						),
						withdrawFee: BigInt(
							poolFieldsOnChain.fees_withdraw[index]
						),
						normalizedBalance: BigInt(
							poolFieldsOnChain.normalized_balances[index]
						),
						decimalsScalar: BigInt(
							poolFieldsOnChain.decimal_scalars[index]
						),
					},
				};
			},
			{} as PoolCoins
		);

		return {
			objectType,
			objectId,
			lpCoinType,
			name: poolFieldsOnChain.name,
			creator: poolFieldsOnChain.creator,
			lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
			illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
			flatness: BigInt(poolFieldsOnChain.flatness),
			lpCoinDecimals: Number(poolFieldsOnChain.lp_decimals),
			coins,
		};
	};

	public static poolObjectIdFromSuiObjectResponse = (
		data: SuiObjectResponse
	): ObjectId => {
		const content = data.data?.content;
		if (content?.dataType !== "moveObject")
			throw new Error("sui object response is not an object");

		const fields = content.fields as {
			name: AnyObjectType; // lp coin type
			value: ObjectId; // pool object id
		};

		return fields.value;
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static poolTradeEventFromOnChain = (
		eventOnChain: PoolTradeEventOnChain
	): PoolTradeEvent => {
		return {
			poolId: eventOnChain.pool_id,
			trader: eventOnChain.issuer,
			typesIn: eventOnChain.types_in.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsIn: eventOnChain.amounts_in.map((amount) => BigInt(amount)),
			typesOut: eventOnChain.types_out.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsOut: eventOnChain.amounts_out.map((amount) =>
				BigInt(amount)
			),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static poolDepositEventFromOnChain = (
		eventOnChain: PoolDepositEventOnChain
	): PoolDepositEvent => {
		return {
			poolId: eventOnChain.pool_id,
			depositor: eventOnChain.issuer,
			// TODO: create a function for all this 0x nonsense
			types: eventOnChain.types.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			deposits: eventOnChain.deposits.map((deposit) => BigInt(deposit)),
			lpMinted: BigInt(eventOnChain.lp_coins_minted),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static poolWithdrawEventFromOnChain = (
		eventOnChain: PoolWithdrawEventOnChain
	): PoolWithdrawEvent => {
		return {
			poolId: eventOnChain.pool_id,
			withdrawer: eventOnChain.issuer,
			types: eventOnChain.types.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			withdrawn: eventOnChain.withdrawn.map((withdraw) =>
				BigInt(withdraw)
			),
			lpBurned: BigInt(eventOnChain.lp_coins_burned),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static poolObjectIdfromPoolCreateEventOnChain = (
		eventOnChain: PoolCreateEventOnChain
	): ObjectId => {
		const fields = eventOnChain.parsedJson;
		return fields.pool_id;
	};
}

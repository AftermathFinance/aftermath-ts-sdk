import {
	ObjectId,
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
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
import { Pools } from "../pools";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";

export class PoolsApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static poolObjectFromSuiObject = (
		suiObject: SuiObjectResponse
	): PoolObject => {
		const objectId = getObjectId(suiObject);

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
						balance: BigInt(poolFieldsOnChain.balances[index]),
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
					},
				};
			},
			{} as PoolCoins
		);

		return {
			objectId,
			lpCoinType,
			name: poolFieldsOnChain.name,
			creator: poolFieldsOnChain.creator,
			lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
			illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
			flatness: BigInt(poolFieldsOnChain.flatness),
			coins,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static poolTradeEventFromOnChain = (
		eventOnChain: PoolTradeEventOnChain
	): PoolTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			trader: fields.issuer,
			typesIn: fields.types_in.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsIn: fields.amounts_in,
			typesOut: fields.types_out.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsOut: fields.amounts_out,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static poolDepositEventFromOnChain = (
		eventOnChain: PoolDepositEventOnChain
	): PoolDepositEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			depositor: fields.issuer,
			// TODO: create a function for all this 0x nonsense
			types: fields.types.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			deposits: fields.deposits,
			lpMinted: fields.lp_coins_minted,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static poolWithdrawEventFromOnChain = (
		eventOnChain: PoolWithdrawEventOnChain
	): PoolWithdrawEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			withdrawer: fields.issuer,
			types: fields.types.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			withdrawn: fields.withdrawn,
			lpBurned: fields.lp_coins_burned,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
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

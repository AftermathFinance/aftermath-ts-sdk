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
	PoolSingleDepositEvent,
	PoolSingleWithdrawEvent,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../poolsTypes";
import {
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
	PoolSingleDepositEventOnChain,
	PoolSingleWithdrawEventOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Pools } from "../pools";
import { CoinType } from "../../coin/coinTypes";

export class PoolsApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static poolObjectFromSuiObject = (suiObject: SuiObjectResponse) => {
		const objectId = getObjectId(suiObject);
		const poolFieldsOnChain = getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		return this.poolObjectFromPoolFieldsOnChain(
			objectId,
			LP_TYPE,
			poolFieldsOnChain
		);
	};

	public static poolObjectFromPoolCreateEventOnChain = (
		createEvent: PoolCreateEventOnChain
	): PoolObject => {
		return this.poolObjectFromPoolFieldsOnChain(
			createEvent.parsedJson.pool_id,
			createEvent.parsedJson.lp_type,
			createEvent.parsedJson
		);
	};

	private static poolObjectFromPoolFieldsOnChain = (
		objectId: ObjectId,
		lpCoinType: CoinType,
		fields: PoolFieldsOnChain
	): PoolObject => {
		const coins: PoolCoins = fields.type_names.reduce((acc, cur, index) => {
			return {
				...acc,
				["0x" + cur]: {
					weight: BigInt(fields.weights[index]),
					balance: BigInt(fields.balances[index]),
					tradeFeeIn: BigInt(fields.fees_swap_in[index]),
					tradeFeeOut: BigInt(fields.fees_swap_out[index]),
					depositFee: BigInt(fields.fees_deposit[index]),
					withdrawFee: BigInt(fields.fees_withdraw[index]),
				},
			};
		}, {} as PoolCoins);

		return {
			objectId,
			lpCoinType: Pools.normalizeLpCoinType(lpCoinType),
			name: fields.name,
			creator: fields.creator,
			// lpCoinSupply: ,
			// illiquidLpCoinSupply: ,
			flatness: BigInt(fields.flatness),
			coins,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static poolTradeEventFromOnChain = (
		tradeEventFromFetched: PoolTradeEventOnChain
	): PoolTradeEvent => {
		const fields = tradeEventFromFetched.parsedJson;
		return {
			poolId: fields.pool_id,
			trader: fields.issuer, // issuer
			typeIn: "0x" + fields.type_in,
			amountIn: fields.value_in, // "value" might refer to the constant value function, "amount" is raw amount
			typeOut: "0x" + fields.type_out,
			amountOut: fields.value_out, // "value" might refer to the constant value function, "amount" is raw amount
			timestamp: tradeEventFromFetched.timestampMs,
			txnDigest: tradeEventFromFetched.id.txDigest,
		};
	};

	public static poolSingleDepositEventFromOnChain = (
		singleDepositEventFromFetched: PoolSingleDepositEventOnChain
	): PoolSingleDepositEvent => {
		const fields = singleDepositEventFromFetched.parsedJson;
		return {
			poolId: fields.pool_id,
			depositor: fields.issuer,
			type: "0x" + fields.type,
			amount: fields.value,
			lpMinted: fields.lp_coins_minted,
			timestamp: singleDepositEventFromFetched.timestampMs,
			txnDigest: singleDepositEventFromFetched.id.txDigest,
		};
	};

	public static poolDepositEventFromOnChain = (
		depositEventFromFetched: PoolDepositEventOnChain
	): PoolDepositEvent => {
		const fields = depositEventFromFetched.parsedJson;
		return {
			poolId: fields.pool_id,
			depositor: fields.issuer,
			// TODO: create a function for all this 0x nonsense
			types: fields.types.map((type) => "0x" + type),
			deposits: fields.deposits,
			lpMinted: fields.lp_coins_minted,
			timestamp: depositEventFromFetched.timestampMs,
			txnDigest: depositEventFromFetched.id.txDigest,
		};
	};

	public static poolSingleWithdrawEventFromOnChain = (
		singleWithdrawEventFromFetched: PoolSingleWithdrawEventOnChain
	): PoolSingleWithdrawEvent => {
		const fields = singleWithdrawEventFromFetched.parsedJson;
		return {
			poolId: fields.pool_id,
			withdrawer: fields.issuer,
			type: "0x" + fields.type,
			amount: fields.value,
			lpBurned: fields.lp_coins_burned,
			timestamp: singleWithdrawEventFromFetched.timestampMs,
			txnDigest: singleWithdrawEventFromFetched.id.txDigest,
		};
	};

	public static poolWithdrawEventFromOnChain = (
		withdrawEventFromFetched: PoolWithdrawEventOnChain
	): PoolWithdrawEvent => {
		const fields = withdrawEventFromFetched.parsedJson;
		return {
			poolId: fields.pool_id,
			withdrawer: fields.issuer,
			types: fields.types.map((type) => "0x" + type),
			withdrawn: fields.withdrawn,
			lpBurned: fields.lp_coins_burned,
			timestamp: withdrawEventFromFetched.timestampMs,
			txnDigest: withdrawEventFromFetched.id.txDigest,
		};
	};
}

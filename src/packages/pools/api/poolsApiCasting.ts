import {
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	PoolAmountDynamicField,
	PoolBalanceDynamicField,
	PoolDepositEvent,
	PoolLpDynamicField,
	PoolObject,
	PoolSingleDepositEvent,
	PoolSingleWithdrawEvent,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../poolsTypes";
import {
	PoolAmountDynamicFieldOnChain,
	PoolBalanceDynamicFieldOnChain,
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolDynamicFieldOnChain,
	PoolFieldsOnChain,
	PoolLpDynamicFieldOnChain,
	PoolSingleDepositEventOnChain,
	PoolSingleWithdrawEventOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Pools } from "../pools";
import { Coin } from "../../coin/coin";

export class PoolsApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static poolDynamicFieldsFromSuiObject = (
		suiObject: SuiObjectResponse
	): PoolDynamicFieldOnChain<any> => {
		const type = getObjectType(suiObject);
		if (!type) throw new Error("no type found for pool dynamic fields");

		return {
			data: {
				fields: getObjectFields(suiObject),
				type,
			},
		};
	};

	public static poolObjectFromSuiObject = (suiObject: SuiObjectResponse) => {
		const objectId = getObjectId(suiObject);
		const poolFieldsOnChain = getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		// TODO: handle failed casts ^ ?

		const { coins, weights } = Pools.sortCoinsByWeights(
			poolFieldsOnChain.type_names,
			poolFieldsOnChain.weights.map((weight) => BigInt(weight))
		);
		const poolObject: PoolObject = {
			objectId,
			fields: {
				name: poolFieldsOnChain.name,
				creator: poolFieldsOnChain.creator,
				coins: coins.map((coin) => "0x" + coin),
				weights,
				tradeFee: BigInt(poolFieldsOnChain.swap_fee),
				lpType: Pools.normalizeLpCoinType(poolFieldsOnChain.lp_type),
				curveType: poolFieldsOnChain.curve_type,
			},
		};
		return poolObject;
	};

	public static poolObjectFromPoolCreateEventOnChain = (
		createEvent: PoolCreateEventOnChain
	): PoolObject => {
		const { coins, weights } = Pools.sortCoinsByWeights(
			createEvent.fields.coins,
			createEvent.fields.weights.map((weight) => BigInt(weight))
		);
		return {
			objectId: createEvent.fields.pool_id,
			// type: "",
			fields: {
				creator: createEvent.fields.creator,
				coins: coins.map((coin) => "0x" + coin),
				weights,
				tradeFee: BigInt(createEvent.fields.swap_fee),
				lpType: Pools.normalizeLpCoinType(createEvent.fields.lp_type),
				name: createEvent.fields.name,
				curveType: createEvent.fields.curve_type,
			},
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static poolTradeEventFromOnChain = (
		tradeEventFromFetched: PoolTradeEventOnChain
	): PoolTradeEvent => {
		const event = tradeEventFromFetched.event.moveEvent;
		const fields = event.fields;
		return {
			poolId: fields.pool_id,
			trader: fields.issuer, // issuer
			typeIn: "0x" + fields.type_in,
			amountIn: fields.value_in, // "value" might refer to the constant value function, "amount" is raw amount
			typeOut: "0x" + fields.type_out,
			amountOut: fields.value_out, // "value" might refer to the constant value function, "amount" is raw amount
			timestamp: tradeEventFromFetched.timestamp,
			txnDigest: tradeEventFromFetched.txDigest,
		};
	};

	public static poolSingleDepositEventFromOnChain = (
		singleDepositEventFromFetched: PoolSingleDepositEventOnChain
	): PoolSingleDepositEvent => {
		const event = singleDepositEventFromFetched.event.moveEvent;
		const fields = event.fields;
		return {
			poolId: fields.pool_id,
			depositor: fields.issuer,
			type: "0x" + fields.type,
			amount: fields.value,
			lpMinted: fields.lp_coins_minted,
			timestamp: singleDepositEventFromFetched.timestamp,
			txnDigest: singleDepositEventFromFetched.txDigest,
		};
	};

	public static poolDepositEventFromOnChain = (
		depositEventFromFetched: PoolDepositEventOnChain
	): PoolDepositEvent => {
		const event = depositEventFromFetched.event.moveEvent;
		const fields = event.fields;
		return {
			poolId: fields.pool_id,
			depositor: fields.issuer,
			// TODO: create a function for all this 0x nonsense
			types: fields.types.map((type) => "0x" + type),
			deposits: fields.deposits,
			lpMinted: fields.lp_coins_minted,
			timestamp: depositEventFromFetched.timestamp,
			txnDigest: depositEventFromFetched.txDigest,
		};
	};

	public static poolSingleWithdrawEventFromOnChain = (
		singleWithdrawEventFromFetched: PoolSingleWithdrawEventOnChain
	): PoolSingleWithdrawEvent => {
		const event = singleWithdrawEventFromFetched.event.moveEvent;
		const fields = event.fields;
		return {
			poolId: fields.pool_id,
			withdrawer: fields.issuer,
			type: "0x" + fields.type,
			amount: fields.value,
			lpBurned: fields.lp_coins_burned,
			timestamp: singleWithdrawEventFromFetched.timestamp,
			txnDigest: singleWithdrawEventFromFetched.txDigest,
		};
	};

	public static poolWithdrawEventFromOnChain = (
		withdrawEventFromFetched: PoolWithdrawEventOnChain
	): PoolWithdrawEvent => {
		const event = withdrawEventFromFetched.event.moveEvent;
		const fields = event.fields;
		return {
			poolId: fields.pool_id,
			withdrawer: fields.issuer,
			types: fields.types.map((type) => "0x" + type),
			withdrawn: fields.withdrawn,
			lpBurned: fields.lp_coins_burned,
			timestamp: withdrawEventFromFetched.timestamp,
			txnDigest: withdrawEventFromFetched.txDigest,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Dynamic Fields
	/////////////////////////////////////////////////////////////////////

	public static poolLpDynamicFieldFromOnChain = (
		dynamicField: PoolDynamicFieldOnChain<any>
	) => {
		if (!Pools.isLpKeyType(dynamicField.data.type))
			throw new Error("not lp key type");
		const lpField = dynamicField as PoolLpDynamicFieldOnChain;
		return {
			objectId: lpField.data.fields.id.id,
			value: BigInt(lpField.data.fields.value.fields.value),
		} as PoolLpDynamicField;
	};

	public static poolBalanceDynamicFieldFromOnChain = (
		dynamicField: PoolDynamicFieldOnChain<any>
	) => {
		if (!Pools.isBalanceKeyType(dynamicField.data.type))
			throw new Error("not balance key type");
		const balanceField = dynamicField as PoolBalanceDynamicFieldOnChain;
		return {
			objectId: balanceField.data.fields.id.id,
			value: BigInt(balanceField.data.fields.value),
			coin: Coin.coinTypeFromKeyType(balanceField.data.fields.name.type),
		} as PoolBalanceDynamicField;
	};

	public static poolAmountDynamicFieldFromOnChain = (
		dynamicField: PoolDynamicFieldOnChain<any>
	) => {
		if (!Pools.isAmountKeyType(dynamicField.data.type))
			throw new Error("not amount key type");
		const amountField = dynamicField as PoolAmountDynamicFieldOnChain;
		return {
			objectId: amountField.data.fields.id.id,
			value: BigInt(amountField.data.fields.value),
			coin: "0x" + amountField.data.fields.name.fields.type_name,
		} as PoolAmountDynamicField;
	};
}

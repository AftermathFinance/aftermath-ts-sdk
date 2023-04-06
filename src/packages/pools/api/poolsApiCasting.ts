import {
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
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";
import { Pools } from "../pools";
import { Coin } from "../../coin";

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

		const lpCoinType = new Coin(poolFieldsOnChain.lp_supply.type)
			.innerCoinType;

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
			lpCoinType: Pools.normalizeLpCoinType(lpCoinType),
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

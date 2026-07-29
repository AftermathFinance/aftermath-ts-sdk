import {
	GrpcCasting,
	Helpers,
	type SuiObjectView,
} from "../../../general/utils";
import type { ObjectId } from "../../../types";
import { Coin } from "../../coin";
import type {
	DaoFeePoolOwnerCapObject,
	PoolCoins,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../poolsTypes";
import type {
	DaoFeePoolOwnerCapFieldsOnChain,
	PoolCreateEventOnChain,
	PoolDepositEventOnChain,
	PoolFieldsOnChain,
	PoolTradeEventOnChain,
	PoolWithdrawEventOnChain,
} from "./poolsApiCastingTypes";

export class PoolsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static poolObjectFromSuiObject = (
		suiObject: SuiObjectView
	): PoolObject => {
		const objectId = Helpers.getObjectId(suiObject);
		const objectType = Helpers.getObjectType(suiObject);

		const poolFieldsOnChain = Helpers.getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		// @dev: the LP coin type used to come from the nested `Supply<L>` struct's
		// own `type`, which gRPC's `json` view drops. It is recoverable from the
		// pool's own type instead: the pool is `Pool<L>` where `L` **is** the LP
		// coin (see the `/* (Pool<L>, Coin<L>) */` annotation in `poolsApi.ts`).
		// Verified to yield the byte-identical type string on a real mainnet pool.
		const lpCoinType = Helpers.addLeadingZeroesToType(
			Coin.getInnerCoinType(objectType)
		);

		// @dev: `coin_decimals` is a `vector<u8>`, which gRPC base64-encodes.
		// Indexing it undecoded yields a one-character string, so `Number(...)`
		// of it is NaN — a pool would render with broken decimals rather than
		// throwing. Decode once, up front.
		const coinDecimals =
			poolFieldsOnChain.coin_decimals === undefined
				? undefined
				: GrpcCasting.bytesFieldToNumbers(poolFieldsOnChain.coin_decimals);

		const coins: PoolCoins = poolFieldsOnChain.type_names.reduce(
			(acc, cur, index) => ({
				...acc,
				[Helpers.addLeadingZeroesToType(`0x${cur}`)]: {
					weight: BigInt(poolFieldsOnChain.weights[index]),
					balance:
						BigInt(poolFieldsOnChain.normalized_balances[index]) /
						BigInt(poolFieldsOnChain.decimal_scalars[index]),
					tradeFeeIn: BigInt(poolFieldsOnChain.fees_swap_in[index]),
					tradeFeeOut: BigInt(poolFieldsOnChain.fees_swap_out[index]),
					depositFee: BigInt(poolFieldsOnChain.fees_deposit[index]),
					withdrawFee: BigInt(poolFieldsOnChain.fees_withdraw[index]),
					normalizedBalance: BigInt(
						poolFieldsOnChain.normalized_balances[index]
					),
					decimalsScalar: BigInt(poolFieldsOnChain.decimal_scalars[index]),
					...(coinDecimals ? { decimals: coinDecimals[index] } : {}),
				},
			}),
			{}
		);

		return {
			objectType,
			objectId,
			lpCoinType,
			name: poolFieldsOnChain.name,
			creator: poolFieldsOnChain.creator,
			lpCoinSupply: BigInt(
				GrpcCasting.unwrapStructField(poolFieldsOnChain.lp_supply).value
			),
			illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
			flatness: BigInt(poolFieldsOnChain.flatness),
			lpCoinDecimals: Number(poolFieldsOnChain.lp_decimals),
			coins,
		};
	};

	public static daoFeePoolOwnerCapObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): DaoFeePoolOwnerCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as DaoFeePoolOwnerCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			daoFeePoolId: Helpers.addLeadingZeroesToType(fields.dao_fee_pool_id),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static poolObjectIdfromPoolCreateEventOnChain = (
		eventOnChain: PoolCreateEventOnChain
	): ObjectId => {
		const fields = eventOnChain.parsedJson;
		return fields.pool_id;
	};

	public static poolTradeEventFromOnChain = (
		eventOnChain: PoolTradeEventOnChain
	): PoolTradeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			poolId: fields.pool_id,
			trader: fields.issuer,
			typesIn: fields.types_in.map((type) =>
				Helpers.addLeadingZeroesToType(`0x${type}`)
			),
			amountsIn: fields.amounts_in.map((amount) => BigInt(amount)),
			typesOut: fields.types_out.map((type) =>
				Helpers.addLeadingZeroesToType(`0x${type}`)
			),
			amountsOut: fields.amounts_out.map((amount) => BigInt(amount)),
			timestamp: Number(eventOnChain.timestampMs),
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
			types: fields.types.map((type) =>
				Helpers.addLeadingZeroesToType(`0x${type}`)
			),
			deposits: fields.deposits.map((deposit) => BigInt(deposit)),
			lpMinted: BigInt(fields.lp_coins_minted),
			timestamp: Number(eventOnChain.timestampMs),
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
				Helpers.addLeadingZeroesToType(`0x${type}`)
			),
			withdrawn: fields.withdrawn.map((withdraw) => BigInt(withdraw)),
			lpBurned: BigInt(fields.lp_coins_burned),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

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

/** Converts raw pool objects and events into the SDK's public pool shapes. */
export class PoolsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Converts a Sui object view for `Pool<L>` into a `PoolObject`.
	 *
	 * The caster derives the LP coin type from the object's generic type, decodes
	 * optional coin-decimal bytes, converts on-chain numeric strings to `bigint`,
	 * and pairs every parallel vector by coin type. Balances remain in smallest
	 * units while `normalizedBalance` retains the AMM math scale.
	 *
	 * @param suiObject - The object view returned by a Sui object API.
	 * @returns The normalized pool object used by `Pool` and `CmmmCalculations`.
	 * @throws When required object fields or parallel vector entries are invalid.
	 */
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

	/**
	 * Converts a DAO fee owner-cap object view into its public SDK shape.
	 *
	 * @param data - The object response returned by the Sui object API.
	 * @returns The capability ID and its associated DAO fee pool ID.
	 */
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

	/**
	 * Extracts the created pool object ID from a raw pool-create event.
	 *
	 * @param eventOnChain - The raw pool-create event.
	 * @returns The newly created pool object ID.
	 */
	public static poolObjectIdfromPoolCreateEventOnChain = (
		eventOnChain: PoolCreateEventOnChain
	): ObjectId => {
		const fields = eventOnChain.parsedJson;
		return fields.pool_id;
	};

	/**
	 * Converts a raw pool swap event into a public `PoolTradeEvent`.
	 *
	 * Coin amounts are converted to `bigint` in smallest units, and shortened
	 * on-chain type strings receive their leading zeroes.
	 *
	 * @param eventOnChain - The raw swap event from the indexer.
	 * @returns The normalized swap event.
	 */
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

	/**
	 * Converts a raw pool deposit event into a public `PoolDepositEvent`.
	 *
	 * @param eventOnChain - The raw deposit event from the indexer.
	 * @returns The normalized deposit event with smallest-unit `bigint` amounts.
	 */
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

	/**
	 * Converts a raw pool withdrawal event into a public `PoolWithdrawEvent`.
	 *
	 * @param eventOnChain - The raw withdrawal event from the indexer.
	 * @returns The normalized withdrawal event with smallest-unit `bigint` amounts.
	 */
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

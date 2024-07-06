import {
	DaoFeePoolObject,
	DaoFeePoolOwnerCapObject,
	PoolCoins,
	PoolDepositEvent,
	PoolObject,
	PoolTradeEvent,
	PoolWithdrawEvent,
} from "../poolsTypes";
import {
	PoolCreateEventOnChain,
	PoolFieldsOnChain,
	PoolTradeEventOnChainFields,
	PoolDepositEventFieldsOnChain,
	PoolWithdrawEventFieldsOnChain,
	PoolTradeEventOnChain,
	PoolDepositEventOnChain,
	PoolWithdrawEventOnChain,
	DaoFeePoolFieldsOnChain,
	PoolsIndexerResponse,
	DaoFeePoolOwnerCapFieldsOnChain,
} from "./poolsApiCastingTypes";
import { Coin } from "../../coin";
import { Helpers } from "../../../general/utils";
import { AnyObjectType, ObjectId } from "../../../types";
import { IndexerEventOnChain } from "../../../general/types/castingTypes";
import { SuiObjectResponse } from "@mysten/sui/client";

export class PoolsApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static poolObjectFromSuiObject = (
		suiObject: SuiObjectResponse
	): PoolObject => {
		const objectId = Helpers.getObjectId(suiObject);
		const objectType = Helpers.getObjectType(suiObject);

		const poolFieldsOnChain = Helpers.getObjectFields(
			suiObject
		) as PoolFieldsOnChain;

		const lpCoinType = Helpers.addLeadingZeroesToType(
			new Coin(poolFieldsOnChain.lp_supply.type).innerCoinType
		);

		const coins: PoolCoins = poolFieldsOnChain.type_names.reduce(
			(acc, cur, index) => ({
				...acc,
				[Helpers.addLeadingZeroesToType("0x" + cur)]: {
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
					decimalsScalar: BigInt(
						poolFieldsOnChain.decimal_scalars[index]
					),
					...(poolFieldsOnChain.coin_decimals
						? {
								decimals: Number(
									poolFieldsOnChain.coin_decimals[index]
								),
						  }
						: {}),
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
			lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
			illiquidLpCoinSupply: BigInt(poolFieldsOnChain.illiquid_lp_supply),
			flatness: BigInt(poolFieldsOnChain.flatness),
			lpCoinDecimals: Number(poolFieldsOnChain.lp_decimals),
			coins,
		};
	};

	public static poolObjectsFromIndexerResponse = (
		response: PoolsIndexerResponse
	): PoolObject[] => {
		return response.map((data) => {
			const objectType = Helpers.addLeadingZeroesToType(data.type);
			const poolFieldsOnChain = data.content;
			const lpCoinType = Helpers.addLeadingZeroesToType(
				new Coin(poolFieldsOnChain.lp_supply.type).innerCoinType
			);
			const coins: PoolCoins = poolFieldsOnChain.type_names.reduce(
				(acc, cur, index) => ({
					...acc,
					[Helpers.addLeadingZeroesToType("0x" + cur)]: {
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
						...(poolFieldsOnChain.coin_decimals
							? {
									decimals: Number(
										poolFieldsOnChain.coin_decimals[index]
									),
							  }
							: {}),
					},
				}),
				{}
			);
			const daoFeePoolObject =
				data.daoFeePoolObject.length === 1
					? this.daoFeePoolObjectFromIndexerResponse(
							data.daoFeePoolObject[0]
					  )
					: undefined;
			return {
				objectType,
				lpCoinType,
				coins,
				daoFeePoolObject,
				objectId: Helpers.addLeadingZeroesToType(data.objectId),
				name: poolFieldsOnChain.name,
				creator: poolFieldsOnChain.creator,
				lpCoinSupply: BigInt(poolFieldsOnChain.lp_supply.fields.value),
				illiquidLpCoinSupply: BigInt(
					poolFieldsOnChain.illiquid_lp_supply
				),
				flatness: BigInt(poolFieldsOnChain.flatness),
				lpCoinDecimals: Number(poolFieldsOnChain.lp_decimals),
			};
		});
	};

	public static daoFeePoolObjectFromIndexerResponse = (data: {
		objectId: ObjectId;
		type: AnyObjectType;
		content: {
			fields: DaoFeePoolFieldsOnChain;
		};
	}): DaoFeePoolObject => {
		const objectId = Helpers.addLeadingZeroesToType(data.objectId);
		const objectType = Helpers.addLeadingZeroesToType(data.type);
		const fields = data.content.fields;

		return {
			objectId,
			objectType,
			feeBps: BigInt(fields.fee_bps),
			feeRecipient: Helpers.addLeadingZeroesToType(fields.fee_recipient),
		};
	};

	public static daoFeePoolOwnerCapObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): DaoFeePoolOwnerCapObject => {
		const objectType = Helpers.getObjectType(data);

		const fields = Helpers.getObjectFields(
			data
		) as DaoFeePoolOwnerCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			daoFeePoolId: Helpers.addLeadingZeroesToType(
				fields.dao_fee_pool_id
			),
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
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsIn: fields.amounts_in.map((amount) => BigInt(amount)),
			typesOut: fields.types_out.map((type) =>
				Helpers.addLeadingZeroesToType("0x" + type)
			),
			amountsOut: fields.amounts_out.map((amount) => BigInt(amount)),
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
			deposits: fields.deposits.map((deposit) => BigInt(deposit)),
			lpMinted: BigInt(fields.lp_coins_minted),
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
			withdrawn: fields.withdrawn.map((withdraw) => BigInt(withdraw)),
			lpBurned: BigInt(fields.lp_coins_burned),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Indexer Events
	// =========================================================================

	public static poolTradeEventFromIndexerOnChain = (
		eventOnChain: IndexerEventOnChain<PoolTradeEventOnChainFields>
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

	public static poolDepositEventFromIndexerOnChain = (
		eventOnChain: IndexerEventOnChain<PoolDepositEventFieldsOnChain>
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

	public static poolWithdrawEventFromIndexerOnChain = (
		eventOnChain: IndexerEventOnChain<PoolWithdrawEventFieldsOnChain>
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
}

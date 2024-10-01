import { Helpers } from "../../../general/utils";
import { LimitCreatedOrderEvent, LimitOrderObject } from "../limitTypes";
import {
	LimitCreatedOrderEventOnChain,
	LimitIndexerOrderResponse,
	LimitOrderFieldsOnChain,
} from "./limitApiCastingTypes";

export class LimitApiCasting {
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdLimitOrderEventFromOnChain = (
		eventOnChain: LimitCreatedOrderEventOnChain
	): LimitCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			user: Helpers.addLeadingZeroesToType(fields.user),
			// TODO: - handle user_pk
			userPublicKey: fields.user_pk,
			recipient: Helpers.addLeadingZeroesToType(fields.recipient),
			inputAmount: BigInt(fields.input_amount),
			inputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.input_type).toString()
			),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.output_type).toString()
			),
			gasAmount: BigInt(fields.gas_amount),
			encryptedFields: fields.encrypted_fields,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdOrderEventOnIndexer = (
		response: LimitIndexerOrderResponse
	): LimitOrderObject => {
		const inputCoinType = Helpers.addLeadingZeroesToType(
			String(response.coin_sell)
		);
		const outputCoinType = Helpers.addLeadingZeroesToType(
			String(response.coin_buy)
		);
		const finishTime = response.finish_order_tx_info;
		return {
			objectId: Helpers.addLeadingZeroesToType(response.order_object_id),
			allocatedCoin: {
				coin: inputCoinType,
				amount: BigInt(response.coin_sell_amount),
			},
			buyCoin: {
				coin: outputCoinType,
				amount: BigInt(response.coin_buy_min_amount_out),
			},
			recipient: Helpers.addLeadingZeroesToType(response.recipient),
			created: {
				time: response.create_order_tx_info.timestamp,
				tnxDigest: response.create_order_tx_info.digest,
			},
			finish: finishTime
				? {
						time: finishTime.timestamp,
						tnxDigest: finishTime.digest,
				  }
				: undefined,
			expiry: response.expiry_timestamp_ms,
			status: response.status,
			error: response.error,
		};
	};
}

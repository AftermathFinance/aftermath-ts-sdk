import { Helpers } from "../../../general/utils";
import { LimitOrdersCreatedOrderEvent } from "../limitOrdersTypes";
import { LimitCreatedOrderEventOnChain } from "./limitOrdersApiCastingTypes";

export class LimitOrdersApiCasting {
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdLimitOrderEventFromOnChain = (
		eventOnChain: LimitCreatedOrderEventOnChain
	): LimitOrdersCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			user: Helpers.addLeadingZeroesToType(fields.user),
			// TODO: - should i convert to string?
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
}

import { Helpers } from "../../../general/utils";
import { LimitOrdersCreatedOrderEvent } from "../limitOrdersTypes";
import { LimitOrdersCreatedOrderEventOnChain } from "./limitOrdersCastingTypes";

export class LimitOrdersApiCasting {
	// =========================================================================
	// Chain Event objects
	// =========================================================================

	public static createdLimitOrderEventFromOnChain = (
		eventOnChain: LimitOrdersCreatedOrderEventOnChain
	): LimitOrdersCreatedOrderEvent => {
		const fields = eventOnChain.parsedJson.pos0;
		return {
			orderId: Helpers.addLeadingZeroesToType(fields.order_id),
			recipient: Helpers.addLeadingZeroesToType(fields.recipient),
			owner: Helpers.addLeadingZeroesToType(fields.user),
			inputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.input_type).toString()
			),
			inputAmount: BigInt(fields.input_amount),
			outputType: Helpers.addLeadingZeroesToType(
				"0x" + Buffer.from(fields.output_type).toString()
			),
			gasValue: BigInt(fields.gas_amount),
			encryptedFields: fields.encrypted_fields,
			integratorFeeRecipient: Helpers.addLeadingZeroesToType(
				fields.integrator_fee_recipient
			),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

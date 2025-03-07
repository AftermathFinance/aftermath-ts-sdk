import { EventOnChain } from "../../../general/types/castingTypes";
import {
	BigIntAsString,
	NumberAsString,
	ObjectId,
	SuiAddress,
} from "../../../types";

// =========================================================================
//  DCA onchain Events
// =========================================================================

export type LimitOrdersCreatedOrderEventOnChain = EventOnChain<{
	pos0: {
		order_id: ObjectId;
		user: SuiAddress;
		user_pk: Uint8Array;
		recipient: ObjectId;
		input_type: Uint8Array;
		input_amount: BigIntAsString;
		output_type: Uint8Array;
		gas_amount: BigIntAsString;
		encrypted_fields: Uint8Array;
		integrator_fee_bps: NumberAsString;
		integrator_fee_recipient: SuiAddress;
	};
}>;

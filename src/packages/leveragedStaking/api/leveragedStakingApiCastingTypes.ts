import { BigIntAsString, ObjectId, SuiAddress } from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

// id: {
//     id: '0x05f731df2ecccf4e626247ed6052754d10997b67031d7c0a5ec2b5197c3413f5'
//   },
//   ownership: {
//     type: '0x779b5c547976899f5474f3a5bc0db36ddf4697ad7e5a901db0415c2281d28162::ownership::Ownership<0xefe8b36d5b2e43728cc323298626b83177803521d195cfb11e15b910e892fddf::obligation::ObligationOwnership>',
//     fields: {
//       id: [Object],
//       of: '0x4f5992679d88adc8e6ba3bb1741632bf6af203e2c0a7e0e0e8c65909d4674b09'
//     }
//   }

export interface LeveragedAfSuiPositionFieldsOnChain {
	obligation_key: {
		fields: {
			id: {
				id: ObjectId;
			};
			ownership: {
				fields: {
					of: ObjectId;
				};
			};
		};
	};
	base_afsui_collateral: BigIntAsString;
	total_afsui_collateral: BigIntAsString;
	total_sui_debt: BigIntAsString;
}

export interface LeveragedAfSuiStateFieldsOnChain {
	total_afsui_collateral: BigIntAsString;
	total_sui_debt: BigIntAsString;
	protocol_version: BigIntAsString;
}

// =========================================================================
//  Events
// =========================================================================

export type LeveragedStakedEventOnChain = EventOnChain<{
	user: SuiAddress;
	new_afsui_collateral: BigIntAsString;
	leverage: BigIntAsString;
}>;

export type LeveragedUnstakedEventOnChain = EventOnChain<{
	user: SuiAddress;
	afsui_collateral: BigIntAsString;
}>;

export type LeveragedStakeChangedLeverageEventOnChain = EventOnChain<{
	user: SuiAddress;
	initial_leverage: BigIntAsString;
	new_leverage: BigIntAsString;
}>;

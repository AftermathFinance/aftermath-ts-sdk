import { BigIntAsString } from "../../../types.ts";
import {
	SupplyOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes.ts";
import { SuiObjectResponse } from "@mysten/sui/client";

// =========================================================================
//  Objects
// =========================================================================

export interface NftAmmMarketFieldsOnChain {
	nfts: TableOnChain; // NOTE: should this be object table on chain ?
	supply: SupplyOnChain;
	pool: SuiObjectResponse;
	fractions_amount: BigIntAsString;
}

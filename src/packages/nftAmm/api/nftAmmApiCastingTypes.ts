import { BigIntAsString } from "../../../types";
import {
	SupplyOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";
import type { SuiObjectResponse } from "@mysten/sui/jsonRpc";

// =========================================================================
//  Objects
// =========================================================================

export interface NftAmmMarketFieldsOnChain {
	nfts: TableOnChain; // NOTE: should this be object table on chain ?
	supply: SupplyOnChain;
	pool: SuiObjectResponse;
	fractions_amount: BigIntAsString;
}

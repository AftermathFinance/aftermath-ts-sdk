import type { SuiObjectResponse } from "@mysten/sui/jsonRpc";
import type {
	SupplyOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";
import type { BigIntAsString } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface NftAmmMarketFieldsOnChain {
	nfts: TableOnChain; // NOTE: should this be object table on chain ?
	supply: SupplyOnChain;
	pool: SuiObjectResponse;
	fractions_amount: BigIntAsString;
}

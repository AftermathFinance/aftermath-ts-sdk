import type {
	MoveStructOnChain,
	SupplyOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";
import type { PoolFieldsOnChain } from "../../pools/api/poolsApiCastingTypes";
import type { BigIntAsString } from "../../../types";

// =========================================================================
//  Objects
// =========================================================================

export interface NftAmmMarketFieldsOnChain {
	nfts: TableOnChain; // NOTE: should this be object table on chain ?
	supply: SupplyOnChain;
	/**
	 * A **nested** `Pool<L>` struct — not a whole object response, as this was
	 * previously (and incorrectly) declared. It therefore carries no `objectId`
	 * and, over gRPC, no `type`; see the remarks on
	 * `NftAmmApiCasting.marketObjectFromSuiObject`.
	 */
	pool: MoveStructOnChain<PoolFieldsOnChain>;
	fractions_amount: BigIntAsString;
}

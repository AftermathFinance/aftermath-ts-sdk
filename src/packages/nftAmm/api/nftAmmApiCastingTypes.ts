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

/**
 * Raw NFT AMM market fields read from a Sui object response.
 *
 * Numeric fields are serialized on-chain values. The market caster converts
 * them to `bigint` values in the public `NftAmmMarketObject` shape.
 */
export interface NftAmmMarketFieldsOnChain {
	/** Nested table that stores the market's NFT dynamic fields. */
	nfts: TableOnChain; // NOTE: should this be object table on chain ?
	/** Nested fractionalized-coin supply value. */
	supply: SupplyOnChain;
	/**
	 * A **nested** `Pool<L>` struct — not a whole object response, as this was
	 * previously (and incorrectly) declared. It therefore carries no `objectId`
	 * and, over gRPC, no `type`; see the remarks on
	 * `NftAmmApiCasting.marketObjectFromSuiObject`.
	 */
	pool: MoveStructOnChain<PoolFieldsOnChain>;
	/** Fractionalized coin amount represented by one NFT, serialized as text. */
	fractions_amount: BigIntAsString;
}

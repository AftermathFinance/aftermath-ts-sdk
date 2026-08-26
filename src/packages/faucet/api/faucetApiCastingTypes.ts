import type { EventOnChain } from "../../../general/types/castingTypes";
import type {
	BigIntAsString,
	SuiAddress,
} from "../../../general/types/generalTypes";

// =========================================================================
//  Events
// =========================================================================

/**
 * On-chain fields for a faucet `MintedCoin` event.
 *
 * The event amount is serialized as a string because it can exceed JavaScript's
 * safe integer range.
 */
export type FaucetMintCoinEventOnChain = EventOnChain<{
	amount: BigIntAsString;
	user: SuiAddress;
}>;

/**
 * On-chain fields for a faucet `AddedCoin` event.
 */
export type FaucetAddCoinEventOnChain = EventOnChain<{
	default_mint_amount: BigIntAsString;
}>;

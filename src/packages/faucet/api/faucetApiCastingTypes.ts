import type { EventOnChain } from "../../../general/types/castingTypes";
import type {
	BigIntAsString,
	SuiAddress,
} from "../../../general/types/generalTypes";

// =========================================================================
//  Events
// =========================================================================

export type FaucetMintCoinEventOnChain = EventOnChain<{
	amount: BigIntAsString;
	user: SuiAddress;
}>;

export type FaucetAddCoinEventOnChain = EventOnChain<{
	default_mint_amount: BigIntAsString;
}>;

import {
	BigIntAsString,
	SuiAddress,
} from "../../../general/types/generalTypes";
import { EventOnChain } from "../../../general/types/castingTypes";
import { CoinType } from "../../coin/coinTypes";

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

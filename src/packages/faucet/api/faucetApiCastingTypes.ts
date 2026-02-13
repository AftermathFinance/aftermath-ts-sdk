import {
	BigIntAsString,
	SuiAddress,
} from "../../../general/types/generalTypes.ts";
import { EventOnChain } from "../../../general/types/castingTypes.ts";
import { CoinType } from "../../coin/coinTypes.ts";

// =========================================================================
//  Events
// =========================================================================

export type FaucetMintCoinEventOnChain = EventOnChain<{
	amount: BigIntAsString;
	type: CoinType;
	user: SuiAddress;
}>;

export type FaucetAddCoinEventOnChain = EventOnChain<{
	symbol: string;
	type: CoinType;
}>;

import { SuiAddress } from "@mysten/sui.js";
import { BigIntAsString } from "../../../general/types/generalTypes";
import { EventOnChain } from "../../../general/types/castingTypes";
import { CoinType } from "../../coin/coinTypes";

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

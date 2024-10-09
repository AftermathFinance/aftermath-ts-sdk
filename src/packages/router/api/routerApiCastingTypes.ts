import {
	AnyObjectType,
	BigIntAsString,
	CoinType,
	RouterProtocolName,
	SuiAddress,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Events
// =========================================================================

export type RouterTradeEventOnChain = EventOnChain<{
	swapper: SuiAddress;
	type_in: CoinType;
	amount_in: BigIntAsString;
	type_out: CoinType;
	amount_out: BigIntAsString;
	// referrer: Option<SuiAddress>;
	router_fee: BigIntAsString;
	router_fee_recipient: SuiAddress;
}>;

// =========================================================================
//  Indexer
// =========================================================================

export type RouterProtocolNameIndexerData = {
	protocol:
		| Exclude<RouterProtocolName, "Aftermath" | "Kriya" | "SuiSwap">
		| {
				Aftermath: {
					pool_type: "Either" | "Stable" | "Uncorrelated" | "Both";
					extension: "Any" | "Direct" | "DaoFee" | "All";
				};
		  }
		| {
				Kriya: {
					pool_type: "Either" | "Stable" | "Uncorrelated" | "Both";
				};
		  }
		| {
				SuiSwap: {
					pool_type: "Either" | "Stable" | "Uncorrelated" | "Both";
				};
		  };
};

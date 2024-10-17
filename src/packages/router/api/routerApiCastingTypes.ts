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

// type IndexerPoolType = "Any" | "Stable" | "Uncorrelated";
type IndexerPoolType = "Both" | "Stable" | "Uncorrelated";

export type RouterProtocolNameIndexerData =
	| {
			protocol: Exclude<
				RouterProtocolName,
				"Aftermath" | "Kriya" | "SuiSwap" | "BlueMove"
			>;
	  }
	| {
			protocol: "Aftermath";
			pool_type: IndexerPoolType;
			// extension: "Any" | "Direct" | "DaoFee";
			extension: "All" | "Direct" | "DaoFee";
	  }
	| {
			protocol: "Kriya" | "SuiSwap" | "BlueMove";
			pool_type: IndexerPoolType;
	  };

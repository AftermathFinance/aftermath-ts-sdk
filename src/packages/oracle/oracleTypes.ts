import { BCS, getSuiMoveConfig } from "@mysten/bcs";
import { IFixed, Object, Timestamp } from "../../general/types/generalTypes";

// =========================================================================
//  Name Only
// =========================================================================

export type OracleCoinSymbol = string;

// =========================================================================
//  BCS - Binary Canonical Serialization
// =========================================================================

export const bcs = new BCS(getSuiMoveConfig());

bcs.registerStructType("PriceFeed", {
	id: "UID",
	pyth_price_info_id: "ID",
	symbol: BCS.STRING,
	price: BCS.U256,
	timestamp: BCS.U64,
});

bcs.registerStructType("PriceFeedStorage", { id: "UID" });

bcs.registerStructType("AuthorityCap", { id: "UID" });

// =========================================================================
//  Objects
// =========================================================================

export interface PriceFeed extends Object {
	symbol: OracleCoinSymbol;
	price: IFixed;
	decimal: bigint;
	timestamp: Timestamp;
}

export interface PriceFeedStorage extends Object {}

export interface AuthorityCap extends Object {}

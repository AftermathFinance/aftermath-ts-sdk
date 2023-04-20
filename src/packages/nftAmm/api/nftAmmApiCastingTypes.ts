import { SuiAddress } from "@mysten/sui.js/dist/types";
import { BigIntAsString, CoinType, PoolName } from "../../../types";
import {
	SupplyOnChain,
	TableOnChain,
} from "../../../general/types/castingTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface MarketFieldsOnChain {
	nfts: TableOnChain; // NOTE: should this be object table on chain
	supply: SupplyOnChain;
	pool: any;
	fractions_amount: BigIntAsString;
}

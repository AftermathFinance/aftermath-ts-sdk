import { PoolFields } from "../../../external/nojo";
import { CoinType } from "../../coin/coinTypes";
import { RouterSerializablePool } from "../../router/routerTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export type NojoPoolObject = {
	fields: PoolFields;
	typeArgs: [CoinType, CoinType];
};

export const isNojoPoolObject = (
	pool: RouterSerializablePool
): pool is NojoPoolObject => {
	return "typeArgs" in pool;
};

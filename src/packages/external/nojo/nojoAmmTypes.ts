import { PoolFields } from "../../../external/nojo";
import { CoinType } from "../../coin/coinTypes";
import { RouterSynchronousSerializablePool } from "../../router/routerTypes";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export type NojoPoolObject = {
	fields: PoolFields;
	typeArgs: [CoinType, CoinType];
};

export const isNojoPoolObject = (
	pool: RouterSynchronousSerializablePool
): pool is NojoPoolObject => {
	return "typeArgs" in pool;
};

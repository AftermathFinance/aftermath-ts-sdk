import {
	SuiAddress,
	Balance,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { FlowXPoolObject } from "../../../../external/flowX/flowXTypes";

class FlowXRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: FlowXPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.coinTypeX, pool.coinTypeY];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "FlowX";
	readonly expectedGasCostPerHop = BigInt(50_000_000); // 0.05 SUI
	readonly noHopsAllowed = true;

	readonly pool: FlowXPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	// =========================================================================
	//  Functions
	// =========================================================================

	// =========================================================================
	//  Functions
	// =========================================================================

	getSpotPrice = (_: { coinInType: CoinType; coinOutType: CoinType }) => {
		throw new Error("uncallable");
	};

	getTradeAmountOut = (_: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		throw new Error("uncallable");
	};

	tradeTx = (inputs: RouterPoolTradeTxInputs) => {
		return inputs.provider.Router().FlowX().tradeTx(inputs);
	};

	getTradeAmountIn = (_: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		throw new Error("uncallable");
	};

	getUpdatedPoolBeforeTrade = (_: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => new FlowXRouterPool(this.pool, this.network);

	getUpdatedPoolAfterTrade = (_: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => new FlowXRouterPool(this.pool, this.network);
}

export default FlowXRouterPool;

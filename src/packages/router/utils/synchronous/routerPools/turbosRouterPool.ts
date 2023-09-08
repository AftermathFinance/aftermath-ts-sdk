import {
	Balance,
	SuiAddress,
	Slippage,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { AftermathApi } from "../../../../../general/providers";
import { TurbosPoolObject } from "../../../../external/turbos/turbosTypes";

class TurbosRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: TurbosPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.id;
		this.coinTypes = [pool.coinTypeA, pool.coinTypeB];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "Turbos";
	readonly expectedGasCostPerHop = BigInt(50_000_000); // 0.05 SUI
	readonly noHopsAllowed = true;

	readonly pool: TurbosPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

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
		if (!inputs.tx.blockData.sender)
			throw new Error("no sender for tx set (required for turbos txs)");

		return inputs.provider
			.Router()
			.Turbos()
			.tradeTx({
				...inputs,
				pool: this.pool,
			});
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
	}): RouterPoolInterface => new TurbosRouterPool(this.pool, this.network);

	getUpdatedPoolAfterTrade = (_: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => new TurbosRouterPool(this.pool, this.network);
}

export default TurbosRouterPool;

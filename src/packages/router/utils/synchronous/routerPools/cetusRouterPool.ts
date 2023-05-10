import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	Balance,
	Slippage,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import { RouterPoolInterface } from "../interfaces/routerPoolInterface";
import { AftermathApi } from "../../../../../general/providers";
import { CetusPoolObject } from "../../../../external/cetus/cetusTypes";

class CetusRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: CetusPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.id;
		this.coinTypes = [pool.coinTypeA, pool.coinTypeB];
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Cetus";
	readonly expectedGasCostPerHop = BigInt(9_000_000); // 0.009 SUI
	readonly noHopsAllowed = true;

	readonly pool: CetusPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

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

	addTradeCommandToTransaction = (inputs: {
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInAmount: Balance;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}) => {
		// PRODUCTION: handle slippage !
		return inputs.provider
			.Router()
			.Cetus()
			.Helpers.tradeTx({
				...inputs,
				coinInId: inputs.coinIn,
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
	}): RouterPoolInterface => new CetusRouterPool(this.pool, this.network);

	getUpdatedPoolAfterTrade = (_: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => new CetusRouterPool(this.pool, this.network);

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private isCoinA = (coin: CoinType) => coin === this.pool.coinTypeA;
}

export default CetusRouterPool;

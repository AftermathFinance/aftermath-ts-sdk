import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import {
	Balance,
	RouterExternalFee,
	Slippage,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import { RouterPoolInterface } from "../interfaces/routerPoolInterface";
import { AftermathApi } from "../../../../../general/providers";
import { TurbosPoolObject } from "../../../../external/turbos/turbosTypes";

class TurbosRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: TurbosPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.id;
		this.coinTypes = [pool.coinTypeA, pool.coinTypeB];
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Turbos";
	readonly expectedGasCostPerHop = BigInt(9_000_000); // 0.009 SUI
	readonly noHopsAllowed = true;

	readonly pool: TurbosPoolObject;
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

	tradeTx = (inputs: {
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInAmount: Balance;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedCoinOutAmount: Balance;
		slippage: Slippage;
		tradePotato: TransactionArgument;
		isFirstSwapForPath: boolean;
		isLastSwapForPath: boolean;
		referrer?: SuiAddress;
		externalFee?: RouterExternalFee;
	}) => {
		// PRODUCTION: handle slippage !
		if (!inputs.tx.blockData.sender)
			throw new Error("no sender for tx set (required for turbos txs)");

		return inputs.provider
			.Router()
			.Turbos()
			.tradeTx({
				...inputs,
				coinInId: inputs.coinIn,
				pool: this.pool,
				walletAddress: inputs.tx.blockData.sender,
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

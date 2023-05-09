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
import { CetusRouterPoolObject } from "../../../../external/cetus/cetusTypes";

class CetusRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: CetusRouterPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.poolObjectId;
		this.coinTypes = [pool.coinTypeA, pool.coinTypeB];
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Cetus";
	readonly expectedGasCostPerHop = BigInt(9_000_000); // 0.009 SUI
	readonly noHopsAllowed = true;

	readonly pool: CetusRouterPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		const smallestTradeResult = this.pool.tradeResults.amounts[0];
		const spotPriceAOverB =
			Number(smallestTradeResult.amountIn) /
			Number(smallestTradeResult.amountOut);

		if (this.isCoinA(inputs.coinInType)) return spotPriceAOverB;

		return 1 / spotPriceAOverB;
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		const { coinInAmount, coinInType } = inputs;

		if (!this.isCoinA(coinInType))
			return this.getTradeAmountIn({
				...inputs,
				coinInType: inputs.coinOutType,
				coinOutType: inputs.coinInType,
				coinOutAmount: coinInAmount,
			});

		const tradeAmounts = this.pool.tradeResults.amounts;

		const possibleLowerBoundIndex = tradeAmounts.findIndex(
			(amounts) => coinInAmount > amounts.amountIn
		);
		const lowerBoundIndex =
			possibleLowerBoundIndex < 0
				? tradeAmounts.length - 1
				: possibleLowerBoundIndex;

		const upperBoundIndex =
			lowerBoundIndex + 1 >= tradeAmounts.length
				? lowerBoundIndex
				: lowerBoundIndex + 1;

		const lowerBound = tradeAmounts[lowerBoundIndex].amountOut;
		const upperBound = tradeAmounts[upperBoundIndex].amountOut;

		const difference = upperBound - lowerBound;
		const coinOutAmount = lowerBound + difference / BigInt(2);

		if (coinOutAmount <= 0) throw new Error("coinOutAmount <= 0");

		return coinOutAmount;

		// const curve = this.pool.curve;

		// const coinOutAmount =
		// 	BigInt(Math.floor(Number(coinInAmount) * curve.slope)) +
		// 	curve.intercept;

		// return coinOutAmount;
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

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		const { coinOutAmount, coinInType } = inputs;

		if (!this.isCoinA(coinInType))
			return this.getTradeAmountOut({
				...inputs,
				coinInType: inputs.coinOutType,
				coinOutType: inputs.coinInType,
				coinInAmount: coinOutAmount,
			});

		const tradeAmounts = this.pool.tradeResults.amounts;

		const possibleLowerBoundIndex = tradeAmounts.findIndex(
			(amounts) => coinOutAmount > amounts.amountOut
		);
		const lowerBoundIndex =
			possibleLowerBoundIndex < 0
				? tradeAmounts.length - 1
				: possibleLowerBoundIndex;

		const upperBoundIndex =
			lowerBoundIndex + 1 >= tradeAmounts.length
				? lowerBoundIndex
				: lowerBoundIndex + 1;

		const lowerBound = tradeAmounts[lowerBoundIndex].amountIn;
		const upperBound = tradeAmounts[upperBoundIndex].amountIn;

		const difference = upperBound - lowerBound;
		const coinInAmount = lowerBound + difference / BigInt(2);

		if (coinInAmount <= 0) throw new Error("coinInAmount <= 0");

		return coinInAmount;

		// const curve = this.pool.curve;

		// const coinInAmount =
		// 	Number(coinOutAmount - curve.intercept) / curve.slope;

		// if (coinInAmount <= 0) throw new Error("coinInAmount <= 0");

		// return BigInt(Math.floor(coinInAmount));
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

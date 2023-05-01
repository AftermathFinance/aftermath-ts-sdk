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
} from "../../../../types";
import { CoinType } from "../../../coin/coinTypes";
import { RouterPoolInterface } from "../routerPoolInterface";
import { AftermathApi } from "../../../../general/providers";
import { DeepBookPoolObject } from "../../../external/deepBook/deepBookTypes";
import { Helpers } from "../../../../general/utils";

class DeepBookRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: DeepBookPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.baseCoin, pool.quoteCoin];
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "DeepBook";
	// readonly limitToSingleHops = false;
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI

	readonly pool: DeepBookPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}): number => {};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		const { amountOut } = this.getTradeAmountOutAndPoolAfterTrade(inputs);
		return amountOut;
	};

	addTradeCommandToTransaction = (inputs: {
		provider: AftermathApi;
		tx: TransactionBlock;
		coinIn: ObjectId | TransactionArgument;
		coinInType: CoinType;
		coinOutType: CoinType;
		expectedAmountOut: Balance;
		slippage: Slippage;
		referrer?: SuiAddress;
	}): TransactionArgument => {
		const minAmountOut = BigInt(
			Math.ceil((1 - inputs.slippage) * Number(inputs.expectedAmountOut))
		);
		return inputs.provider
			.Router()
			.DeepBook()
			.addSwapCommandToTransaction(
				inputs.tx,
				this.poolClass,
				inputs.coinIn,
				inputs.coinInType,
				minAmountOut
			);
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {};

	getUpdatedPoolBeforeTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface =>
		this.getUpdatedPoolAfterTrade({
			...inputs,
			coinInAmount: -inputs.coinInAmount,
			coinOutAmount: -inputs.coinOutAmount,
		});

	getUpdatedPoolAfterTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		const { poolAfterTrade } = this.getTradeAmountOutAndPoolAfterTrade({
			...inputs,
			coinInType: inputs.coinIn,
			coinOutType: inputs.coinOut,
		});

		return poolAfterTrade;
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private getTradeAmountOutAndPoolAfterTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): {
		amountOut: Balance;
		poolAfterTrade: DeepBookRouterPool;
	} => {
		const { coinInAmount, coinInType } = inputs;

		const isCoinInBaseCoin = this.isBaseCoinType(coinInType);

		const bookState = isCoinInBaseCoin ? this.pool.asks : this.pool.bids;
		const otherSideBookState = isCoinInBaseCoin
			? this.pool.bids
			: this.pool.asks;

		let newBookState = Helpers.deepCopy(bookState);
		let totalAmountOut = BigInt(0);
		let amountInRemaining = coinInAmount;

		for (const [index, depth] of bookState.depths.entries()) {
			const price = bookState.prices[index];

			const canFillAll = depth >= amountInRemaining;
			const amountToFill = canFillAll ? amountInRemaining : depth;

			const amountOut = BigInt(Math.floor(Number(amountToFill) * price));

			const newPrices = canFillAll
				? newBookState.prices.slice(1)
				: newBookState.prices;
			const newDepths = canFillAll
				? newBookState.depths.slice(1)
				: (() => {
						newBookState.depths[index] -= amountToFill;
						return newBookState.depths;
				  })();

			newBookState = {
				...newBookState,
				prices: newPrices,
				depths: newDepths,
			};
			totalAmountOut += amountOut;
			amountInRemaining -= amountToFill;

			if (amountInRemaining <= 0) break;
		}

		const poolObjectAfterTrade: DeepBookPoolObject = {
			...this.pool,
			bids: isCoinInBaseCoin ? otherSideBookState : newBookState,
			asks: isCoinInBaseCoin ? newBookState : otherSideBookState,
		};
		const poolAfterTrade = new DeepBookRouterPool(
			poolObjectAfterTrade,
			this.network
		);

		return {
			amountOut: totalAmountOut,
			poolAfterTrade,
		};
	};

	private isBaseCoinType = (coin: CoinType) => coin === this.pool.baseCoin;
}

export default DeepBookRouterPool;

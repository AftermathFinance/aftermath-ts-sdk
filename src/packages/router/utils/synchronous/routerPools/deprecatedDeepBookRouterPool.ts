import { TransactionArgument } from "@mysten/sui.js/transactions";
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
import {
	DeepBookPoolObject,
	DeepBookPriceRange,
} from "../../../../external/deepBook/deepBookTypes";
import { Helpers } from "../../../../../general/utils";
import { Coin } from "../../../../coin";
import { DeepBookApi } from "../../../../external/deepBook/deepBookApi";

class DeprecatedDeepBookRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: DeepBookPoolObject, network: SuiNetwork) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.baseCoinType, pool.quoteCoinType];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "DeepBook";
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI
	readonly noHopsAllowed = false;

	readonly pool: DeepBookPoolObject;
	readonly network: SuiNetwork;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	// =========================================================================
	//  Functions
	// =========================================================================

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}): number => {
		// NOTE: should this be looking at the spread ?
		const askPrice =
			this.pool.asks.length > 0 ? this.pool.asks[0].price : 0;
		const bidPrice =
			this.pool.bids.length > 0 ? this.pool.bids[0].price : 0;

		const spotPrice = this.isBaseCoinType(inputs.coinInType)
			? askPrice
			: bidPrice;

		return spotPrice;
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}) => {
		throw new Error("deprecated");
		// const { amountOut } = this.getTradeAmountOutAndPoolAfterTrade(inputs);
		// return amountOut;
	};

	tradeTx = (inputs: RouterPoolTradeTxInputs): TransactionArgument => {
		return inputs.provider
			.Router()
			.DeepBook()
			.tradeTx({
				...inputs,
				pool: this.pool,
			});
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}) => {
		throw new Error("deprecated");
		// return BigInt(0);
	};

	getUpdatedPoolBeforeTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		const { coinInType, coinInAmount, coinOutAmount } = inputs;
		const isCoinInBaseCoin = this.isBaseCoinType(coinInType);

		const price = isCoinInBaseCoin
			? Number(coinInAmount) / Number(coinOutAmount)
			: Number(coinOutAmount) / Number(coinInAmount);

		const filledPriceRange: DeepBookPriceRange = {
			depth: coinInAmount,
			price,
		};

		const bids = isCoinInBaseCoin
			? [filledPriceRange, ...this.pool.bids]
			: this.pool.bids;
		const asks = !isCoinInBaseCoin
			? [filledPriceRange, ...this.pool.asks]
			: this.pool.asks;

		const newPoolObject: DeepBookPoolObject = {
			...this.pool,
			bids,
			asks,
		};

		return new DeprecatedDeepBookRouterPool(newPoolObject, this.network);
	};

	getUpdatedPoolAfterTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		const { poolAfterTrade } =
			this.getTradeAmountOutAndPoolAfterTrade(inputs);
		return poolAfterTrade;
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	private getTradeAmountOutAndPoolAfterTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): {
		amountOut: Balance;
		poolAfterTrade: DeprecatedDeepBookRouterPool;
	} => {
		const { coinInAmount, coinInType } = inputs;

		// TODO: properly handle tick sizes

		const isCoinInBaseCoin = this.isBaseCoinType(coinInType);

		const [bookState, otherSideBookState] = isCoinInBaseCoin
			? [this.pool.asks, this.pool.bids]
			: [this.pool.bids, this.pool.asks];

		let newBookState = Helpers.deepCopy(bookState);
		let totalAmountOut = BigInt(0);

		const coinInAmountMinusFee =
			coinInAmount -
			BigInt(Math.floor(Number(coinInAmount) * this.pool.takerFeeRate));

		let amountInRemaining = coinInAmountMinusFee;

		for (const priceAndDepth of bookState) {
			const price = priceAndDepth.price;
			const depth = priceAndDepth.depth;

			const canFillAll = depth >= amountInRemaining;
			const amountToFill = canFillAll ? amountInRemaining : depth;

			const amountOut = BigInt(Math.floor(Number(amountToFill) / price));

			newBookState = canFillAll
				? (() => {
						newBookState[0].depth -= amountToFill;
						return newBookState;
				  })()
				: newBookState.slice(1);

			totalAmountOut += amountOut;
			amountInRemaining -= amountToFill;

			if (amountInRemaining <= 0) break;
		}

		const [bids, asks] = isCoinInBaseCoin
			? [otherSideBookState, newBookState]
			: [newBookState, otherSideBookState];
		const poolObjectAfterTrade: DeepBookPoolObject = {
			...this.pool,
			bids,
			asks,
		};

		const poolAfterTrade = new DeprecatedDeepBookRouterPool(
			poolObjectAfterTrade,
			this.network
		);
		return {
			amountOut: totalAmountOut,
			poolAfterTrade,
		};
	};

	private isBaseCoinType = (coin: CoinType) =>
		Helpers.addLeadingZeroesToType(coin) ===
		Helpers.addLeadingZeroesToType(this.pool.baseCoinType);
}

export default DeprecatedDeepBookRouterPool;

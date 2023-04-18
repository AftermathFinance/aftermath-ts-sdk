import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Balance, Slippage, SuiNetwork, UniqueId } from "../../../../types";
import { CoinType } from "../../../coin/coinTypes";
import { RouterPoolInterface } from "../routerPoolInterface";
import { Helpers } from "../../../../general/utils";
import { Pool, PoolFields } from "@kunalabs-io/amm/src/amm/pool/structs";
import { AftermathApi } from "../../../../general/providers";

export type NojoPoolObject = {
	fields: PoolFields;
	typeArgs: [CoinType, CoinType];
};

class NojoRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: NojoPoolObject, network: SuiNetwork) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.fields.id;
		this.coinTypes = pool.typeArgs;
		this.poolClass = new Pool(pool.typeArgs, pool.fields);
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Nojo";
	// readonly limitToSingleHops = false;
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI

	readonly pool: NojoPoolObject;
	readonly network: SuiNetwork;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private readonly poolClass: Pool;
	private readonly basisPointsIn100Percent = 10000;

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		const spotPriceAOverB =
			Number(this.pool.fields.balanceA) /
			Number(this.pool.fields.balanceB);

		if (this.isCoinA(inputs.coinInType)) return spotPriceAOverB;

		return 1 / spotPriceAOverB;
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): {
		coinOutAmount: Balance;
		error?: string;
	} => {
		const { coinInAmount, coinInType } = inputs;

		const [poolBalanceCoinIn, poolBalanceCoinOut] = this.isCoinA(coinInType)
			? [this.pool.fields.balanceA, this.pool.fields.balanceB]
			: [this.pool.fields.balanceB, this.pool.fields.balanceA];

		const lpFee =
			(Number(coinInAmount) / this.basisPointsIn100Percent) *
			(Number(this.pool.fields.lpFeeBps) / this.basisPointsIn100Percent);

		const coinInAmountWithFee = Number(coinInAmount) - lpFee;

		const denominator = Number(poolBalanceCoinIn) + coinInAmountWithFee;
		const coinOutAmount =
			(coinInAmountWithFee / denominator) *
			(Number(poolBalanceCoinOut) / denominator);

		return {
			coinOutAmount: BigInt(Math.floor(coinOutAmount)),
		};
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
	}): {
		tx: TransactionBlock;
		coinOut: TransactionArgument;
	} => {
		const minAmountOut = BigInt(
			Math.ceil((1 - inputs.slippage) * Number(inputs.expectedAmountOut))
		);
		return inputs.provider
			.Router()
			.Nojo()
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
	}): {
		coinInAmount: Balance;
		error?: string;
	} => {
		const { coinOutAmount, coinInType } = inputs;

		const [poolBalanceCoinIn, poolBalanceCoinOut] = this.isCoinA(coinInType)
			? [this.pool.fields.balanceA, this.pool.fields.balanceB]
			: [this.pool.fields.balanceB, this.pool.fields.balanceA];

		const numerator = Number(
			// @ts-ignore
			coinOutAmount * poolBalanceCoinIn - poolBalanceCoinOut
		);
		const denominator =
			(1 - Number(coinOutAmount)) *
			(1 /
				(1 -
					Number(this.pool.fields.lpFeeBps) /
						this.basisPointsIn100Percent));

		const coinInAmount = numerator / denominator;

		return {
			coinInAmount: BigInt(Math.floor(coinInAmount)),
		};
	};

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
		let newPoolObject = Helpers.deepCopy(this.pool);

		if (this.isCoinA(inputs.coinIn)) {
			// @ts-ignore
			newPoolObject.fields.balanceA += inputs.coinInAmount;
			// @ts-ignore
			newPoolObject.fields.balanceB -= inputs.coinOutAmount;
		} else {
			// @ts-ignore
			newPoolObject.fields.balanceA -= inputs.coinInAmount;
			// @ts-ignore
			newPoolObject.fields.balanceB += inputs.coinOutAmount;
		}

		return new NojoRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private isCoinA = (coin: CoinType) => coin === this.pool.typeArgs[0];
}

export default NojoRouterPool;

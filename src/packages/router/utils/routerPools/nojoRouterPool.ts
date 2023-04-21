import {
	ObjectId,
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { Balance, Slippage, SuiNetwork, UniqueId } from "../../../../types";
import { CoinType } from "../../../coin/coinTypes";
import { RouterPoolInterface } from "../routerPoolInterface";
import {
	Pool,
	PoolFields,
	Balance as NojoBalance,
} from "../../../../external/nojo";
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
			Number(this.pool.fields.balanceA.value) /
			Number(this.pool.fields.balanceB.value);

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

		const [poolBalanceCoinIn, poolBalanceCoinOut] = this.isCoinA(coinInType)
			? [this.pool.fields.balanceA.value, this.pool.fields.balanceB.value]
			: [
					this.pool.fields.balanceB.value,
					this.pool.fields.balanceA.value,
			  ];

		const lpFee =
			(Number(coinInAmount) * Number(this.pool.fields.lpFeeBps)) /
			this.basisPointsIn100Percent;

		const coinInAmountWithFee = Number(coinInAmount) - lpFee;

		const denominator = Number(poolBalanceCoinIn) + coinInAmountWithFee;
		const coinOutAmount =
			(coinInAmountWithFee * Number(poolBalanceCoinOut)) / denominator;

		if (coinOutAmount <= 0) throw new Error("coinOutAmount <= 0");

		if (coinOutAmount >= poolBalanceCoinOut)
			throw new Error("coinOutAmount >= poolBalanceCoinOut");

		return BigInt(Math.floor(coinOutAmount));
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
	}): Balance => {
		const { coinOutAmount, coinInType } = inputs;

		const [poolBalanceCoinIn, poolBalanceCoinOut] = this.isCoinA(coinInType)
			? [this.pool.fields.balanceA.value, this.pool.fields.balanceB.value]
			: [
					this.pool.fields.balanceB.value,
					this.pool.fields.balanceA.value,
			  ];

		if (coinOutAmount >= poolBalanceCoinOut)
			throw new Error("coinOutAmount >= poolBalanceCoinOut");

		const part1 = 1 - Number(coinOutAmount) / Number(poolBalanceCoinOut);
		const part2 =
			(Number(coinOutAmount) * Number(poolBalanceCoinIn)) /
			Number(poolBalanceCoinOut);
		const part3 =
			1 -
			Number(this.pool.fields.lpFeeBps) / this.basisPointsIn100Percent;

		const coinInAmount = BigInt(Math.floor(part1 * part2 * part3));

		if (coinInAmount <= 0) throw new Error("coinInAmount <= 0");

		return coinInAmount;
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
		const [newBalanceA, newBalanceB] = this.isCoinA(inputs.coinIn)
			? [
					this.pool.fields.balanceA.value + inputs.coinInAmount,
					this.pool.fields.balanceB.value - inputs.coinOutAmount,
			  ]
			: [
					this.pool.fields.balanceA.value - inputs.coinOutAmount,
					this.pool.fields.balanceB.value + inputs.coinInAmount,
			  ];

		const newPool: NojoPoolObject = {
			...this.pool,
			fields: {
				...this.pool.fields,
				balanceA: new NojoBalance(
					this.pool.fields.balanceA.$typeArg,
					newBalanceA
				),
				balanceB: new NojoBalance(
					this.pool.fields.balanceB.$typeArg,
					newBalanceB
				),
			},
		};

		return new NojoRouterPool(newPool, this.network);
	};

	/////////////////////////////////////////////////////////////////////
	//// Private Methods
	/////////////////////////////////////////////////////////////////////

	private isCoinA = (coin: CoinType) => coin === this.pool.typeArgs[0];
}

export default NojoRouterPool;

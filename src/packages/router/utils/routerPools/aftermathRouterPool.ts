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
import { PoolObject } from "../../../pools/poolsTypes";
import { RouterPoolInterface } from "../routerPoolInterface";
import { Pool } from "../../../pools";
import { Casting, Helpers } from "../../../../general/utils";
import { AftermathApi } from "../../../../general/providers";

class AftermathRouterPool implements RouterPoolInterface {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(pool: PoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = Object.keys(pool.coins);
		this.poolClass = new Pool(pool, network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	readonly protocolName = "Aftermath";
	// readonly limitToSingleHops = false;
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI

	readonly pool: PoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private readonly poolClass: Pool;

	/////////////////////////////////////////////////////////////////////
	//// Functions
	/////////////////////////////////////////////////////////////////////

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		return this.poolClass.getSpotPrice(inputs);
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		// withdraw
		if (inputs.coinInType === this.pool.lpCoinType) {
			const lpRatio = this.poolClass.getWithdrawLpRatio({
				lpCoinAmountOut: inputs.coinInAmount,
			});

			const amountsOuts = this.poolClass.getWithdrawAmountsOut({
				lpRatio,
				amountsOutDirection: {
					[inputs.coinOutType]: inputs.coinInAmount,
				},
				referral: inputs.referrer !== undefined,
			});

			return amountsOuts[inputs.coinOutType];
		}

		// deposit
		if (inputs.coinOutType === this.pool.lpCoinType) {
			const { lpAmountOut } = this.poolClass.getDepositLpAmountOut({
				amountsIn: {
					[inputs.coinInType]: inputs.coinInAmount,
				},
				referral: inputs.referrer !== undefined,
			});

			return lpAmountOut;
		}

		// trade
		return this.poolClass.getTradeAmountOut(inputs);
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
	}) => {
		// withdraw
		if (inputs.coinInType === this.pool.lpCoinType) {
		}

		// deposit
		if (inputs.coinOutType === this.pool.lpCoinType) {
			const expectedLpRatio = this.poolClass.getWithdrawLpRatio({
				lpCoinAmountOut: inputs.expectedAmountOut,
			});

			inputs.provider
				.Pools()
				.Helpers.addMultiCoinDepositCommandToTransaction(
					inputs.tx,
					this.pool.objectId,
					// this is beacuse typescript complains for some reason otherwise
					typeof inputs.coinIn === "string"
						? [inputs.coinIn]
						: [inputs.coinIn],
					[inputs.coinInType],
					Casting.numberToFixedBigInt(expectedLpRatio),
					this.pool.lpCoinType,
					inputs.slippage
				);
		}

		// trade
		const { coinOut } = inputs.provider
			.Pools()
			.Helpers.addTradeCommandWithCoinOutToTransaction(
				inputs.tx,
				this.pool.objectId,
				inputs.coinIn,
				inputs.coinInType,
				inputs.expectedAmountOut,
				inputs.coinOutType,
				this.pool.lpCoinType,
				inputs.slippage
			);

		return coinOut;
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		return this.poolClass.getTradeAmountIn(inputs);
	};

	getUpdatedPoolBeforeTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		return this.getUpdatedPoolAfterTrade({
			...inputs,
			coinInAmount: -inputs.coinInAmount,
			coinOutAmount: -inputs.coinOutAmount,
		});
	};

	getUpdatedPoolAfterTrade = (inputs: {
		coinIn: CoinType;
		coinInAmount: Balance;
		coinOut: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		let newPoolObject = Helpers.deepCopy(this.pool);

		newPoolObject.coins[inputs.coinIn].balance += inputs.coinInAmount;
		newPoolObject.coins[inputs.coinOut].balance -= inputs.coinOutAmount;

		return new AftermathRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};
}

export default AftermathRouterPool;

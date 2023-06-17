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
import { PoolObject } from "../../../../pools/poolsTypes";
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { Pool, Pools } from "../../../../pools";
import { Casting, Helpers } from "../../../../../general/utils";
import { AftermathApi } from "../../../../../general/providers";

class AftermathRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: PoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [
			...Object.keys(pool.coins),
			// pool.lpCoinType
		];
		this.poolClass = new Pool(pool, network);
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "Aftermath";
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI
	readonly noHopsAllowed = false;

	readonly pool: PoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private readonly poolClass: Pool;

	// =========================================================================
	//  Functions
	// =========================================================================

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		// withdraw/deposit
		if (
			inputs.coinInType === this.pool.lpCoinType ||
			inputs.coinOutType === this.pool.lpCoinType
		) {
			// TODO: do this calc more efficiently
			let smallAmountIn = BigInt(100000);
			while (smallAmountIn < Casting.u64MaxBigInt) {
				try {
					const smallAmountOut = this.getTradeAmountOut({
						...inputs,
						coinInAmount: smallAmountIn,
					});

					if (smallAmountOut <= BigInt(0))
						throw new Error("0 amount out");

					return Number(smallAmountIn) / Number(smallAmountOut);
				} catch (e) {}

				smallAmountIn *= BigInt(10);
			}

			// this shouldn't be reached
			return 1;
		}

		// trade
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
			const lpRatio = this.poolClass.getMultiCoinWithdrawLpRatio({
				lpCoinAmountOut: inputs.coinInAmount,
			});

			// TODO: move this estimation to helper function within sdk
			const poolCoinOut = this.pool.coins[inputs.coinOutType];
			const coinOutPoolBalance = poolCoinOut.balance;

			const lpCoinSupply = Number(this.pool.lpCoinSupply);
			const lpTotal = Number(inputs.coinInAmount);
			const poolCoinAmount =
				lpTotal < 0
					? 0
					: Number(coinOutPoolBalance) * (lpTotal / lpCoinSupply);

			const amountOutEstimate = BigInt(Math.floor(poolCoinAmount));

			const amountsOuts = this.poolClass.getWithdrawAmountsOut({
				lpRatio,
				amountsOutDirection: {
					[inputs.coinOutType]: amountOutEstimate,
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

	tradeTx = (inputs: RouterPoolTradeTxInputs) => {
		const slippage = 100;

		// withdraw
		if (inputs.coinInType === this.pool.lpCoinType) {
			return inputs.provider.Pools().multiCoinWithdrawTx({
				...inputs,
				poolId: this.pool.objectId,
				// this is beacuse typescript complains for some reason otherwise
				lpCoinId: inputs.coinInId,
				coinTypes: [inputs.coinOutType],
				expectedAmountsOut: [inputs.expectedCoinOutAmount],
				lpCoinType: this.pool.lpCoinType,
				slippage,
			});
		}

		// deposit
		if (inputs.coinOutType === this.pool.lpCoinType) {
			const expectedLpRatio = this.poolClass.getMultiCoinWithdrawLpRatio({
				lpCoinAmountOut: inputs.expectedCoinOutAmount,
			});

			return inputs.provider.Pools().multiCoinDepositTx({
				...inputs,
				poolId: this.pool.objectId,
				// this is because typescript complains for some reason otherwise
				coinIds:
					typeof inputs.coinInId === "string"
						? [inputs.coinInId]
						: [inputs.coinInId],
				coinTypes: [inputs.coinInType],
				expectedLpRatio: Casting.numberToFixedBigInt(expectedLpRatio),
				lpCoinType: this.pool.lpCoinType,
				slippage,
			});
		}

		// trade
		const coinOut = inputs.provider.Pools().routerWrapperTradeTx({
			...inputs,
			poolId: this.pool.objectId,
			lpCoinType: this.pool.lpCoinType,
			coinInId: inputs.coinInId,
		});

		return coinOut;
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		// reverse withdraw (deposit)
		if (inputs.coinInType === this.pool.lpCoinType) {
			const { lpAmountOut } = this.poolClass.getDepositLpAmountOut({
				amountsIn: {
					[inputs.coinOutType]: inputs.coinOutAmount,
				},
				referral: inputs.referrer !== undefined,
			});

			return lpAmountOut;
		}

		// reverse deposit (withdraw)
		if (inputs.coinOutType === this.pool.lpCoinType) {
			const lpRatio = this.poolClass.getMultiCoinWithdrawLpRatio({
				lpCoinAmountOut: inputs.coinOutAmount,
			});

			const amountsOuts = this.poolClass.getWithdrawAmountsOut({
				lpRatio,
				amountsOutDirection: {
					// TODO: give a better approximation for direction amount ?
					[inputs.coinInType]: inputs.coinOutAmount,
				},
				referral: inputs.referrer !== undefined,
			});

			return amountsOuts[inputs.coinInType];
		}

		// reverse trade
		return this.poolClass.getTradeAmountIn(inputs);
	};

	getUpdatedPoolBeforeTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		return this.getUpdatedPoolAfterTrade({
			...inputs,
			coinInAmount: -inputs.coinInAmount,
			coinOutAmount: -inputs.coinOutAmount,
		});
	};

	getUpdatedPoolAfterTrade = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		coinOutAmount: Balance;
	}): RouterPoolInterface => {
		let newPoolObject = Helpers.deepCopy(this.pool);

		if (inputs.coinInType === this.pool.lpCoinType) {
			// withdraw

			newPoolObject.lpCoinSupply += inputs.coinInAmount;

			newPoolObject.coins[inputs.coinOutType].balance -=
				inputs.coinOutAmount;
		} else if (inputs.coinOutType === this.pool.lpCoinType) {
			// deposit

			newPoolObject.coins[inputs.coinInType].balance +=
				inputs.coinInAmount;

			newPoolObject.lpCoinSupply -= inputs.coinOutAmount;
		} else {
			// trade

			newPoolObject.coins[inputs.coinInType].balance +=
				inputs.coinInAmount;
			newPoolObject.coins[inputs.coinOutType].balance -=
				inputs.coinOutAmount;
		}

		return new AftermathRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};
}

export default AftermathRouterPool;

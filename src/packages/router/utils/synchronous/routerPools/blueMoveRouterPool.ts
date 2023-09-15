import {
	Balance,
	SuiAddress,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { Casting, Helpers } from "../../../../../general/utils";
import { AftermathApi } from "../../../../../general/providers";
import { BlueMovePoolObject } from "../../../../external/blueMove/blueMoveTypes";
import { BlueMoveApi } from "../../../../external/blueMove/blueMoveApi";
import { Coin } from "../../../../coin";

class BlueMoveRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: BlueMovePoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.coinTypeX, pool.coinTypeY];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "BlueMove";
	// TODO: update gas price
	readonly expectedGasCostPerHop = BigInt(50_000_000); // 0.05 SUI
	readonly noHopsAllowed = false;

	readonly pool: BlueMovePoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private static readonly FEE_SCALING = 1000000;
	private static readonly ONE_E_8 = 100000000;

	private static readonly BLUE_MOVE_FEE_SCALING = 10000;
	// this fee is assumed because unable to find any reference to in from blue move
	private static readonly BLUE_MOVE_ASSUMED_UNCORRELATED_FEE = 0.003; // 0.3%

	// =========================================================================
	//  Public Interface
	// =========================================================================

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		// TODO: do this calc correctly
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
	};

	// TODO: calc by taking into account fee amount
	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		const coinInReserve = this.getPoolBalance(inputs.coinInType);
		const coinOutReserve = this.getPoolBalance(inputs.coinOutType);

		if ("stable" in this.pool) {
			const isCoinInX = BlueMoveApi.isCoinX({
				pool: this.pool,
				coinType: inputs.coinInType,
			});

			const totalFeePercentage =
				Number(this.pool.stable.daoFee + this.pool.stable.fee) /
				BlueMoveRouterPool.BLUE_MOVE_FEE_SCALING;

			const coinInAmountMinusFee =
				inputs.coinInAmount -
				BigInt(
					Math.floor(Number(inputs.coinInAmount) * totalFeePercentage)
				);

			const [scaleIn, scaleOut] = isCoinInX
				? [this.pool.stable.xScale, this.pool.stable.yScale]
				: [this.pool.stable.yScale, this.pool.stable.xScale];

			const { recievedAmount } = this.getSwapAmountStable(
				coinInReserve,
				coinOutReserve,
				Number(scaleIn),
				Number(scaleOut),
				Number(coinInAmountMinusFee)
			);
			return BigInt(Math.floor(recievedAmount));
		}

		const coinInAmountMinusFee =
			inputs.coinInAmount -
			BigInt(
				Math.floor(
					Number(inputs.coinInAmount) *
						BlueMoveRouterPool.BLUE_MOVE_ASSUMED_UNCORRELATED_FEE
				)
			);

		const { recievedAmount } = this.getSwapAmountUncorrelated(
			coinInReserve,
			coinOutReserve,
			Number(coinInAmountMinusFee)
		);
		return BigInt(Math.floor(recievedAmount));
	};

	tradeTx = (inputs: RouterPoolTradeTxInputs) => {
		return inputs.provider
			.Router()
			.BlueMove()
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
	}): Balance => {
		throw new Error("not implemented");
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
		const isCoinInX = BlueMoveApi.isCoinX({
			coinType: inputs.coinInType,
			pool: this.pool,
		});

		let newPoolObject = Helpers.deepCopy(this.pool);

		newPoolObject.tokenXValue += isCoinInX
			? inputs.coinInAmount
			: -inputs.coinOutAmount;
		newPoolObject.tokenYValue += isCoinInX
			? -inputs.coinOutAmount
			: inputs.coinInAmount;

		return new BlueMoveRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private getPoolBalance = (coinType: CoinType): number => {
		return Number(
			BlueMoveApi.isCoinX({ coinType, pool: this.pool })
				? this.pool.tokenXValue
				: this.pool.tokenYValue
		);
	};

	// =========================================================================
	//  Private Calculations
	// =========================================================================

	private getSwapAmountStable = (
		reserveA: number,
		reserveB: number,
		scaleA: number,
		scaleB: number,
		amount: number,
		totalFeeRate: number = 0
	) => {
		let amountToSwapA = amount;
		let counter = 0;
		let left = 0,
			right = amount;
		let recievedAmountB = 0;
		// max 100 iterations for search
		while (counter < 100) {
			recievedAmountB = this.get_input_price_stable(
				amountToSwapA,
				reserveA,
				reserveB,
				totalFeeRate,
				scaleA,
				scaleB
			);
			let userRatio = recievedAmountB / (amount - amountToSwapA);
			// we are adding to reserveA, removing from reserveB
			let reserveRatio =
				(Number(reserveB) - Number(recievedAmountB)) /
				(Number(reserveA) + Number(amountToSwapA));

			if (userRatio > reserveRatio) {
				right = amountToSwapA;
			} else {
				left = amountToSwapA;
			}

			// amountToSwapA = (left + right) / 2;
			counter += 1;
		}

		return {
			amountToSwap: amountToSwapA,
			recievedAmount: recievedAmountB,
		};
	};

	getSwapAmountUncorrelated = (
		reserveA: number,
		reserveB: number,
		amount: number,
		totalFeeRate: number = 0
	) => {
		let amountToSwapA = amount;
		let counter = 0;
		let left = 0,
			right = amount;
		let recievedAmountB = 0;
		while (counter < 100) {
			recievedAmountB = this.get_input_price_uncorrelated(
				amountToSwapA,
				reserveA,
				reserveB,
				totalFeeRate
			);
			let userRatio = recievedAmountB / (amount - amountToSwapA);
			let reserveRatio =
				(Number(reserveB) - Number(recievedAmountB)) /
				(Number(reserveA) + Number(amountToSwapA));

			if (userRatio > reserveRatio) {
				right = amountToSwapA;
			} else {
				left = amountToSwapA;
			}

			// amountToSwapA = (left + right) / 2;
			counter += 1;
		}

		return {
			amountToSwap: amountToSwapA,
			recievedAmount: recievedAmountB,
		};
	};

	private get_input_price_uncorrelated = (
		input_amount: number,
		input_reserve: number,
		output_reserve: number,
		fee_percent: number
	) => {
		let input_amount_with_fee =
			input_amount * (BlueMoveRouterPool.FEE_SCALING - fee_percent);
		let numerator = input_amount_with_fee * output_reserve;
		let denominator =
			input_reserve * BlueMoveRouterPool.FEE_SCALING +
			input_amount_with_fee;

		return numerator / denominator;
	};

	private get_input_price_stable = (
		input_amount: number,
		input_reserve: number,
		output_reserve: number,
		fee_percent: number,
		input_scale: number,
		output_scale: number
	) => {
		let u2561e8 = BlueMoveRouterPool.ONE_E_8;

		let xy = this.lp_value(
			input_reserve,
			input_scale,
			output_reserve,
			output_scale
		);

		let reserve_in_u256 = (input_reserve * u2561e8) / input_scale;
		let reserve_out_u256 = (output_reserve * u2561e8) / output_scale;
		let amount_in = (input_amount * u2561e8) / input_scale;
		let amount_in_with_fees_scaling =
			(amount_in * (BlueMoveRouterPool.FEE_SCALING - fee_percent)) /
			BlueMoveRouterPool.FEE_SCALING;
		let total_reserve = amount_in_with_fees_scaling + reserve_in_u256;
		let y =
			reserve_out_u256 - this.get_y(total_reserve, xy, reserve_out_u256);

		let r = (y * output_scale) / u2561e8;

		return r;
	};

	private lp_value = (
		x_coin: number,
		x_scale: number,
		y_coin: number,
		y_scale: number
	) => {
		let _x = (x_coin * BlueMoveRouterPool.ONE_E_8) / x_scale;
		let _y = (y_coin * BlueMoveRouterPool.ONE_E_8) / y_scale;

		let xy = _x * _y;
		let x2_y2 = _x * _x + _y * _y;

		return xy * x2_y2;
	};

	private get_y = (x0: number, xy: number, y: number) => {
		let i = 0;

		let one_u256 = 1;

		while (i < 255) {
			let k = this.calcF(x0, y);

			let _dy = 0;
			if (xy > k) {
				_dy = (xy - k) / this.calcD(x0, y) + one_u256; // Round up
				y = y + _dy;
			} else {
				_dy = (k - xy) / this.calcD(x0, y) + one_u256;
				y = y - _dy;
			}
			if (_dy <= one_u256) {
				return y;
			}

			i = i + 1;
		}

		return y;
	};

	private calcF = (x0_u256: number, y_u256: number) => {
		// x0*(y*y/1e18*y/1e18)/1e18
		let yy = y_u256 * y_u256;
		let yyy = yy * y_u256;

		let a = x0_u256 * yyy;

		//(x0*x0/1e18*x0/1e18)*y/1e18
		let xx = x0_u256 * x0_u256;
		let xxx = xx * x0_u256;
		let b = xxx * y_u256;

		// a + b
		return a + b;
	};

	private calcD = (x0_u256: number, y_u256: number) => {
		let three_u256 = 3;

		// 3 * x0 * (y * y / 1e8) / 1e8
		let x3 = three_u256 * x0_u256;
		let yy = y_u256 * y_u256;
		let xyy3 = x3 * yy;
		let xx = x0_u256 * x0_u256;

		// x0 * x0 / 1e8 * x0 / 1e8
		let xxx = xx * x0_u256;

		return xyy3 + xxx;
	};
}

export default BlueMoveRouterPool;

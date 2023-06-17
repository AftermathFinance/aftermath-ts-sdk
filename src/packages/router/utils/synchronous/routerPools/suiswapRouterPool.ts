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
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { Pool } from "../../../../pools";
import { Casting, Helpers } from "../../../../../general/utils";
import { AftermathApi } from "../../../../../general/providers";
import { SuiswapPoolObject } from "../../../../external/suiswap/suiswapTypes";
import { SuiswapApi } from "../../../../external/suiswap/suiswapApi";

class SuiswapRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: SuiswapPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.coinTypeX, pool.coinTypeY];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "Suiswap";
	// TODO: update gas price
	readonly expectedGasCostPerHop = BigInt(50_000_000); // 0.05 SUI
	readonly noHopsAllowed = false;

	readonly pool: SuiswapPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private static readonly BPS_SCALING = BigInt("10000");

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
		const isCoinInX = SuiswapApi.isCoinX({
			coinType: inputs.coinInType,
			pool: this.pool,
		});

		if (isCoinInX) {
			return this.getXToYAmount(inputs.coinInAmount);
		}

		return this.getYToXAmount(inputs.coinInAmount);
	};

	tradeTx = (inputs: RouterPoolTradeTxInputs) => {
		return inputs.provider
			.Router()
			.Suiswap()
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
		const isCoinInX = SuiswapApi.isCoinX({
			coinType: inputs.coinInType,
			pool: this.pool,
		});

		let newPoolObject = Helpers.deepCopy(this.pool);

		newPoolObject.xValue += isCoinInX
			? inputs.coinInAmount
			: -inputs.coinOutAmount;
		newPoolObject.yValue += isCoinInX
			? -inputs.coinOutAmount
			: inputs.coinInAmount;

		return new SuiswapRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};

	// =========================================================================
	//  Private Calculations
	// =========================================================================

	private getXToYAmount = (dx: bigint) => {
		const x_reserve_amt = this.pool.xValue;
		const y_reserve_amt = this.pool.yValue;

		if (this.pool.feeDirection === "X") {
			dx =
				dx -
				(dx * this.totalAdminFee()) / SuiswapRouterPool.BPS_SCALING;
		}

		dx = dx - (dx * this.totalLpFee()) / SuiswapRouterPool.BPS_SCALING;
		if (dx < BigInt(0)) {
			return BigInt(0);
		}

		let dy =
			this.pool.poolType == "v2"
				? this._computeAmount(dx, x_reserve_amt, y_reserve_amt)
				: this._computeAmountStable(
						dx,
						x_reserve_amt,
						y_reserve_amt,
						this.pool.stableXScale,
						this.pool.stableYScale
				  );
		if (this.pool.feeDirection === "Y") {
			dy =
				dy -
				(dy * this.totalAdminFee()) / SuiswapRouterPool.BPS_SCALING;
		}

		return dy;
	};

	private getYToXAmount = (dy: bigint) => {
		const x_reserve_amt = this.pool.xValue;
		const y_reserve_amt = this.pool.yValue;

		if (this.pool.feeDirection === "Y") {
			dy =
				dy -
				(dy * this.totalAdminFee()) / SuiswapRouterPool.BPS_SCALING;
		}

		dy = dy - (dy * this.totalLpFee()) / SuiswapRouterPool.BPS_SCALING;
		if (dy < BigInt(0)) {
			return BigInt(0);
		}

		let dx =
			this.pool.poolType == "v2"
				? this._computeAmount(dy, y_reserve_amt, x_reserve_amt)
				: this._computeAmountStable(
						dy,
						y_reserve_amt,
						x_reserve_amt,
						this.pool.stableYScale,
						this.pool.stableXScale
				  );
		if (this.pool.feeDirection === "X") {
			dx =
				dx -
				(dx * this.totalAdminFee()) / SuiswapRouterPool.BPS_SCALING;
		}

		return dx;
	};

	private _computeAmount = (dx: bigint, x: bigint, y: bigint) => {
		const numerator = y * dx;
		const denominator = x + dx;
		const dy = numerator / denominator;
		return dy;
	};

	private _computeAmountStable = (
		dx: bigint,
		x: bigint,
		y: bigint,
		x_scale: bigint,
		y_scale: bigint
	) => {
		const dy_ = StableSwapHelper.computeY(
			dx * x_scale,
			x * x_scale,
			y * y_scale,
			this.pool.stableAmp
		);
		return dy_ / y_scale;
	};

	private totalAdminFee = () => {
		return this.pool.feeAdmin; // + this.connectFee
	};

	private totalLpFee = () => {
		return this.pool.feeLp; // + this.incentiveFee
	};
}

class StableSwapHelper {
	private static readonly MINUS_ONE = BigInt(-1);
	private static readonly ZERO = BigInt(0);
	private static readonly ONE = BigInt(1);
	private static readonly TWO = BigInt(2);
	private static readonly THREE = BigInt(3);
	private static readonly FOUR = BigInt(4);
	private static readonly _1E1 = BigInt(10 ** 1);

	static compuateDNext = (
		dInit: bigint,
		dProd: bigint,
		sumX: bigint,
		A: bigint
	) => {
		const leverage = sumX * StableSwapHelper.TWO * A;
		const numerator = dInit * (StableSwapHelper.TWO * dProd + leverage);
		const denominator =
			dInit * (StableSwapHelper.TWO * A - StableSwapHelper.ONE) +
			StableSwapHelper.THREE * dProd;
		return numerator / denominator;
	};

	static computeD = (b: bigint, q: bigint, A: bigint) => {
		if (b + q == StableSwapHelper.ZERO) {
			return StableSwapHelper.ZERO;
		}

		let d = b + q;

		for (let __i = 0; __i < 256; ++__i) {
			let dProd = d;
			dProd = (dProd * d) / (StableSwapHelper.TWO * b);
			dProd = (dProd * d) / (StableSwapHelper.TWO * q);
			const dPrev = d;
			d = StableSwapHelper.compuateDNext(d, dProd, b + q, A);
			const diff = d - dPrev;
			if (
				diff === StableSwapHelper.ONE ||
				diff === StableSwapHelper.MINUS_ONE ||
				diff === StableSwapHelper.ZERO
			) {
				break;
			}
		}

		return d;
	};

	static computeY = (dx: bigint, x: bigint, y: bigint, A: bigint) => {
		const d = StableSwapHelper.computeD(x, y, A);
		let c = (d * d) / (StableSwapHelper.TWO * (x + dx));
		c = (c * d) / (StableSwapHelper.FOUR * A);
		const b = d / (StableSwapHelper.TWO * A) + (x + dx);

		let yy = d;
		for (let __i = 0; __i < 256; ++__i) {
			const yPrev = yy;
			const yn = yy * yy + c;
			const yd = StableSwapHelper.TWO * yy + b - d;
			yy = yn / yd;
			const diff = yy - yPrev;
			if (
				diff === StableSwapHelper.ONE ||
				diff === StableSwapHelper.MINUS_ONE ||
				diff === StableSwapHelper.ZERO
			) {
				break;
			}
		}

		return y - yy - StableSwapHelper.ONE;
	};

	static computeDDecimal = (
		b: bigint,
		q: bigint,
		A: bigint,
		bd: number,
		qd: number
	) => {
		const md = Math.max(bd, qd);
		StableSwapHelper.computeD(
			b * this.bigintPow(StableSwapHelper._1E1, md - bd),
			q * this.bigintPow(StableSwapHelper._1E1, md - qd),
			A
		);
	};

	static computeYDecimal = (
		dx: bigint,
		x: bigint,
		y: bigint,
		A: bigint,
		xd: number,
		yd: number
	) => {
		const md = Math.max(xd, yd);
		const xs = this.bigintPow(StableSwapHelper._1E1, md - xd);
		const ys = this.bigintPow(StableSwapHelper._1E1, md - yd);
		const dy = StableSwapHelper.computeY(dx * xs, x * xs, y * ys, A);
		return dy / ys;
	};

	static bigintPow = (a: bigint, b: number) => {
		return Array(b)
			.fill(BigInt(a))
			.reduce((a, b) => a * b, BigInt(1));
	};
}

export default SuiswapRouterPool;

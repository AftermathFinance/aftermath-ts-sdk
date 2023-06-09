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
import { Pool } from "../../../../pools";
import { Helpers } from "../../../../../general/utils";
import { AftermathApi } from "../../../../../general/providers";
import { InterestPoolObject } from "../../../../external/interest/interestTypes";
import { InterestApi } from "../../../../external/interest/interestApi";

class InterestRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: InterestPoolObject, network: SuiNetwork | Url) {
		this.pool = pool;
		this.network = network;
		this.uid = pool.objectId;
		this.coinTypes = [pool.coinTypeX, pool.coinTypeY];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "Interest";
	readonly expectedGasCostPerHop = BigInt(100_000_000); // 0.1 SUI
	readonly noHopsAllowed = false;

	readonly pool: InterestPoolObject;
	readonly network: SuiNetwork | Url;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	private static readonly PRECISION = BigInt(1000000000000000000); //1e18;
	private static readonly VOLATILE_FEE_PERCENT = BigInt(3000000000000000); //0.3%
	private static readonly STABLE_FEE_PERCENT = BigInt(500000000000000); //0.05%

	// =========================================================================
	//  Functions
	// =========================================================================

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		// TODO: implement
		return 1;
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		if (this.pool.isStable) {
			const coinInAmountMinusFeesAdjusted =
				inputs.coinInAmount -
				(inputs.coinInAmount * InterestRouterPool.STABLE_FEE_PERCENT) /
					InterestRouterPool.PRECISION;

			const reserveX =
				(this.pool.balanceXValue * InterestRouterPool.PRECISION) /
				this.pool.decimalsX;
			const reserveY =
				(this.pool.balanceYValue * InterestRouterPool.PRECISION) /
				this.pool.decimalsY;

			const isCoinInX = InterestApi.isCoinX({
				coinType: inputs.coinInType,
				pool: this.pool,
			});

			const amountInDecimals =
				(coinInAmountMinusFeesAdjusted * InterestRouterPool.PRECISION) /
				(isCoinInX ? this.pool.decimalsX : this.pool.decimalsY);

			const _k = this.calcK(
				this.pool.balanceXValue,
				this.pool.balanceYValue,
				this.pool.decimalsX,
				this.pool.decimalsY
			);

			const y = isCoinInX
				? reserveY -
				  this.calcY(amountInDecimals + reserveX, _k, reserveY)
				: reserveX -
				  this.calcY(amountInDecimals + reserveY, _k, reserveX);

			return (
				(y * (isCoinInX ? this.pool.decimalsY : this.pool.decimalsX)) /
				InterestRouterPool.PRECISION
			);
		}

		const coinInAmountMinusFeesAdjusted =
			inputs.coinInAmount -
			(inputs.coinInAmount * InterestRouterPool.VOLATILE_FEE_PERCENT) /
				InterestRouterPool.PRECISION;

		const numerator =
			this.getPoolBalance(inputs.coinOutType) *
			coinInAmountMinusFeesAdjusted;
		const denominator =
			this.getPoolBalance(inputs.coinInType) +
			coinInAmountMinusFeesAdjusted;

		return numerator / denominator;
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
	}) => {
		return inputs.provider
			.Router()
			.Interest()
			.tradeTx({
				...inputs,
				pool: this.pool,
				coinInId: inputs.coinIn,
				minAmountOut: BigInt(0),
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
		const isCoinInX = InterestApi.isCoinX({
			coinType: inputs.coinInType,
			pool: this.pool,
		});

		let newPoolObject = Helpers.deepCopy(this.pool);

		newPoolObject.balanceXValue += isCoinInX
			? inputs.coinInAmount
			: -inputs.coinOutAmount;
		newPoolObject.balanceYValue += isCoinInX
			? -inputs.coinOutAmount
			: inputs.coinInAmount;

		return new InterestRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};

	private getPoolBalance = (coinType: CoinType): Balance => {
		return InterestApi.isCoinX({ coinType, pool: this.pool })
			? this.pool.balanceXValue
			: this.pool.balanceYValue;
	};

	private calcY = (x0: bigint, xy: bigint, y: bigint) => {
		let i = 0;

		// Here it is using the Newton's method to to make sure that y and and y_prev are equal
		while (i < 255) {
			i = i + 1;
			const y_prev = y;
			const k = this.calcF(x0, y);

			if (k < xy) {
				const dy =
					((xy - k) * InterestRouterPool.PRECISION) /
						this.calcD(x0, y) +
					BigInt(1); // round up
				y = y + dy;
			} else {
				y =
					y -
					((k - xy) * InterestRouterPool.PRECISION) /
						this.calcD(x0, y);
			}

			if (y > y_prev) {
				if (y - y_prev <= 1) break;
			} else {
				if (y_prev - y <= 1) break;
			}
		}

		return y;
	};

	private calcF = (x0: bigint, y: bigint): bigint => {
		return (
			(x0 *
				((((y * y) / InterestRouterPool.PRECISION) * y) /
					InterestRouterPool.PRECISION)) /
				InterestRouterPool.PRECISION +
			(((((x0 * x0) / InterestRouterPool.PRECISION) * x0) /
				InterestRouterPool.PRECISION) *
				y) /
				InterestRouterPool.PRECISION
		);
	};

	private calcD = (x0: bigint, y: bigint): bigint => {
		return (
			(BigInt(3) * x0 * ((y * y) / InterestRouterPool.PRECISION)) /
				InterestRouterPool.PRECISION +
			(((x0 * x0) / InterestRouterPool.PRECISION) * x0) /
				InterestRouterPool.PRECISION
		);
	};

	private calcK = (
		x: bigint,
		y: bigint,
		decimalsX: bigint,
		decimalsY: bigint
	) => {
		if (!this.pool.isStable) {
			return x * y;
		} else {
			const _x = (x * InterestRouterPool.PRECISION) / decimalsX;
			const _y = (y * InterestRouterPool.PRECISION) / decimalsY;
			const _a = (_x * _y) / InterestRouterPool.PRECISION;
			const _b =
				(_x * _x) / InterestRouterPool.PRECISION +
				(_y * _y) / InterestRouterPool.PRECISION;

			return (_a * _b) / InterestRouterPool.PRECISION; // k = x^3y + y^3x
		}
	};
}

export default InterestRouterPool;

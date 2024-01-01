import {
	Balance,
	SuiNetwork,
	UniqueId,
	Url,
	SuiAddress,
	AfSuiRouterPoolObject,
} from "../../../../../types";
import { CoinType } from "../../../../coin/coinTypes";
import {
	RouterPoolInterface,
	RouterPoolTradeTxInputs,
} from "../interfaces/routerPoolInterface";
import { Casting, Helpers } from "../../../../../general/utils";
import { Coin, Staking } from "../../../..";

class AfSuiRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: AfSuiRouterPoolObject, network: SuiNetwork) {
		this.pool = pool;
		this.network = network;
		this.uid = "afSUI";
		this.coinTypes = [Coin.constants.suiCoinType, pool.afSuiCoinType];
	}

	// =========================================================================
	//  Constants
	// =========================================================================

	readonly protocolName = "afSUI";
	readonly expectedGasCostPerHop = BigInt(50_000_000); // 0.05 SUI
	readonly noHopsAllowed = false;

	readonly pool: AfSuiRouterPoolObject;
	readonly network: SuiNetwork;
	readonly uid: UniqueId;
	readonly coinTypes: CoinType[];

	// =========================================================================
	//  Functions
	// =========================================================================

	getSpotPrice = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		return this.exchangeRate(inputs);
	};

	getTradeAmountOut = (inputs: {
		coinInType: CoinType;
		coinInAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		// TODO: handle referrer discount

		if (this.isStake(inputs)) {
			// stake

			// check min stake bound
			if (inputs.coinInAmount < Staking.constants.bounds.minStake)
				return BigInt(0);

			// NOTE: is this safe or possible overflow ?
			return BigInt(
				Math.floor(
					this.exchangeRate(inputs) * Number(inputs.coinInAmount)
				)
			);
		}

		// unstake

		// check sui reserves
		if (inputs.coinInAmount > this.pool.atomicUnstakeSuiReserves)
			return BigInt(0);

		// NOTE: is this safe or possible overflow ?
		return BigInt(
			Math.floor(
				this.exchangeRate(inputs) *
					Number(inputs.coinInAmount) *
					(1 -
						Staking.calcAtomicUnstakeFee({
							stakedSuiVaultState: this.pool,
						}))
			)
		);
	};

	tradeTx = (inputs: RouterPoolTradeTxInputs) => {
		// TODO: try set referrer in tx as well ?
		const stakingProvider = inputs.provider.Staking();

		if (this.isStake(inputs)) {
			// stake
			return stakingProvider.routerWrapperStakeTx(inputs);
		}

		// unstake
		return stakingProvider.routerWrapperAtomicUnstakeTx(inputs);
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		// TODO: handle referrer discount

		if (this.isStake(inputs)) {
			// stake

			// check divide by 0
			if (this.exchangeRate(inputs) <= 0) return Casting.u64MaxBigInt;

			const coinInAmount = BigInt(
				Math.ceil(
					Number(inputs.coinOutAmount) / this.exchangeRate(inputs)
				)
			);

			// check min stake bound
			if (coinInAmount < Staking.constants.bounds.minStake)
				return Casting.u64MaxBigInt;
		}

		// unstake

		const denominator =
			this.exchangeRate(inputs) *
			(1 -
				Staking.calcAtomicUnstakeFee({
					stakedSuiVaultState: this.pool,
				}));

		// check divide by 0
		if (denominator <= 0) return Casting.u64MaxBigInt;

		const coinInAmount = BigInt(
			Math.ceil(Number(inputs.coinOutAmount) / denominator)
		);

		// check sui reserves
		if (coinInAmount > this.pool.atomicUnstakeSuiReserves)
			return Casting.u64MaxBigInt;

		return coinInAmount;
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

		if (this.isStake(inputs)) {
			// stake
			newPoolObject.totalSuiAmount += inputs.coinInAmount;
		} else {
			// unstake
			newPoolObject.atomicUnstakeSuiReserves -= inputs.coinOutAmount;
			newPoolObject.totalSuiAmount -= inputs.coinInAmount;
		}

		return new AfSuiRouterPool(
			Helpers.deepCopy(newPoolObject),
			this.network
		);
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private isStake(inputs: { coinInType: CoinType }): boolean {
		return inputs.coinInType === Coin.constants.suiCoinType;
	}

	private exchangeRate = (inputs: {
		coinInType: CoinType;
		coinOutType: CoinType;
	}) => {
		return this.isStake(inputs)
			? this.pool.afSuiToSuiExchangeRate
			: this.pool.afSuiToSuiExchangeRate <= 0
			? 0
			: 1 / this.pool.afSuiToSuiExchangeRate;
	};
}

export default AfSuiRouterPool;

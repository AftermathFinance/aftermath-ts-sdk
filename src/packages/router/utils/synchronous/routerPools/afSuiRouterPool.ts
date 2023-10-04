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
import { Helpers } from "../../../../../general/utils";
import { Coin, Staking } from "../../../..";

class AfSuiRouterPool implements RouterPoolInterface {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(pool: AfSuiRouterPoolObject, network: SuiNetwork | Url) {
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
	readonly network: SuiNetwork | Url;
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

		const { tx, coinInId } = inputs;
		const stakingProvider = inputs.provider.Staking();

		if (this.isStake(inputs)) {
			// stake

			return stakingProvider.stakeTx({
				tx,
				suiCoin: coinInId,
				validatorAddress: this.pool.aftermathValidatorAddress,
			});
		}

		// unstake

		return stakingProvider.atomicUnstakeTx({
			tx,
			afSuiCoin: coinInId,
		});
	};

	getTradeAmountIn = (inputs: {
		coinInType: CoinType;
		coinOutAmount: Balance;
		coinOutType: CoinType;
		referrer?: SuiAddress;
	}): Balance => {
		// NOTE: is this correct ?
		return this.getTradeAmountOut({
			...inputs,
			coinInType: inputs.coinOutType,
			coinOutType: inputs.coinInType,
			coinInAmount: inputs.coinOutAmount,
		});
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

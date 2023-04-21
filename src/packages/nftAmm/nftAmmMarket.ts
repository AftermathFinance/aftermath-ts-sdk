import {
	SuiNetwork,
	NftAmmMarketObject,
	ApiNftAmmDepositBody,
	Balance,
	ApiNftAmmWithdrawBody,
	ApiNftAmmBuyBody,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Pool } from "../pools";

export class NftAmmMarket extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Private Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {};

	/////////////////////////////////////////////////////////////////////
	//// Public Class Members
	/////////////////////////////////////////////////////////////////////

	public pool: Pool;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		public readonly market: NftAmmMarketObject,
		public readonly network?: SuiNetwork
	) {
		super(network, `nft-amm/markets/${market.objectId}`);
		this.market = market;
		this.pool = new Pool(market.pool, network);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getDepositTransaction(inputs: ApiNftAmmDepositBody) {
		return this.fetchApiTransaction<ApiNftAmmDepositBody>(
			"transactions/deposit",
			inputs
		);
	}

	public async getWithdrawTransaction(inputs: ApiNftAmmWithdrawBody) {
		return this.fetchApiTransaction<ApiNftAmmWithdrawBody>(
			"transactions/withdraw",
			inputs
		);
	}

	public async getBuyTransaction(inputs: ApiNftAmmBuyBody) {
		return this.fetchApiTransaction<ApiNftAmmBuyBody>(
			"transactions/buy",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Calculations
	/////////////////////////////////////////////////////////////////////

	public getBuyAmountIn = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountIn({
			coinOutAmount:
				BigInt(inputs.nftsCount) * this.market.fractionalizedCoinAmount,
			coinInType: this.market.assetCoinType,
			coinOutType: this.market.fractionalizedCoinType,
			referral: inputs.referral,
		});
	};

	public getDepositLpAmountOut = (inputs: {
		assetCoinAmountIn: Balance;
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		return this.pool.getDepositLpAmountOut({
			amountsIn: {
				[this.market.assetCoinType]: inputs.assetCoinAmountIn,
			},
			referral: inputs.referral,
		});
	};

	public getWithdrawFractionalizedCoinAmountOut = (inputs: {
		// NOTE: do we need a better direction approximation here ?
		lpCoinAmount: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getWithdrawLpRatio({
			lpCoinAmountOut: inputs.lpCoinAmount,
		});

		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.market.fractionalizedCoinType]:
					this.market.fractionalizedCoinAmount,
			},
			referral: inputs.referral,
		});

		const fractionalizedCoinAmountOut = amountsOut[0];
		return fractionalizedCoinAmountOut;
	};

	public getWithdrawNftsCountOut = (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}): bigint => {
		const fractionalizedCoinAmountOut =
			this.getWithdrawFractionalizedCoinAmountOut(inputs);
		const minNftsCountOut =
			fractionalizedCoinAmountOut / this.market.fractionalizedCoinAmount;

		return minNftsCountOut;
	};
}

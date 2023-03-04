import { SignableTransaction, SuiAddress } from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	Balance,
	CoinType,
	CoinsToBalance,
	PoolObject,
	PoolStats,
} from "aftermath-sdk";
import { ApiPoolDepositBody, ApiPoolSwapBody } from "../types/apiTypes";

export class Pool extends AftermathProvider {
	constructor(
		public readonly network: SuiNetwork,
		public readonly pool: PoolObject
	) {
		super(network, `indices/pools/${pool.objectId}`);
		this.pool = pool;
	}

	public async getDepositTransactions(
		walletAddress: SuiAddress,
		depositCoinAmounts: CoinsToBalance
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiPoolDepositBody>(
			"deposit",
			{
				walletAddress,
				depositCoinAmounts,
			}
		);
	}

	public async getTradeTransactions(
		walletAddress: SuiAddress,
		fromCoin: CoinType,
		fromCoinAmount: Balance,
		toCoin: CoinType
	): Promise<SignableTransaction[]> {
		return this.fetchApi<SignableTransaction[], ApiPoolSwapBody>("swap", {
			walletAddress,
			fromCoin,
			fromCoinAmount,
			toCoin,
		});
	}

	public async getStats(): Promise<PoolStats> {
		return this.fetchApi("stats");
	}
}

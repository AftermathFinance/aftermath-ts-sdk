import { SuiAddress, TransactionDigest } from "@mysten/sui.js";
import { Aftermath } from "../providers/aftermath";
import {
	Balance,
	CoinType,
	CoinWithBalance,
	ApiTransactionsBody,
	TransactionsWithCursor,
	SuiNetwork,
} from "../../types";

export class Wallet extends Aftermath {
	constructor(
		public readonly address: SuiAddress,
		public readonly network?: SuiNetwork
	) {
		super(network, `wallet/${address}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Balances
	/////////////////////////////////////////////////////////////////////

	public async getBalance(coin: CoinType): Promise<Balance> {
		return this.fetchApi(`balances/${coin}`);
	}

	// TODO: change return type to Record<Coin, Balance> ?
	public async getBalances(coins: CoinType[]): Promise<Balance[]> {
		const balances = await Promise.all(coins.map(this.getBalance));
		return balances;
	}

	// TODO: change return type to Record<Coin, Balance> !
	public async getAllBalances(): Promise<CoinWithBalance[]> {
		return this.fetchApi("balances");
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getPastTransactions(
		cursor?: TransactionDigest,
		limit?: number
	): Promise<TransactionsWithCursor> {
		return this.fetchApi<TransactionsWithCursor, ApiTransactionsBody>(
			"transactions",
			{
				cursor,
				limit,
			}
		);
	}
}

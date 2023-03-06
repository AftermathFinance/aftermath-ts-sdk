import { SuiAddress, TransactionDigest } from "@mysten/sui.js";
import { ApiProvider } from "../providers/apiProvider";
import {
	Balance,
	CoinType,
	CoinWithBalance,
	ApiTransactionsBody,
	TransactionsWithCursor,
	SuiNetwork,
} from "../types";

export class Wallet extends ApiProvider {
	constructor(
		public readonly network: SuiNetwork,
		public readonly address: SuiAddress
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

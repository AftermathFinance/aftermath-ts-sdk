import { SuiAddress, TransactionDigest } from "@mysten/sui.js";
import { SuiNetwork } from "../types/suiTypes";
import {
	ApiTransactionsBody,
	Balance,
	TransactionsWithCursor,
	Url,
} from "../types/generalTypes";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";

export class Wallet extends Caller {
	constructor(
		public readonly address: SuiAddress,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `wallet/${address}`);
	}

	/////////////////////////////////////////////////////////////////////
	//// Balances
	/////////////////////////////////////////////////////////////////////

	public async getBalance(inputs: { coin: CoinType }): Promise<Balance> {
		return this.fetchApi(`balances/${inputs.coin}`);
	}

	// TODO: change return type to Record<Coin, Balance> ?
	public async getBalances(inputs: { coins: CoinType[] }) {
		const balances = await Promise.all(
			inputs.coins.map((coin) => this.getBalance({ coin }))
		);
		return balances;
	}

	public async getAllBalances(): Promise<CoinsToBalance> {
		return this.fetchApi("balances");
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getPastAftermathTransactions(inputs: ApiTransactionsBody) {
		return this.fetchApi<TransactionsWithCursor, ApiTransactionsBody>(
			"transactions",
			inputs
		);
	}
}

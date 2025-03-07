import { SuiNetwork } from "../types/suiTypes";
import {
	ApiTransactionsBody,
	Balance,
	CallerConfig,
	SuiAddress,
	TransactionsWithCursor,
	Url,
} from "../types/generalTypes";
import { CoinType, CoinsToBalance } from "../../packages/coin/coinTypes";
import { Caller } from "../utils/caller";
import { AftermathApi } from "../providers";

export class Wallet extends Caller {
	constructor(
		public readonly address: SuiAddress,
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, `wallet/${address}`);
	}

	// =========================================================================
	//  Balances
	// =========================================================================

	public async getBalance(inputs: { coin: CoinType }): Promise<Balance> {
		return this.useProvider().fetchCoinBalance({
			...inputs,
			walletAddress: this.address,
		});
	}

	// TODO: change return type to Record<Coin, Balance> ?
	public async getBalances(inputs: {
		coins: CoinType[];
	}): Promise<Balance[]> {
		// const balances = await Promise.all(
		// 	inputs.coins.map((coin) => this.getBalance({ coin }))
		// );
		// return balances;
		return this.fetchApi(`balances/coins`, inputs);
	}

	public async getAllBalances(): Promise<CoinsToBalance> {
		return this.useProvider().fetchAllCoinBalances({
			walletAddress: this.address,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getPastTransactions(inputs: ApiTransactionsBody) {
		return this.useProvider().fetchPastTransactions({
			...inputs,
			walletAddress: this.address,
		});
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.Wallet();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

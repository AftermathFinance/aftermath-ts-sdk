import {
	EventId,
	ObjectId,
	SignableTransaction,
	SuiAddress,
	TransactionDigest,
} from "@mysten/sui.js";
import AftermathProvider from "../aftermathProvider/aftermathProvider";
import { SuiNetwork } from "aftermath-sdk/dist/src/config/configTypes";
import {
	ApiEventsBody,
	ApiRequestAddDelegationBody,
	Balance,
	DelegatedStakePosition,
	EventsWithCursor,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeValidator,
	StakeRequestWithdrawDelegationEvent,
	ApiRequestWithdrawDelegationBody,
	ApiCancelDelegationRequestBody,
	StakingStats,
	CoinType,
	CoinWithBalance,
	ApiTransactionsBody,
	TransactionsWithCursor,
} from "../types";

export class Wallet extends AftermathProvider {
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

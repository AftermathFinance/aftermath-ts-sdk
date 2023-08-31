import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	MarketState,
	MarketData,
	AccountData,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		fundingFrequencyMs: 1000000, // TODO: set this value correctly
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "perpetuals");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	public async getAllMarkets(): Promise<PerpetualsMarket[]> {
		const marketDatas = await this.fetchApi<MarketData[]>("markets");
		const marketStates = await Promise.all(
			marketDatas.map((marketData) =>
				this.fetchApi<MarketState>(
					`markets/${marketData.marketId}/market-state`
				)
			)
		);

		return marketDatas.map(
			(market, index) =>
				new PerpetualsMarket(
					market.marketId,
					market.marketParams,
					marketStates[index],
					this.network
				)
		);
	}

	public async getMarket(inputs: {
		marketId: bigint;
	}): Promise<PerpetualsMarket> {
		const [marketData, marketState] = await Promise.all([
			this.fetchApi<MarketData>(`markets/${inputs.marketId}`),
			this.fetchApi<MarketState>(
				`markets/${inputs.marketId}/market-state`
			),
		]);

		return new PerpetualsMarket(
			marketData.marketId,
			marketData.marketParams,
			marketState,
			this.network
		);
	}

	public async getUserAccounts(): Promise<PerpetualsAccount[]> {
		// TODO: Get all AccountCaps from address to query perpetualsAccount
		const accounts = await this.fetchApi<AccountData[]>("accounts");

		return accounts.map(
			(account) =>
				new PerpetualsAccount(
					account.accountId,
					account.account,
					this.network
				)
		);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getCreateAccountTx(inputs: ApiPerpetualsCreateAccountBody) {
		return this.fetchApiTransaction<ApiPerpetualsCreateAccountBody>(
			"transactions/create-account",
			inputs
		);
	}
}

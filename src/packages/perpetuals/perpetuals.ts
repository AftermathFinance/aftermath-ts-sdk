import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	SuiNetwork,
	Url,
	PerpetualsMarketState,
	PerpetualsMarketData,
	PerpetualsAccountData,
	PerpetualsMarketId,
	ApiPerpetualsAccountsBody,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	// TODO: set all of these values correctly
	public static readonly constants = {
		collateralCoinTypes: ["0x2::sui::SUI"],
		bounds: {
			minLeverage: 1,
			maxLeverage: 10,
		},
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
		const marketDatas = await this.fetchApi<PerpetualsMarketData[]>(
			"markets"
		);
		const marketStates = await Promise.all(
			marketDatas.map((marketData) =>
				this.fetchApi<PerpetualsMarketState>(
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
		marketId: PerpetualsMarketId;
	}): Promise<PerpetualsMarket> {
		const [marketData, marketState] = await Promise.all([
			this.fetchApi<PerpetualsMarketData>(`markets/${inputs.marketId}`),
			this.fetchApi<PerpetualsMarketState>(
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

	public async getUserAccounts(
		inputs: ApiPerpetualsAccountsBody
	): Promise<PerpetualsAccount[]> {
		const accountDatas = await this.fetchApi<
			PerpetualsAccountData[],
			ApiPerpetualsAccountsBody
		>("accounts", inputs);

		return accountDatas.map(
			(account) =>
				new PerpetualsAccount(
					account.account,
					account.accountCap,
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

import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	AccountStruct,
	MarketParams,
	SuiNetwork,
	Url,
} from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";
import { PerpetualsAccount } from "./perpetualsAccount";

export class Perpetuals extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

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
		const markets = await this.fetchApi<
			{
				marketId: bigint;
				marketParams: MarketParams;
			}[]
		>("markets");

		return markets.map(
			(market) =>
				new PerpetualsMarket(
					market.marketId,
					market.marketParams,
					this.network
				)
		);
	}

	public async getMarket(inputs: {
		marketId: bigint;
	}): Promise<PerpetualsMarket> {
		const market = await this.fetchApi<{
			marketId: bigint;
			marketParams: MarketParams;
		}>(`markets/${inputs.marketId}`);

		return new PerpetualsMarket(
			market.marketId,
			market.marketParams,
			this.network
		);
	}

	public async getUserAccounts(): Promise<PerpetualsAccount[]> {
		// TODO: Get all AccountCap from address to query perpetualsAccount
		const accounts = await this.fetchApi<
			{
				accountId: bigint;
				account: AccountStruct;
			}[]
		>(`accounts/`);

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

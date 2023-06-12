import { SuiAddress } from "@mysten/sui.js";
import { Caller } from "../../general/utils/caller";
import {
	ApiPerpetualsCreateAccountBody,
	PerpetualsAccountStruct,
	PerpetualsMarketParams,
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
				marketParams: PerpetualsMarketParams;
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
			marketParams: PerpetualsMarketParams;
		}>(`markets/${inputs.marketId}`);

		return new PerpetualsMarket(
			market.marketId,
			market.marketParams,
			this.network
		);
	}

	public async getUserAccounts(inputs: {
		walletAddress: SuiAddress;
	}): Promise<PerpetualsAccount[]> {
		const accounts = await this.fetchApi<
			{
				accountId: bigint;
				account: PerpetualsAccountStruct;
			}[]
		>(`accounts/${inputs.walletAddress}`);

		return accounts.map(
			(account) =>
				new PerpetualsAccount(
					inputs.walletAddress,
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

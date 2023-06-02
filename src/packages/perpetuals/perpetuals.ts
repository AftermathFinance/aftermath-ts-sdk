import { Caller } from "../../general/utils/caller";
import { PerpetualsMarketParams, SuiNetwork, Url } from "../../types";
import { PerpetualsMarket } from "./perpetualsMarket";

export class Perpetuals extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "perpetuals");
	}

	public async getAllMarkets(): Promise<PerpetualsMarket[]> {
		const markets = await this.fetchApi<
			{
				marketParams: PerpetualsMarketParams;
				marketId: bigint;
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

	// get accounts for user
}

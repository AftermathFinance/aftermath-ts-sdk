import { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import { NftAmmMarketData, SuiNetwork } from "../../types";
import { AfEggNftAmmMarket } from "./afEggNftAmmMarket";

export class NftAmm extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, "nft-amm");
	}

	// =========================================================================
	//  Class Objects
	// =========================================================================

	// =========================================================================
	//  Market Class
	// =========================================================================

	public async getAllMarkets() {
		const market = await this.fetchApi<NftAmmMarketData>(`markets`);
		return new AfEggNftAmmMarket(market, this.network, this.Provider);
	}

	public async getAfEggMarket() {
		const market = await this.fetchApi<NftAmmMarketData>(`markets/af-egg`);
		return new AfEggNftAmmMarket(market, this.network, this.Provider);
	}
}

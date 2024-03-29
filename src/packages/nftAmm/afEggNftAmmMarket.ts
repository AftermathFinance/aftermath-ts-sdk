import { SuiNetwork, NftAmmMarketData } from "../../types";
import { AftermathApi } from "../../general/providers";
import {
	NftAmmMarketGetBuyNftsTransaction,
	NftAmmMarketGetDepositNftsTransaction,
	NftAmmMarketGetNfts,
	NftAmmMarketGetSellNftsTransaction,
	NftAmmMarketGetWithdrawNftsTransaction,
	NftAmmMarketInterface,
} from "./nftAmmMarketInterface";
import { NftAmmMarket } from "./nftAmmMarket";

export class AfEggNftAmmMarket
	extends NftAmmMarket
	implements NftAmmMarketInterface
{
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		market: NftAmmMarketData,
		network?: SuiNetwork,
		Provider?: AftermathApi
	) {
		super(market, network, Provider);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	getBuyNftsTransaction: NftAmmMarketGetBuyNftsTransaction = (inputs) => {
		return this.useProvider().fetchBuildBuyAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getSellNftsTransaction: NftAmmMarketGetSellNftsTransaction = (inputs) => {
		return this.useProvider().fetchBuildSellAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getDepositNftsTransaction: NftAmmMarketGetDepositNftsTransaction = (
		inputs
	) => {
		return this.useProvider().fetchBuildDepositAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getWithdrawNftsTransaction: NftAmmMarketGetWithdrawNftsTransaction = (
		inputs
	) => {
		return this.useProvider().fetchBuildWithdrawAfEggsTx({
			...inputs,
			market: this,
		});
	};
}

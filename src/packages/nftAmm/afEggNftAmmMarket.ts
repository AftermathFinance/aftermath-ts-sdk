import { SuiNetwork, NftAmmMarketData } from "../../types";
import { AftermathApi } from "../../general/providers";
import {
	NftAmmMarketGetBuyNftsTransaction,
	NftAmmMarketGetDepositNftsTransaction,
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
		return this.useProvider().nftAmm.fetchBuildBuyAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getSellNftsTransaction: NftAmmMarketGetSellNftsTransaction = (inputs) => {
		return this.useProvider().nftAmm.fetchBuildSellAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getDepositNftsTransaction: NftAmmMarketGetDepositNftsTransaction = (
		inputs
	) => {
		return this.useProvider().nftAmm.fetchBuildDepositAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getWithdrawNftsTransaction: NftAmmMarketGetWithdrawNftsTransaction = (
		inputs
	) => {
		return this.useProvider().nftAmm.fetchBuildWithdrawAfEggsTx({
			...inputs,
			market: this,
		});
	};
}

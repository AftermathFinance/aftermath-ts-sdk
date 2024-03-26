import { SuiNetwork, NftAmmMarketData } from "../../types";
import { AftermathApi } from "../../general/providers";
import {
	NftAmmMarketGetBuyTransaction,
	NftAmmMarketGetDepositTransaction,
	NftAmmMarketGetNfts,
	NftAmmMarketGetSellTransaction,
	NftAmmMarketGetWithdrawTransaction,
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
	//  Objects
	// =========================================================================

	getNfts: NftAmmMarketGetNfts = (inputs) => {
		return this.useProvider().fetchNftsInMarketWithCursor({
			...inputs,
			kioskId: this.market.vault.kioskStorage?.kiosk.objectId!,
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	getBuyTransaction: NftAmmMarketGetBuyTransaction = (inputs) => {
		return this.useProvider().fetchBuildBuyAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getSellTransaction: NftAmmMarketGetSellTransaction = (inputs) => {
		return this.useProvider().fetchBuildSellAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getDepositTransaction: NftAmmMarketGetDepositTransaction = (inputs) => {
		return this.useProvider().fetchBuildDepositAfEggsTx({
			...inputs,
			market: this,
		});
	};

	getWithdrawTransaction: NftAmmMarketGetWithdrawTransaction = (inputs) => {
		return this.useProvider().fetchBuildWithdrawAfEggsTx({
			...inputs,
			market: this,
		});
	};
}

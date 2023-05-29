import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";

import {
    AccountManager,
	MarketManager,
	Orderbook,
	PriceFeedStorage,
} from "../../../types";
import { PerpetualsHelpers } from "./perpetualsApiHelpers";
import { PerpetualsCasting } from "./perpetualsCasting";

export class PerpetualsApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new PerpetualsHelpers(Provider);
	}

	public fetchAccountManager = async (
		objectId: ObjectId
	): Promise<AccountManager> => {
		return this.Provider.Objects().fetchCastObject<AccountManager>(
            objectId,
            PerpetualsCasting.accountManagerFromSuiObjectResponse
		);
	};

	public fetchMarketManager = async (
		objectId: ObjectId
	): Promise<MarketManager> => {
		return this.Provider.Objects().fetchCastObject<MarketManager>(
            objectId,
            PerpetualsCasting.marketManagerFromSuiObjectResponse
		);
	};

	public fetchPriceFeedStorage = async (
		objectId: ObjectId
	): Promise<PriceFeedStorage> => {
		return this.Provider.Objects().fetchCastObject<PriceFeedStorage>(
            objectId,
            PerpetualsCasting.priceFeedStorageFromSuiObjectResponse
		);
	};
}
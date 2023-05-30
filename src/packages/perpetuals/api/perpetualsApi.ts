import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";

import {
    PerpetualsAccountManager,
	PerpetualsMarketManager,
	PerpetualsOrderbook,
	PerpetualsPriceFeedStorage,
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

	/////////////////////////////////////////////////////////////////////
	//// Shared Objects
	/////////////////////////////////////////////////////////////////////
	public fetchAccountManager = async (
		objectId: ObjectId
	): Promise<PerpetualsAccountManager> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsAccountManager>(
            objectId,
            PerpetualsCasting.accountManagerFromSuiObjectResponse
		);
	};

	public fetchMarketManager = async (
		objectId: ObjectId
	): Promise<PerpetualsMarketManager> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsMarketManager>(
            objectId,
            PerpetualsCasting.marketManagerFromSuiObjectResponse
		);
	};

	public fetchPriceFeedStorage = async (
		objectId: ObjectId
	): Promise<PerpetualsPriceFeedStorage> => {
		return this.Provider.Objects().fetchCastObject<PerpetualsPriceFeedStorage>(
            objectId,
            PerpetualsCasting.priceFeedStorageFromSuiObjectResponse
		);
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////
}
import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { NftAmmApiHelpers } from "./nftAmmApiHelpers";
import { Nft, NftAmmMarketObject } from "../nftAmmTypes";
import { NftAmmApiCasting } from "./nftAmmApiCasting";
import { NftAmmMarket } from "../nftAmmMarket";
import {
	Balance,
	DynamicFieldObjectsWithCursor,
	SerializedTransaction,
	Slippage,
} from "../../../types";

export class NftAmmApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new NftAmmApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public fetchNfts = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<Nft[]> => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse: NftAmmApiCasting.nftFromSuiObject,
			options: {
				// NOTE: do we need all of this ?
				showContent: true,
				showOwner: true,
				showType: true,
				showDisplay: true,
			},
		});
	};

	public fetchNftsInMarketTable = async (inputs: {
		marketTableObjectId: ObjectId;
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> => {
		return await this.Provider.DynamicFields().fetchCastDynamicFieldsOfTypeWithCursor(
			{
				...inputs,
				parentObjectId: inputs.marketTableObjectId,
				objectsFromObjectIds: (objectIds) =>
					this.fetchNfts({ objectIds }),
			}
		);
	};

	public fetchMarket = async (inputs: {
		objectId: ObjectId;
	}): Promise<NftAmmMarketObject> => {
		return this.Provider.Objects().fetchCastObject({
			...inputs,
			objectFromSuiObjectResponse:
				NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

	public fetchMarkets = async (inputs: {
		objectIds: ObjectId[];
	}): Promise<NftAmmMarketObject[]> => {
		return this.Provider.Objects().fetchCastObjectBatch({
			...inputs,
			objectFromSuiObjectResponse:
				NftAmmApiCasting.marketObjectFromSuiObject,
		});
	};

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public fetchBuyTransaction = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildBuyTransaction({
				...inputs,
			})
		);
	};

	public fetchSellTransaction = async (inputs: {
		market: NftAmmMarket;
		walletAddress: SuiAddress;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildSellTransaction({
				...inputs,
			})
		);
	};

	public fetchDepositTransaction = async (inputs: {
		walletAddress: SuiAddress;
		market: NftAmmMarket;
		assetCoinAmountIn: Balance;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildDepositTransaction({
				...inputs,
				nfts: inputs.nftObjectIds,
			})
		);
	};

	public fetchWithdrawTransaction = async (inputs: {
		walletAddress: SuiAddress;
		market: NftAmmMarket;
		lpCoinAmount: Balance;
		nftObjectIds: ObjectId[];
		slippage: Slippage;
		referrer?: SuiAddress;
	}): Promise<SerializedTransaction> => {
		return this.Provider.Transactions().fetchSetGasBudgetAndSerializeTransaction(
			this.Helpers.fetchBuildWithdrawTransaction({
				...inputs,
			})
		);
	};
}

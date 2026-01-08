import {
	SuiNetwork,
	NftAmmMarketObject,
	ApiNftAmmDepositBody,
	Balance,
	ApiNftAmmWithdrawBody,
	ApiNftAmmBuyBody,
	Nft,
	DynamicFieldObjectsWithCursor,
	ApiDynamicFieldsBody,
	ApiNftAmmSellBody,
	Url,
	ObjectId,
	CallerConfig,
} from "../../types.ts";
import { Caller } from "../../general/utils/caller.ts";
import { Pool } from "../pools/index.ts";
import { AftermathApi } from "../../general/providers/index.ts";
import { Transaction } from "@mysten/sui/transactions";

export class NftAmmMarket extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {};

	// =========================================================================
	//  Public Class Members
	// =========================================================================

	public pool: Pool;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly market: NftAmmMarketObject,
		config?: CallerConfig,
		private readonly Provider?: AftermathApi
	) {
		super(config, `nft-amm/markets/${market.objectId}`);
		this.market = market;
		this.pool = new Pool(market.pool, config);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getNfts(inputs: {
		cursor?: ObjectId;
		limit?: number;
	}): Promise<DynamicFieldObjectsWithCursor<Nft>> {
		const { cursor, limit } = inputs;
		return this.useProvider().fetchNftsInMarketTable({
			marketTableObjectId: this.market.objectId,
			limit: limit ?? 25,
			cursor,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getBuyTransaction(
		inputs: ApiNftAmmBuyBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildBuyTx({
			...inputs,
			market: this,
		});
	}

	public async getSellTransaction(
		inputs: ApiNftAmmSellBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildSellTx({
			...inputs,
			market: this,
		});
	}

	public async getDepositTransaction(
		inputs: ApiNftAmmDepositBody
	): Promise<Transaction> {
		const { nftObjectIds: nfts, ...otherInputs } = inputs;
		return this.useProvider().fetchBuildDepositTx({
			...otherInputs,
			nfts,
			market: this,
		});
	}

	public async getWithdrawTransaction(
		inputs: ApiNftAmmWithdrawBody
	): Promise<Transaction> {
		return this.useProvider().fetchBuildWithdrawTx({
			...inputs,
			market: this,
		});
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	public getNftSpotPriceInAssetCoin = (inputs?: {
		withFees: boolean;
	}): Balance => {
		const assetToFractionalizedSpotPrice =
			this.getAssetCoinToFractionalizeCoinSpotPrice(inputs);

		return BigInt(
			assetToFractionalizedSpotPrice *
				Number(this.market.fractionalizedCoinAmount)
		);
	};

	public getFractionalizedCoinToAssetCoinSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.market.fractionalizedCoinType,
			coinOutType: this.market.assetCoinType,
			withFees: inputs?.withFees,
		});
	};

	public getAssetCoinToFractionalizeCoinSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.market.assetCoinType,
			coinOutType: this.market.fractionalizedCoinType,
			withFees: inputs?.withFees,
		});
	};

	public getBuyAssetCoinAmountIn = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountIn({
			coinOutAmount:
				BigInt(inputs.nftsCount) * this.market.fractionalizedCoinAmount,
			coinInType: this.market.assetCoinType,
			coinOutType: this.market.fractionalizedCoinType,
			referral: inputs.referral,
		});
	};

	public getSellAssetCoinAmountOut = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountOut({
			coinInAmount:
				BigInt(inputs.nftsCount) * this.market.fractionalizedCoinAmount,
			coinInType: this.market.fractionalizedCoinType,
			coinOutType: this.market.assetCoinType,
			referral: inputs.referral,
		});
	};

	public getDepositLpCoinAmountOut = (inputs: {
		assetCoinAmountIn: Balance;
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		return this.pool.getDepositLpAmountOut({
			amountsIn: {
				[this.market.assetCoinType]: inputs.assetCoinAmountIn,
			},
			referral: inputs.referral,
		});
	};

	public getWithdrawFractionalizedCoinAmountOut = (inputs: {
		// NOTE: do we need a better direction approximation here ?
		lpCoinAmount: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
			lpCoinAmountIn: inputs.lpCoinAmount,
		});

		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.market.fractionalizedCoinType]:
					this.market.fractionalizedCoinAmount,
			},
			referral: inputs.referral,
		});

		const fractionalizedCoinAmountOut = amountsOut[0];
		return fractionalizedCoinAmountOut;
	};

	public getWithdrawNftsCountOut = (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}): bigint => {
		const fractionalizedCoinAmountOut =
			this.getWithdrawFractionalizedCoinAmountOut(inputs);
		const minNftsCountOut =
			fractionalizedCoinAmountOut / this.market.fractionalizedCoinAmount;

		return minNftsCountOut;
	};

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.NftAmm();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

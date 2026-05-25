import type { Transaction } from "@mysten/sui/transactions";
import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	ApiNftAmmBuyBody,
	ApiNftAmmDepositBody,
	ApiNftAmmSellBody,
	ApiNftAmmWithdrawBody,
	Balance,
	CallerConfig,
	DynamicFieldObjectsWithCursor,
	Nft,
	NftAmmMarketObject,
	ObjectId,
} from "../../types";
import { Pool } from "../pools";

export class NftAmmMarket extends Caller {
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
		private readonly api?: AftermathApi
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
		return this.nftAmmApi().fetchNftsInMarketTable({
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
		return this.nftAmmApi().fetchBuildBuyTx({
			...inputs,
			market: this,
		});
	}

	public async getSellTransaction(
		inputs: ApiNftAmmSellBody
	): Promise<Transaction> {
		return this.nftAmmApi().fetchBuildSellTx({
			...inputs,
			market: this,
		});
	}

	public async getDepositTransaction(
		inputs: ApiNftAmmDepositBody
	): Promise<Transaction> {
		const { nftObjectIds: nfts, ...otherInputs } = inputs;
		return this.nftAmmApi().fetchBuildDepositTx({
			...otherInputs,
			nfts,
			market: this,
		});
	}

	public async getWithdrawTransaction(
		inputs: ApiNftAmmWithdrawBody
	): Promise<Transaction> {
		return this.nftAmmApi().fetchBuildWithdrawTx({
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

	private readonly nftAmmApi = () => {
		const nftAmm = this.api?.NftAmm();
		if (!nftAmm) {
			throw new Error("missing AftermathApi instance");
		}
		return nftAmm;
	};
}

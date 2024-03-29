import {
	SuiNetwork,
	NftAmmMarketData,
	Balance,
	ObjectId,
	SuiAddress,
	Slippage,
	CoinType,
	AnyObjectType,
	CoinsToBalance,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Pool } from "../pools";
import { AftermathApi } from "../../general/providers";
import {
	NftAmmMarketGetAllNfts,
	NftAmmMarketGetNfts,
	NftAmmMarketInterface,
} from "./nftAmmMarketInterface";

export class NftAmmMarket extends Caller {
	// =========================================================================
	//  Private Constants
	// =========================================================================

	private static readonly constants = {};

	// =========================================================================
	//  Public Class Members
	// =========================================================================

	public readonly pool: Pool;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly market: NftAmmMarketData,
		public readonly network?: SuiNetwork,
		private readonly Provider?: AftermathApi
	) {
		super(network, `nft-amm/markets/${market.vault.objectId}`);
		this.market = market;
		this.pool = new Pool(market.pool, network, Provider);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	getNfts: NftAmmMarketGetNfts = (inputs) => {
		return this.useProvider().fetchNftsInMarketWithCursor({
			...inputs,
			kioskId: this.market.vault.kioskStorage?.kiosk.objectId!,
			kioskOwnerCapId: this.market.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	getAllNfts: NftAmmMarketGetAllNfts = () => {
		return this.useProvider().fetchNftsInMarket({
			kioskId: this.market.vault.kioskStorage?.kiosk.objectId!,
			kioskOwnerCapId: this.market.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	// =========================================================================
	//  Calculations
	// =========================================================================

	public getNftSpotPriceInAfSui = (inputs?: {
		withFees: boolean;
	}): Balance => {
		const assetToFractionalizedSpotPrice =
			this.getAfSuiToFractionalCoinSpotPrice(inputs);

		return BigInt(
			assetToFractionalizedSpotPrice * Number(this.fractionsAmount())
		);
	};

	public getFractionalCoinToAfSuiSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.fractionalCoinType(),
			coinOutType: this.afSuiCoinType(),
			withFees: inputs?.withFees,
		});
	};

	public getAfSuiToFractionalCoinSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.afSuiCoinType(),
			coinOutType: this.fractionalCoinType(),
			withFees: inputs?.withFees,
		});
	};

	public getBuyAfSuiAmountIn = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountIn({
			coinOutAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
			coinInType: this.afSuiCoinType(),
			coinOutType: this.fractionalCoinType(),
			referral: inputs.referral,
		});
	};

	public getSellAfSuiAmountOut = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountOut({
			coinInAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
			coinInType: this.fractionalCoinType(),
			coinOutType: this.afSuiCoinType(),
			referral: inputs.referral,
		});
	};

	public getDepositLpAmountOut = (inputs: {
		amountsIn: CoinsToBalance;
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		return this.pool.getDepositLpAmountOut(inputs);
	};

	public getDepositNftsLpAmountOut = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): {
		lpAmountOut: Balance;
		lpRatio: number;
	} => {
		return this.getDepositLpAmountOut({
			...inputs,
			amountsIn: {
				[this.fractionalCoinType()]:
					BigInt(Math.round(inputs.nftsCount)) *
					this.fractionsAmount(),
			},
		});
	};

	public getWithdrawFractionalCoinAmountOut = (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio(inputs);
		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.fractionalCoinType()]: this.fractionsAmount(),
			},
			referral: inputs.referral,
		});
		return Object.values(amountsOut)[0];
	};

	public getWithdrawAfSuiAmountOut = (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio(inputs);
		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.afSuiCoinType()]: BigInt(
					Math.round(
						Number(this.fractionsAmount()) *
							this.getAfSuiToFractionalCoinSpotPrice()
					)
				),
			},
			referral: inputs.referral,
		});
		return Object.values(amountsOut)[0];
	};

	public getWithdrawNftsCountOut = (inputs: {
		lpCoinAmountOut: Balance;
		referral?: boolean;
	}): bigint => {
		const fractionalCoinAmountOut =
			this.getWithdrawFractionalCoinAmountOut(inputs);
		return fractionalCoinAmountOut / this.fractionsAmount();
	};

	// =========================================================================
	//  Getters
	// =========================================================================

	public fractionalCoinType = (): CoinType => {
		return this.market.vault.fractionalCoinType;
	};

	public afSuiCoinType = (): CoinType => {
		return Object.keys(this.market.pool.coins).find(
			(coin) => coin !== this.fractionalCoinType()
		)!;
	};

	public lpCoinType = (): CoinType => {
		return this.market.pool.lpCoinType;
	};

	public nftType = (): AnyObjectType => {
		return this.market.vault.nftType;
	};

	public fractionsAmount = (): Balance => {
		return this.market.vault.fractionsAmount;
	};

	// =========================================================================
	//  Protected Helpers
	// =========================================================================

	protected useProvider = () => {
		const provider = this.Provider?.NftAmm();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

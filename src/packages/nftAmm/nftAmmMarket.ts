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
	CoinDecimal,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { Pool } from "../pools";
import { AftermathApi } from "../../general/providers";
import {
	NftAmmMarketGetAllNfts,
	NftAmmMarketGetBuyFractionalCoinTransaction,
	NftAmmMarketGetDepositCoinsTransaction,
	NftAmmMarketGetNfts,
	NftAmmMarketGetSellFractionalCoinTransaction,
	NftAmmMarketGetWithdrawCoinsTransaction,
	NftAmmMarketInterface,
} from "./nftAmmMarketInterface";
import { Coin } from "..";

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
		return this.useProvider().nftAmm.fetchNftsInMarketWithCursor({
			...inputs,
			kioskId: this.market.vault.kioskStorage?.ownerCap.forObjectId!,
			kioskOwnerCapId: this.market.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	getAllNfts: NftAmmMarketGetAllNfts = () => {
		return this.useProvider().nftAmm.fetchNftsInKiosk({
			kioskId: this.market.vault.kioskStorage?.ownerCap.forObjectId!,
			kioskOwnerCapId: this.market.vault.kioskStorage?.ownerCap.objectId!,
		});
	};

	// =========================================================================
	//  Transactions
	// =========================================================================

	getBuyFractionalCoinTransaction: NftAmmMarketGetBuyFractionalCoinTransaction =
		(inputs) => {
			return this.useProvider().pools.fetchBuildTradeAmountOutTx({
				...inputs,
				pool: this.pool,
				coinOutAmount: inputs.fractionalAmountOut,
				coinInType: this.afSuiCoinType(),
				coinOutType: this.fractionalCoinType(),
			});
		};

	getSellFractionalCoinTransaction: NftAmmMarketGetSellFractionalCoinTransaction =
		(inputs) => {
			return this.useProvider().pools.fetchBuildTradeTx({
				...inputs,
				pool: this.pool,
				coinInAmount: inputs.fractionalAmountIn,
				coinInType: this.fractionalCoinType(),
				coinOutType: this.afSuiCoinType(),
			});
		};

	getDepositCoinsTransaction: NftAmmMarketGetDepositCoinsTransaction = (
		inputs
	) => {
		return this.useProvider().pools.fetchBuildDepositTx({
			...inputs,
			pool: this.pool,
		});
	};

	getWithdrawCoinsTransaction: NftAmmMarketGetWithdrawCoinsTransaction = (
		inputs
	) => {
		return this.useProvider().pools.fetchBuildWithdrawTx({
			...inputs,
			pool: this.pool,
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
			Math.round(
				assetToFractionalizedSpotPrice * Number(this.fractionsAmount())
			)
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

	public getBuyNftsAfSuiAmountIn = (inputs: {
		nftsCount: number;
		// slippage: Slippage;
		referral?: boolean;
	}): Balance => {
		if (inputs.nftsCount <= 0) return BigInt(0);
		const amountIn = this.pool.getTradeAmountIn({
			coinOutAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
			coinInType: this.afSuiCoinType(),
			coinOutType: this.fractionalCoinType(),
			referral: inputs.referral,
		});
		return amountIn;
		// increase amount to account for slippage
		// return BigInt(Math.ceil(Number(amountIn) * (1 + inputs.slippage)));
	};

	public getSellNftsAfSuiAmountOut = (inputs: {
		nftsCount: number;
		referral?: boolean;
	}): Balance => {
		if (inputs.nftsCount <= 0) return BigInt(0);
		return this.pool.getTradeAmountOut({
			coinInAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
			coinInType: this.fractionalCoinType(),
			coinOutType: this.afSuiCoinType(),
			referral: inputs.referral,
		});
	};

	public getBuyFractionalCoinAfSuiAmountIn = (inputs: {
		fractionalAmountOut: Balance;
		// slippage: Slippage;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountIn({
			coinOutAmount: inputs.fractionalAmountOut,
			coinInType: this.afSuiCoinType(),
			coinOutType: this.fractionalCoinType(),
			referral: inputs.referral,
		});
	};

	public getBuyFractionalCoinAmountOut = (inputs: {
		afSuiAmountIn: Balance;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountOut({
			coinInAmount: inputs.afSuiAmountIn,
			coinInType: this.afSuiCoinType(),
			coinOutType: this.fractionalCoinType(),
			referral: inputs.referral,
		});
	};

	public getSellFractionalCoinAfSuiAmountOut = (inputs: {
		fractionalAmountIn: Balance;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountOut({
			coinInAmount: inputs.fractionalAmountIn,
			coinInType: this.fractionalCoinType(),
			coinOutType: this.afSuiCoinType(),
			referral: inputs.referral,
		});
	};

	public getSellFractionalCoinAmountIn = (inputs: {
		afSuiAmountOut: Balance;
		referral?: boolean;
	}): Balance => {
		return this.pool.getTradeAmountIn({
			coinOutAmount: inputs.afSuiAmountOut,
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
		if (inputs.nftsCount <= 0)
			return {
				lpAmountOut: BigInt(0),
				lpRatio: 1,
			};
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
		lpCoinAmount: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
			...inputs,
			lpCoinAmountOut: inputs.lpCoinAmount,
		});
		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.fractionalCoinType()]: this.fractionsAmount(),
			},
			referral: inputs.referral,
		});
		return amountsOut[this.fractionalCoinType()];
	};

	public getWithdrawAfSuiAmountOut = (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}): Balance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
			...inputs,
			lpCoinAmountOut: inputs.lpCoinAmount,
		});
		const spotPrice = this.getAfSuiToFractionalCoinSpotPrice();
		const amountsOut = this.pool.getWithdrawAmountsOut({
			lpRatio,
			amountsOutDirection: {
				[this.afSuiCoinType()]: BigInt(
					Math.round(
						Number(this.fractionsAmount()) *
							(spotPrice <= 0 ? 1 : spotPrice)
					)
				),
			},
			referral: inputs.referral,
		});
		return amountsOut[this.afSuiCoinType()];
	};

	public getWithdrawAmountsOut = (inputs: {
		lpCoinAmount: Balance;
		amountsOutDirection: CoinsToBalance;
		referral?: boolean;
	}): CoinsToBalance => {
		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
			...inputs,
			lpCoinAmountOut: inputs.lpCoinAmount,
		});
		return this.pool.getWithdrawAmountsOut({
			...inputs,
			lpRatio,
		});
	};

	public getWithdrawNftsCountOut = (inputs: {
		lpCoinAmount: Balance;
		referral?: boolean;
	}): number => {
		const fractionalCoinAmountOut =
			this.getWithdrawFractionalCoinAmountOut(inputs);
		return Number(fractionalCoinAmountOut / this.fractionsAmount());
	};

	public getWithdrawNftsLpAmountIn = (inputs: {
		nftsCount: number;
		slippage: Slippage;
		referral?: boolean;
	}): Balance => {
		const amountIn = this.pool.getWithdrawLpAmountIn({
			amountsOut: {
				[this.fractionalCoinType()]:
					this.fractionsAmount() * BigInt(inputs.nftsCount),
			},
			referral: inputs.referral,
		});
		// increase amount to account for slippage
		return BigInt(Math.ceil(Number(amountIn) * (1 + inputs.slippage)));
	};

	public getWithdrawLpAmountIn = (inputs: {
		amountsOut: CoinsToBalance;
		referral?: boolean;
	}): Balance => {
		return this.pool.getWithdrawLpAmountIn({
			amountsOut: inputs.amountsOut,
			referral: inputs.referral,
		});
	};

	public getNftEquivalence = (inputs: {
		fractionalAmount: Balance | number;
	}) => {
		return (
			(typeof inputs.fractionalAmount === "number"
				? inputs.fractionalAmount
				: Coin.balanceWithDecimals(
						inputs.fractionalAmount,
						this.fractionalCoinDecimals()
				  )) /
			Coin.balanceWithDecimals(
				this.fractionsAmount(),
				this.fractionalCoinDecimals()
			)
		);
	};

	public getFractionalCoinEquivalence = (inputs: { nftsCount: number }) => {
		return BigInt(Math.round(inputs.nftsCount)) * this.fractionsAmount();
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

	public fractionalCoinDecimals = (): CoinDecimal => {
		const decimals =
			this.market.pool.coins[this.fractionalCoinType()].decimals;
		if (!decimals) throw new Error("no decimals found for fractional coin");
		return decimals;
	};

	public lpCoinDecimals = (): CoinDecimal => {
		return this.pool.pool.lpCoinDecimals;
	};

	// NOTE: should this just be hardcoded ?
	public afSuiCoinDecimals = (): CoinDecimal => {
		const decimals = this.market.pool.coins[this.afSuiCoinType()].decimals;
		if (!decimals) throw new Error("no decimals found for afsui coin");
		return decimals;
	};

	// =========================================================================
	//  Protected Helpers
	// =========================================================================

	protected useProvider = () => {
		const nftAmm = this.Provider?.NftAmm();
		const pools = this.Provider?.Pools();
		if (!nftAmm || !pools) throw new Error("missing AftermathApi Provider");
		return {
			nftAmm,
			pools,
		};
	};
}

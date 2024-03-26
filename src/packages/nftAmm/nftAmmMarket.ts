// import {
// 	SuiNetwork,
// 	NftAmmMarketData,
// 	Balance,
// 	Nft,
// 	DynamicFieldObjectsWithCursor,
// 	ApiDynamicFieldsBody,
// 	Url,
// 	ObjectId,
// 	SuiAddress,
// 	Slippage,
// 	CoinType,
// 	AnyObjectType,
// } from "../../types";
// import { Caller } from "../../general/utils/caller";
// import { Pool } from "../pools";
// import { AftermathApi } from "../../general/providers";

// export class NftAmmMarket extends Caller {
// 	// =========================================================================
// 	//  Private Constants
// 	// =========================================================================

// 	private static readonly constants = {};

// 	// =========================================================================
// 	//  Public Class Members
// 	// =========================================================================

// 	public pool: Pool;

// 	// =========================================================================
// 	//  Constructor
// 	// =========================================================================

// 	constructor(
// 		public readonly market: NftAmmMarketData,
// 		public readonly network?: SuiNetwork,
// 		private readonly Provider?: AftermathApi
// 	) {
// 		super(network, `nft-amm/markets/${market.vault}`);
// 		this.market = market;
// 		this.pool = new Pool(market.pool, network);
// 	}

// 	// =========================================================================
// 	//  Objects
// 	// =========================================================================

// 	public async getNfts(inputs: { cursor?: ObjectId; limit?: number }) {
// 		return this.fetchApi<
// 			DynamicFieldObjectsWithCursor<Nft>,
// 			ApiDynamicFieldsBody
// 		>("nfts", inputs);
// 	}

// 	// =========================================================================
// 	//  Transactions
// 	// =========================================================================

// 	public async getBuyTransaction(inputs: {
// 		walletAddress: SuiAddress;
// 		nftIds: ObjectId[];
// 		slippage: Slippage;
// 		referrer?: SuiAddress;
// 	}) {
// 		return this.useProvider().fetchBuildBuyTx({
// 			...inputs,
// 			market: this,
// 		});
// 	}

// 	public async getSellTransaction(inputs: {
// 		walletAddress: SuiAddress;
// 		nftIds: ObjectId[];
// 		slippage: Slippage;
// 		referrer?: SuiAddress;
// 	}) {
// 		return this.useProvider().fetchBuildSellTx({
// 			...inputs,
// 			market: this,
// 		});
// 	}

// 	public async getDepositTransaction(inputs: {
// 		walletAddress: SuiAddress;
// 		afSuiAmount: Balance;
// 		nfts: ObjectId[];
// 		slippage: Slippage;
// 		referrer?: SuiAddress;
// 	}) {
// 		return this.useProvider().fetchBuildDepositTx({
// 			...inputs,
// 			market: this,
// 		});
// 	}

// 	public async getWithdrawTransaction(inputs: {
// 		walletAddress: SuiAddress;
// 		lpCoinAmount: Balance;
// 		nftIds: ObjectId[];
// 		slippage: Slippage;
// 		referrer?: SuiAddress;
// 	}) {
// 		return this.useProvider().fetchBuildWithdrawTx({
// 			...inputs,
// 			market: this,
// 		});
// 	}

// 	// =========================================================================
// 	//  Calculations
// 	// =========================================================================

// 	public getNftSpotPriceInAfSui = (inputs?: {
// 		withFees: boolean;
// 	}): Balance => {
// 		const assetToFractionalizedSpotPrice =
// 			this.getAfSuiToFractionalizeCoinSpotPrice(inputs);

// 		return BigInt(
// 			assetToFractionalizedSpotPrice * Number(this.fractionsAmount())
// 		);
// 	};

// 	public getFractionalizedCoinToAfSuiSpotPrice = (inputs?: {
// 		withFees: boolean;
// 	}): number => {
// 		return this.pool.getSpotPrice({
// 			coinInType: this.fractionalCoinType(),
// 			coinOutType: this.afSuiCoinType(),
// 			withFees: inputs?.withFees,
// 		});
// 	};

// 	public getAfSuiToFractionalizeCoinSpotPrice = (inputs?: {
// 		withFees: boolean;
// 	}): number => {
// 		return this.pool.getSpotPrice({
// 			coinInType: this.afSuiCoinType(),
// 			coinOutType: this.fractionalCoinType(),
// 			withFees: inputs?.withFees,
// 		});
// 	};

// 	public getBuyAfSuiAmountIn = (inputs: {
// 		nftsCount: number;
// 		referral?: boolean;
// 	}): Balance => {
// 		return this.pool.getTradeAmountIn({
// 			coinOutAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
// 			coinInType: this.afSuiCoinType(),
// 			coinOutType: this.fractionalCoinType(),
// 			referral: inputs.referral,
// 		});
// 	};

// 	public getSellAfSuiAmountOut = (inputs: {
// 		nftsCount: number;
// 		referral?: boolean;
// 	}): Balance => {
// 		return this.pool.getTradeAmountOut({
// 			coinInAmount: BigInt(inputs.nftsCount) * this.fractionsAmount(),
// 			coinInType: this.fractionalCoinType(),
// 			coinOutType: this.afSuiCoinType(),
// 			referral: inputs.referral,
// 		});
// 	};

// 	public getDepositLpCoinAmountOut = (inputs: {
// 		afSuiAmount: Balance;
// 		referral?: boolean;
// 	}): {
// 		lpAmountOut: Balance;
// 		lpRatio: number;
// 	} => {
// 		return this.pool.getDepositLpAmountOut({
// 			amountsIn: {
// 				[this.afSuiCoinType()]: inputs.afSuiAmount,
// 			},
// 			referral: inputs.referral,
// 		});
// 	};

// 	public getWithdrawFractionalizedCoinAmountOut = (inputs: {
// 		// NOTE: do we need a better direction approximation here ?
// 		lpCoinAmount: Balance;
// 		referral?: boolean;
// 	}): Balance => {
// 		const lpRatio = this.pool.getMultiCoinWithdrawLpRatio({
// 			lpCoinAmountOut: inputs.lpCoinAmount,
// 		});

// 		const amountsOut = this.pool.getWithdrawAmountsOut({
// 			lpRatio,
// 			amountsOutDirection: {
// 				[this.fractionalCoinType()]: this.fractionsAmount(),
// 			},
// 			referral: inputs.referral,
// 		});

// 		const fractionalizedCoinAmountOut = amountsOut[0];
// 		return fractionalizedCoinAmountOut;
// 	};

// 	public getWithdrawNftsCountOut = (inputs: {
// 		lpCoinAmount: Balance;
// 		referral?: boolean;
// 	}): bigint => {
// 		const fractionalizedCoinAmountOut =
// 			this.getWithdrawFractionalizedCoinAmountOut(inputs);
// 		const minNftsCountOut =
// 			fractionalizedCoinAmountOut / this.fractionsAmount();

// 		return minNftsCountOut;
// 	};

// 	// =========================================================================
// 	//  Getters
// 	// =========================================================================

// 	public fractionalCoinType = (): CoinType => {
// 		return this.market.vault.fractionalCoinType;
// 	};

// 	public afSuiCoinType = (): CoinType => {
// 		return Object.keys(this.market.pool.coins).find(
// 			(coin) => coin !== this.fractionalCoinType()
// 		)!;
// 	};

// 	public lpCoinType = (): CoinType => {
// 		return this.market.pool.lpCoinType;
// 	};

// 	public nftType = (): AnyObjectType => {
// 		return this.market.vault.nftType;
// 	};

// 	public fractionsAmount = (): Balance => {
// 		return this.market.vault.fractionsAmount;
// 	};

// 	// =========================================================================
// 	//  Private Helpers
// 	// =========================================================================

// 	private useProvider = () => {
// 		const provider = this.Provider?.NftAmm();
// 		if (!provider) throw new Error("missing AftermathApi Provider");
// 		return provider;
// 	};
// }

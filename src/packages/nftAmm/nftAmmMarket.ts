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

/**
 * Wraps one NFT AMM market with NFT reads, unsigned transaction builders, and
 * pool-based quote calculations.
 *
 * The class does not sign or execute transactions. Its transaction methods
 * return unsigned `Transaction` objects that the caller must sign and submit
 * with a wallet that owns the required input objects.
 */
export class NftAmmMarket extends Caller {
	// =========================================================================
	//  Public Class Members
	// =========================================================================

	/** Pool facade constructed from `market.pool` for local quote calculations. */
	public pool: Pool;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a market facade from an API market object.
	 *
	 * @param market - Market data, including its pool and Move type arguments.
	 * @param config - Optional caller configuration used by NFT-table reads.
	 * @param api - Optional `AftermathApi` used by NFT-table reads and transaction builders.
	 */
	constructor(
		/** Market object and public on-chain market fields. */
		public readonly market: NftAmmMarketObject,
		/** Optional network, API host, endpoint, or access-token configuration. */
		config?: CallerConfig,
		/** Optional low-level provider required by network-backed market methods. */
		private readonly api?: AftermathApi
	) {
		super(config, `nft-amm/markets/${market.objectId}`);
		this.market = market;
		this.pool = new Pool(market.pool, config);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Fetches one page of NFTs stored in the market's dynamic-field table.
	 *
	 * The method uses `market.objectId` as the dynamic-field parent and defaults
	 * `limit` to 25. `cursor` is the object ID returned by the previous page's
	 * `nextCursor`; a `null` result cursor means that the table is exhausted.
	 *
	 * @param inputs - Optional page cursor and maximum number of NFTs.
	 * @returns A page of `Nft` objects and a nullable next cursor.
	 * @throws `Error` when this facade was created without an `AftermathApi` instance.
	 * @throws `AftermathTransportError` when dynamic fields or NFT resolution fails.
	 */
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

	/**
	 * Builds an unsigned transaction that buys the selected NFTs from this market.
	 *
	 * The builder selects the required asset coin from `walletAddress`, sets that
	 * address as the transaction sender, and appends the NFT AMM buy call. The
	 * wallet must own enough of the market's asset coin and must sign the returned
	 * transaction before execution.
	 *
	 * @param inputs - Market ID, wallet address, NFT IDs, decimal slippage, and optional referrer.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws `Error` when this facade has no `AftermathApi` instance.
	 * @throws `AftermathTransportError` when coin selection or the API request fails.
	 */
	public async getBuyTransaction(
		inputs: ApiNftAmmBuyBody
	): Promise<Transaction> {
		return this.nftAmmApi().fetchBuildBuyTx({
			...inputs,
			market: this,
		});
	}

	/**
	 * Builds an unsigned transaction that sells the selected NFTs to this market.
	 *
	 * The wallet identified by `walletAddress` must own the NFT objects supplied
	 * in `nftObjectIds`. The returned transaction transfers the calculated asset
	 * coin output to that sender when the Move call executes.
	 *
	 * @param inputs - Market ID, wallet address, NFT IDs, decimal slippage, and optional referrer.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws `Error` when this facade has no `AftermathApi` instance.
	 */
	public async getSellTransaction(
		inputs: ApiNftAmmSellBody
	): Promise<Transaction> {
		return this.nftAmmApi().fetchBuildSellTx({
			...inputs,
			market: this,
		});
	}

	/**
	 * Builds an unsigned transaction that deposits an asset coin and NFTs into this market.
	 *
	 * The asset amount is in the asset coin's smallest unit. The builder selects
	 * that amount from `walletAddress`, calculates the expected LP ratio, and
	 * appends the deposit call. The wallet must own the asset coin and NFT inputs
	 * and must sign the returned transaction.
	 *
	 * @param inputs - Market ID, wallet address, asset amount, NFT IDs, decimal slippage, and optional referrer.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws `Error` when this facade has no `AftermathApi` instance.
	 * @throws `AftermathTransportError` when coin selection or the API request fails.
	 */
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

	/**
	 * Builds an unsigned transaction that withdraws LP liquidity and selected NFTs.
	 *
	 * `lpCoinAmount` is in the LP coin's smallest unit. The builder selects that
	 * LP coin from `walletAddress`, estimates the asset-coin minimum output, and
	 * appends the withdraw call. The wallet must own the LP coin and must sign the
	 * returned transaction.
	 *
	 * @param inputs - Market ID, wallet address, LP amount, NFT IDs, decimal slippage, and optional referrer.
	 * @returns An unsigned Sui `Transaction` with the sender set.
	 * @throws `Error` when this facade has no `AftermathApi` instance.
	 * @throws `AftermathTransportError` when coin selection or the API request fails.
	 */
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

	/**
	 * Estimates the spot price of one NFT in asset-coin smallest units.
	 *
	 * The calculation multiplies the pool's asset-to-fractionalized-coin spot
	 * price by `market.fractionalizedCoinAmount` and converts the JavaScript
	 * number result to `bigint`. The conversion therefore has the precision limits
	 * of the intermediate `number` calculation.
	 *
	 * @param inputs - Optional `withFees` flag passed to the pool spot-price calculation.
	 * @returns The estimated asset-coin amount for one NFT, in smallest units.
	 */
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

	/**
	 * Calculates the pool spot price from fractionalized coin to asset coin.
	 *
	 * The result is a JavaScript number adjusted for both coins' decimal scalars,
	 * not a raw `Balance`. Set `withFees` to include pool fees in the spot price;
	 * omit it to use the pool calculation's default fee behavior.
	 *
	 * @param inputs - Optional `withFees` flag.
	 * @returns Asset-coin output units per fractionalized-coin input unit.
	 */
	public getFractionalizedCoinToAssetCoinSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.market.fractionalizedCoinType,
			coinOutType: this.market.assetCoinType,
			withFees: inputs?.withFees,
		});
	};

	/**
	 * Calculates the pool spot price from asset coin to fractionalized coin.
	 *
	 * The result is a JavaScript number adjusted for both coins' decimal scalars,
	 * not a raw `Balance`. Set `withFees` to include pool fees in the spot price;
	 * omit it to use the pool calculation's default fee behavior.
	 *
	 * @param inputs - Optional `withFees` flag.
	 * @returns Fractionalized-coin output units per asset-coin input unit.
	 */
	public getAssetCoinToFractionalizeCoinSpotPrice = (inputs?: {
		withFees: boolean;
	}): number => {
		return this.pool.getSpotPrice({
			coinInType: this.market.assetCoinType,
			coinOutType: this.market.fractionalizedCoinType,
			withFees: inputs?.withFees,
		});
	};

	/**
	 * Calculates the asset-coin amount required to buy a number of NFTs.
	 *
	 * The requested fractionalized output equals `nftsCount` multiplied by the
	 * market's fractionalized amount per NFT. The result is in the asset coin's
	 * smallest unit. A defined `referral` flag enables referral-aware pool math.
	 *
	 * @param inputs - NFT count and optional referral flag.
	 * @returns Required asset-coin input in smallest units.
	 * @throws `Error` when the requested trade exceeds pool limits or produces no output.
	 */
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

	/**
	 * Calculates the asset-coin amount received for selling a number of NFTs.
	 *
	 * The fractionalized input equals `nftsCount` multiplied by the market's
	 * fractionalized amount per NFT. The result is in the asset coin's smallest
	 * unit. A defined `referral` flag enables referral-aware pool math.
	 *
	 * @param inputs - NFT count and optional referral flag.
	 * @returns Asset-coin output in smallest units.
	 * @throws `Error` when the requested trade exceeds pool limits or produces no output.
	 */
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

	/**
	 * Calculates LP output for depositing an asset-coin amount.
	 *
	 * The returned `lpAmountOut` is in LP-coin smallest units. `lpRatio` is the
	 * pool's local JavaScript-number ratio and is not itself a coin amount.
	 *
	 * @param inputs - Asset-coin amount in smallest units and optional referral flag.
	 * @returns LP amount and the calculated local LP ratio.
	 * @throws `Error` when the pool cannot calculate a valid deposit ratio.
	 */
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

	/**
	 * Estimates the fractionalized-coin output for an LP withdrawal.
	 *
	 * The method converts `lpCoinAmount` to the pool's local withdrawal ratio and
	 * requests a fractionalized-coin output direction equal to one NFT's
	 * fractionalized amount. The returned value is in fractionalized-coin
	 * smallest units. A defined `referral` flag enables referral-aware pool math.
	 *
	 * @param inputs - LP-coin amount in smallest units and optional referral flag.
	 * @returns Fractionalized-coin output in smallest units.
	 * @throws `Error` when the pool withdrawal calculation fails or exceeds limits.
	 */
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

	/**
	 * Estimates how many whole NFTs correspond to an LP withdrawal.
	 *
	 * The method divides the estimated fractionalized-coin output by the market's
	 * fractionalized amount per NFT using bigint integer division, so any partial
	 * NFT amount is discarded. The underlying withdrawal calculation may throw
	 * when the requested LP amount is outside the pool's supported range.
	 *
	 * @param inputs - LP-coin amount in smallest units and optional referral flag.
	 * @returns The minimum whole NFT count as a `bigint`.
	 * @throws `Error` when the underlying withdrawal calculation cannot converge or exceeds pool limits.
	 */
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

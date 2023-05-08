import { AftermathApi } from "../../providers/aftermathApi";
import {
	CoinSymbol,
	CoinSymbolToCoinTypes,
	CoinType,
	UniqueId,
	Url,
} from "../../../types";
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { Helpers } from "../../utils";
import { Coin } from "../../../packages";

export class PythPricesApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants: {
		priceFeedsEndpoint: Url;
		priceFeedIds: Record<CoinSymbol, UniqueId>;
	} = {
		priceFeedsEndpoint: "https://xc-mainnet.pyth.network",
		priceFeedIds: {
			usdc: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
			sui: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc6574",
			usdt: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
			eth: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ac",
			btc: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b4",
			ftm: "0x5c6c0d2386e3352356c3ab84434fafb5ea067ac2678a38a338c4a69ddc4bdb0",
			avax: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
			celo: "0x7d669ddcdd23d9ef1fa9a9cc022ba055ec900e91c4cb960f3c20429d4447a411",
			sol: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56",
			matic: "0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52",
			bnb: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4",
			// glmr : ""
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	protected readonly connection: EvmPriceServiceConnection;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(
		private readonly Provider: AftermathApi,
		private readonly coinSymbolToCoinTypes: CoinSymbolToCoinTypes
	) {
		this.Provider = Provider;
		this.coinSymbolToCoinTypes = coinSymbolToCoinTypes;

		this.connection = new EvmPriceServiceConnection(
			PythPricesApiHelpers.constants.priceFeedsEndpoint
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	protected fetchPriceFeeds = async (coins: CoinType[]) => {
		const filteredPriceIds = coins.map((coin) => {
			const coinSymbol = Coin.coinSymbolForCoinType(
				coin,
				this.coinSymbolToCoinTypes
			);
			if (!coinSymbol) return "";

			const priceFeedIds = PythPricesApiHelpers.constants.priceFeedIds;
			if (!(coinSymbol in priceFeedIds)) return "";

			return priceFeedIds[coinSymbol];
		});

		const onlyPriceIds = filteredPriceIds.filter(
			(priceId) => priceId !== ""
		);
		const uniquePriceIds = onlyPriceIds.filter(
			(priceId, index) => onlyPriceIds.indexOf(priceId) === index
		);

		const uniquePriceFeeds = await this.connection.getLatestPriceFeeds(
			uniquePriceIds
		);
		if (!uniquePriceFeeds) throw Error("failed to get latest prices");

		const priceFeeds = filteredPriceIds.map((priceId) => {
			const foundIndex = uniquePriceIds.indexOf(priceId);
			if (foundIndex >= 0)
				return uniquePriceFeeds[foundIndex].getPriceNoOlderThan(60);

			return undefined;
		});

		return priceFeeds;
	};
}

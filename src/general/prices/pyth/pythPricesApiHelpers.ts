import { AptosPriceServiceConnection } from "@pythnetwork/pyth-aptos-js";
import { AftermathApi } from "../../providers/aftermathApi";
import { Coin } from "../../../packages/coin/coin";
import { CoinType } from "../../../types";

export class PythPricesApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		priceFeedsEndpoint: "https://xc-mainnet.pyth.network",
		priceFeedIds: {
			usdc: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
			whusdc: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
			lzusdc: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
			axlusdc:
				"0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
			afsui: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
			sui: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
			whusdt: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
			lzusdt: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
			axldai: "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd",
			usdt: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
			wheth: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
			lzeth: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
			whbtc: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
			btcb: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
			af: "0x88e2d5cbd2474766abffb2a67a58755a2cc19beb3b309e1ded1e357253aa3623",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	protected readonly connection: AptosPriceServiceConnection;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;

		this.connection = new AptosPriceServiceConnection(
			PythPricesApiHelpers.constants.priceFeedsEndpoint
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Protected Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	protected fetchPrices = async (coins: CoinType[]) => {
		const prices: Record<CoinType, number> = {
			usdc: 1,
			whusdc: 1,
			lzusdc: 1,
			axlusdc: 1,
			afsui: 3.12,
			sui: 3.02,
			whusdt: 1,
			lzusdt: 1,
			axldai: 1,
			usdt: 1,
			wheth: 1687.234,
			lzeth: 1687.234,
			whbtc: 24_681.2,
			btcb: 24_681.2,
			af: 5.19,
		};

		const coinPrices = coins.map((coin) =>
			new Coin(coin).coinTypeSymbol.toLowerCase() in prices
				? prices[new Coin(coin).coinTypeSymbol.toLowerCase()]
				: -1
		);

		return coinPrices;
	};

	protected fetchPriceFeeds = async (coins: CoinType[]) => {
		const filteredPriceIds = coins.map((coin) => {
			const key = new Coin(coin).coinTypeSymbol.toLowerCase();
			if (key in PythPricesApiHelpers.constants.priceFeedIds)
				return PythPricesApiHelpers.constants.priceFeedIds[
					key as keyof typeof PythPricesApiHelpers.constants.priceFeedIds
				];
			return "";
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

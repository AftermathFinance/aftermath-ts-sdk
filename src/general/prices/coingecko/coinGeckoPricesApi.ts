import { CoinType } from "../../../types";
import { Helpers } from "../../utils";
import { PricesApiInterface } from "../pricesApiInterface";
import { CoinGeckoApiHelpers } from "./coinGeckoApiHelpers";
import { CoinGeckoCoinApiId } from "./coinGeckoTypes";

export class CoinGeckoPricesApi
	extends CoinGeckoApiHelpers
	implements PricesApiInterface
{
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(coinGeckoApiKey: string) {
		super(coinGeckoApiKey);
	}

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Public
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Interface Methods
	/////////////////////////////////////////////////////////////////////

	public fetchPrice = async (coin: string): Promise<number> => {
		return Object.values(await this.fetchCoinsToPrice([coin]))[0];
	};

	public fetchCoinsToPrice = async (coins: CoinType[]) => {
		const allCoinsData = await this.fetchAllCoinData();
		const onlyInputCoinsData = Helpers.filterObject(allCoinsData, (coin) =>
			coins
				.map(Helpers.addLeadingZeroesToType)
				.includes(Helpers.addLeadingZeroesToType(coin))
		);
		const coinsToApiId = Object.entries(onlyInputCoinsData).reduce(
			(acc, [coinType, data]) => ({
				...acc,
				[coinType]: data.apiId,
			}),
			{}
		);
		return this.fetchCoinsToPriceGivenApiIds({ coinsToApiId });
	};

	/////////////////////////////////////////////////////////////////////
	//// Non-Interface Methods
	/////////////////////////////////////////////////////////////////////

	public fetchPriceGivenApiId = async (inputs: {
		coinType: CoinType;
		coinApiId: CoinGeckoCoinApiId;
	}): Promise<number> => {
		const priceInfo = await this.fetchCoinsToPriceInfo({
			coinsToApiId: { [inputs.coinType]: inputs.coinApiId },
		});
		return Object.values(priceInfo)[0].price;
	};

	public fetchCoinsToPriceGivenApiIds = async (inputs: {
		coinsToApiId: Record<CoinType, CoinGeckoCoinApiId>;
	}): Promise<Record<CoinType, number>> => {
		const coinsToPriceInfo = await this.fetchCoinsToPriceInfo(inputs);
		const coinsToPrice = Object.entries(coinsToPriceInfo).reduce(
			(acc, [coinType, info]) => ({
				...acc,
				[coinType]: info.price,
			}),
			{}
		);
		return coinsToPrice;
	};
}
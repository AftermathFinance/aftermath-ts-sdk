import { CoinMetadata } from "@mysten/sui.js";
import { Coin } from "../coin";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { CoinType } from "../../../types";
import { Helpers } from "../../../general/utils/helpers";
import { Pools } from "../../pools/pools";
import { CoinApiHelpers } from "./coinApiHelpers";

export class CoinApi {
	/////////////////////////////////////////////////////////////////////
	//// Class Members
	/////////////////////////////////////////////////////////////////////

	public readonly Helpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
		this.Helpers = new CoinApiHelpers(Provider);
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCoinMetadata = async (
		coin: CoinType
	): Promise<CoinMetadata> => {
		console.log("coin", coin);
		try {
			const coinMetadata = await this.Provider.provider.getCoinMetadata({
				coinType: Helpers.stripLeadingZeroesFromType(coin),
			});
			console.log("coinMetadata", coinMetadata);
			if (coinMetadata === null) throw new Error("coin metadata is null");

			return coinMetadata;
		} catch (error) {
			if (this.Provider.Pools().Helpers.isLpCoin(coin)) {
				const coinName = Pools.displayLpCoinType(coin);
				return {
					symbol: coinName.split(" ")[0].toUpperCase(),
					id: null,
					description: "Aftermath Finance LP",
					name: coinName,
					decimals: Pools.constants.decimals.lpCoinDecimals,
					iconUrl: null,
				};
			}

			const coinClass = new Coin(coin);
			const symbol = coinClass.coinTypeSymbol;
			const packageName = coinClass.coinTypePackageName;
			return {
				symbol: symbol.toUpperCase(),
				id: null,
				description: `${symbol} (${packageName})`,
				name: symbol,
				decimals: 9,
				iconUrl: null,
			};
		}
	};
}

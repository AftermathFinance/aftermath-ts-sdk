import { CoinMetadata } from "@mysten/sui.js";
import { Pools } from "../pools/pools";
import { Coin } from "./coin";

export class CoinApi {
	/////////////////////////////////////////////////////////////////////
	//// API
	/////////////////////////////////////////////////////////////////////

	public static fetchCoinMetadata: Promise<CoinMetadata> = async (
		coin: CoinType
	) => {
		try {
			const coinMetadata = await provider.getCoinMetadata(
				stripLeadingZeroesFromType(coin)
			);
			return coinMetadata;
		} catch (error) {
			if (Pools.isLpCoin(coin)) {
				const coinName = Pools.displayLpCoinType(coin);
				return {
					symbol: coinName.split(" ")[0].toUpperCase(),
					id: null,
					description: "Aftermath Finance LP",
					name: coinName,
					decimals: Pools.constants.lpCoinDecimals,
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

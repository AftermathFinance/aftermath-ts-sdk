import { CoinMetadata } from "@mysten/sui.js";
import { Pools } from "../pools/pools";
import { Coins } from "./coins";

export class CoinsApi {
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

			const symbol = Coins.coinTypeSymbol(coin);
			const packageName = Coins.coinTypePackageName(coin);
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

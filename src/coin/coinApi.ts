import { CoinMetadata, JsonRpcProvider } from "@mysten/sui.js";
import { Pools } from "../pools/pools";
import { Coin } from "./coin";
import { RpcProvider } from "../providers/rpcProvider";
import { CoinType } from "../types";
import { Helpers } from "../utils/helpers";

export class CoinApi {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly rpcProvider: RpcProvider) {
		this.rpcProvider = rpcProvider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Inspections
	/////////////////////////////////////////////////////////////////////

	public fetchCoinMetadata = async (
		coin: CoinType
	): Promise<CoinMetadata> => {
		try {
			const coinMetadata =
				await this.rpcProvider.provider.getCoinMetadata(
					Helpers.stripLeadingZeroesFromType(coin)
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

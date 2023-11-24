import { Caller } from "../../general/utils/caller";
import { SuiNetwork, Url } from "../../types";
import { OracleCoinSymbol } from "./oracleTypes";

export class Oracle extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork) {
		super(network, "oracle");
	}

	// =========================================================================
	//  Price Feeds
	// =========================================================================

	public async getPrice(inputs: {
		coinSymbol: OracleCoinSymbol;
	}): Promise<number> {
		return this.fetchApi(`price/${inputs.coinSymbol}`);
	}

	public async getPrices(inputs: {
		coinSymbols: OracleCoinSymbol[];
	}): Promise<number[]> {
		return Promise.all(
			inputs.coinSymbols.map((coinSymbol) =>
				this.getPrice({ coinSymbol })
			)
		);
	}
}

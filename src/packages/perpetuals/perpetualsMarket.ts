import { Caller } from "../../general/utils/caller";
import {
	MarketParams,
	MarketState,
	Orderbook,
	SuiNetwork,
	Url,
} from "../../types";

export class PerpetualsMarket extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public marketState: MarketState | undefined;
	public orderbook: Orderbook | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly marketId: bigint,
		public readonly marketParams: MarketParams,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, `perpetuals/markets/${marketId}`);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async refreshMarketState(): Promise<MarketState> {
		const marketState = await this.fetchApi<MarketState>(
			"market-state"
		);
		this.updateMarketState({ marketState });
		return marketState;
	}

	public updateMarketState(inputs: { marketState: MarketState }) {
		this.marketState = inputs.marketState;
	}

	public async refreshOrderbook(): Promise<Orderbook> {
		const orderbook = await this.fetchApi<Orderbook>(
			"orderbook"
		);
		this.updateOrderbook({ orderbook });
		return orderbook;
	}

	public updateOrderbook(inputs: { orderbook: Orderbook }) {
		this.orderbook = inputs.orderbook;
	}
}

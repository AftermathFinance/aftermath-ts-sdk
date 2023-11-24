import { Caller } from "../../general/utils/caller";
import {
	PerpetualsMarketParams,
	PerpetualsMarketState,
	PerpetualsOrderbookObject,
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

	public marketState: PerpetualsMarketState | undefined;
	public orderbook: PerpetualsOrderbookObject | undefined;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly marketId: bigint,
		public readonly marketParams: PerpetualsMarketParams,
		public readonly network?: SuiNetwork
	) {
		super(network, `perpetuals/markets/${marketId}`);
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async refreshMarketState(): Promise<PerpetualsMarketState> {
		const marketState = await this.fetchApi<PerpetualsMarketState>(
			"market-state"
		);
		this.updateMarketState({ marketState });
		return marketState;
	}

	public updateMarketState(inputs: { marketState: PerpetualsMarketState }) {
		this.marketState = inputs.marketState;
	}

	public async refreshOrderbook(): Promise<PerpetualsOrderbookObject> {
		const orderbook = await this.fetchApi<PerpetualsOrderbookObject>(
			"orderbook"
		);
		this.updateOrderbook({ orderbook });
		return orderbook;
	}

	public updateOrderbook(inputs: { orderbook: PerpetualsOrderbookObject }) {
		this.orderbook = inputs.orderbook;
	}
}

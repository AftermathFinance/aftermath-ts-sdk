import {
	ApiIndexerEventsBody,
	IndexerDataWithCursorQueryParams,
	IndexerEventsWithCursor,
	IndexerResponse,
	SuiNetwork,
	Url,
} from "../../types";
import { Helpers } from "./helpers";

export class IndexerCaller {
	private readonly indexerBaseUrl?: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork | Url,
		private readonly indexerUrlPrefix: Url = ""
	) {
		this.indexerBaseUrl =
			network === undefined
				? undefined
				: IndexerCaller.indexerBaseUrlForNetwork(network);
	}

	// =========================================================================
	//  Private Methods
	// =========================================================================

	private static async fetchResponseToType<OutputType>(
		response: Response
	): Promise<OutputType> {
		if (!response.ok) throw new Error(await response.text());

		const json = JSON.stringify(await response.json());
		const output = Helpers.parseJsonWithBigint(json);
		return output as OutputType;
	}

	private static addParamsToUrl<
		QueryParamsType extends Object = IndexerDataWithCursorQueryParams
	>(url: Url, queryParams: QueryParamsType | undefined): Url {
		if (!queryParams || Object.keys(queryParams).length <= 0) return url;

		const queryParamsUrl = new URLSearchParams(
			Object.entries(queryParams).reduce(
				(acc, [key, val]) => ({
					...acc,
					...(val === undefined ? {} : { [key]: val.toString() }),
				}),
				{} as Record<string, string>
			)
		);

		return `${url}${
			queryParamsUrl.toString() !== ""
				? "?" + queryParamsUrl.toString()
				: ""
		}`;
	}

	// 	if (!tx.blockData.sender)
	// 	throw new Error(
	// 		"unable to set dynamic gas budget with no sender set on tx"
	// 	);

	// const gasCoins =
	// 	await this.Provider.Coin().fetchCoinsUntilAmountReachedOrEnd({
	// 		walletAddress: tx.blockData.sender,
	// 		coinType: gasCoinType,
	// 		coinAmount: "TODO",
	// 	});
	// const gasCoinIds = gasCoins.map((coin) => coin.coinObjectId);

	// =========================================================================
	//  Indexer Calling
	// =========================================================================

	private static indexerBaseUrlForNetwork(network: SuiNetwork | Url): Url {
		if (network === "MAINNET") return "http://15.204.90.115:8083";
		if (network === "TESTNET") return "http://15.204.90.115:8083";
		if (network === "DEVNET") return "http://15.204.90.115:8083";
		if (network === "LOCAL") return "http://localhost:8080";

		const safeUrl =
			network.slice(-1) === "/" ? network.slice(0, -1) : network;
		return safeUrl;
	}

	private urlForIndexerCall = (url: string): Url => {
		if (this.indexerBaseUrl === undefined)
			throw new Error("no indexerBaseUrl: unable to fetch data");

		// TODO: handle url prefixing and api calls based on network differently
		return `${this.indexerBaseUrl}/af-fe/${
			this.indexerUrlPrefix === "" ? "" : this.indexerUrlPrefix + "/"
		}${url}`;
	};

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Indexer Calling
	// =========================================================================

	public async fetchIndexer<
		Output,
		BodyType = undefined,
		QueryParamsType extends Object = {}
	>(
		url: Url,
		body?: BodyType,
		queryParams?: QueryParamsType,
		signal?: AbortSignal
	): Promise<Output> {
		// TODO: handle bigint sending via indexer pattern ?

		// this allows BigInt to be JSON serialized (as string)
		// (BigInt.prototype as any).toJSON = function () {
		// 	return this.toString() + "n";
		// };

		const indexerCallUrl = IndexerCaller.addParamsToUrl(
			this.urlForIndexerCall(url),
			queryParams
		);

		const uncastResponse = await (body === undefined
			? fetch(indexerCallUrl, { signal })
			: fetch(indexerCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
					signal,
			  }));

		const response = await IndexerCaller.fetchResponseToType<
			IndexerResponse<Output>
		>(uncastResponse);
		return response.data;
	}

	public async fetchIndexerEvents<EventTypeOnChain, EventType>(
		url: Url,
		queryParams: ApiIndexerEventsBody,
		castingFunc: (eventOnChain: EventTypeOnChain) => EventType,
		signal?: AbortSignal
	): Promise<IndexerEventsWithCursor<EventType>> {
		const limit = queryParams.limit ?? 10;
		const eventsOnChain = await this.fetchIndexer<
			EventTypeOnChain[],
			undefined,
			IndexerDataWithCursorQueryParams
		>(
			url,
			undefined,
			{
				skip: queryParams.cursor ?? 0,
				limit,
			},
			signal
		);

		const events = eventsOnChain.map(castingFunc);
		return {
			events,
			nextCursor: events.length < limit ? undefined : limit,
		};
	}
}

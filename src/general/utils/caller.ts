import { TransactionBlock } from "@mysten/sui.js/transactions";
import {
	ApiEventsBody,
	ApiIndexerEventsBody,
	EventsWithCursor,
	IndexerEventsWithCursor,
	SerializedTransaction,
	SuiNetwork,
	Url,
} from "../../types";
import { Helpers } from "./helpers";

export class Caller {
	private readonly apiBaseUrl?: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly network?: SuiNetwork | Url,
		private readonly apiUrlPrefix: Url = ""
	) {
		this.apiBaseUrl =
			network === undefined
				? undefined
				: Caller.apiBaseUrlForNetwork(network);
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

	// =========================================================================
	//  Api Calling
	// =========================================================================

	private static apiBaseUrlForNetwork(network: SuiNetwork | Url): Url {
		if (network === "MAINNET") return "https://aftermath.finance";
		if (network === "TESTNET") return "https://testnet.aftermath.finance";
		if (network === "DEVNET") return "https://devnet.aftermath.finance";
		if (network === "LOCAL") return "http://localhost:3000";

		const safeUrl =
			network.slice(-1) === "/" ? network.slice(0, -1) : network;
		return safeUrl;
	}

	private urlForApiCall = (url: string): Url => {
		if (this.apiBaseUrl === undefined)
			throw new Error("no apiBaseUrl: unable to fetch data");

		// TODO: handle url prefixing and api calls based on network differently
		return `${this.apiBaseUrl}/api/${
			this.apiUrlPrefix === "" ? "" : this.apiUrlPrefix + "/"
		}${url}`;
	};

	// =========================================================================
	//  Protected Methods
	// =========================================================================

	// =========================================================================
	//  Api Calling
	// =========================================================================

	protected async fetchApi<Output, BodyType = undefined>(
		url: Url,
		body?: BodyType,
		signal?: AbortSignal
	): Promise<Output> {
		// this allows BigInt to be JSON serialized (as string)
		(BigInt.prototype as any).toJSON = function () {
			return this.toString() + "n";
		};

		const apiCallUrl = this.urlForApiCall(url);

		const uncastResponse = await (body === undefined
			? fetch(apiCallUrl, { signal })
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
					signal,
			  }));

		const response = await Caller.fetchResponseToType<Output>(
			uncastResponse
		);
		return response;
	}

	protected async fetchApiTransaction<BodyType = undefined>(
		url: Url,
		body?: BodyType,
		signal?: AbortSignal
	) {
		return TransactionBlock.from(
			await this.fetchApi<SerializedTransaction, BodyType>(
				url,
				body,
				signal
			)
		);
	}

	protected async fetchApiEvents<EventType, BodyType = ApiEventsBody>(
		url: Url,
		body: BodyType,
		signal?: AbortSignal
	) {
		return this.fetchApi<EventsWithCursor<EventType>, BodyType>(
			url,
			body,
			signal
		);
	}

	protected async fetchApiIndexerEvents<
		EventType,
		BodyType = ApiIndexerEventsBody
	>(url: Url, body: BodyType, signal?: AbortSignal) {
		return this.fetchApi<IndexerEventsWithCursor<EventType>, BodyType>(
			url,
			body,
			signal
		);
	}
}

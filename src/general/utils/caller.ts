import { Transaction } from "@mysten/sui/transactions";
import {
	ApiEventsBody,
	ApiIndexerEventsBody,
	CallerConfig,
	EventsWithCursor,
	IndexerEventsWithCursor,
	SerializedTransaction,
	SuiAddress,
	SuiNetwork,
	UniqueId,
	Url,
} from "../../types";
import { Helpers } from "./helpers";

export class Caller {
	protected readonly apiBaseUrl?: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly config: CallerConfig = {},
		private readonly apiUrlPrefix: Url = ""
	) {
		this.apiBaseUrl =
			this.config.network === undefined
				? undefined
				: Caller.apiBaseUrlForNetwork(this.config.network);
	}

	// =========================================================================
	//  Private Methods
	// =========================================================================

	private static async fetchResponseToType<OutputType>(
		response: Response,
		disableBigIntJsonParsing: boolean
	): Promise<OutputType> {
		if (!response.ok) throw new Error(await response.text());

		const json = JSON.stringify(await response.json());
		const output = disableBigIntJsonParsing
			? JSON.parse(json)
			: Helpers.parseJsonWithBigint(json);
		return output as OutputType;
	}

	// =========================================================================
	//  Api Calling
	// =========================================================================

	private static apiBaseUrlForNetwork(network: SuiNetwork): Url {
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
			this.apiUrlPrefix + (url === "" ? "" : "/")
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
		signal?: AbortSignal,
		options?: {
			disableBigIntJsonParsing?: boolean;
		}
	): Promise<Output> {
		if (!options?.disableBigIntJsonParsing) {
			(() => {
				// this allows BigInt to be JSON serialized (as string)
				(BigInt.prototype as any).toJSON = function () {
					return this.toString() + "n";
				};
			})();
		}
		const apiCallUrl = this.urlForApiCall(url);

		const headers = {
			// "Content-Type": "text/plain",
			"Content-Type": "application/json",
			...(this.config.accessToken
				? { Authorization: `Bearer ${this.config.accessToken}` }
				: {}),
		};
		const uncastResponse = await (body === undefined
			? fetch(apiCallUrl, {
					headers,
					signal,
			  })
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body),
					headers,
					signal,
			  }));

		const response = await Caller.fetchResponseToType<Output>(
			uncastResponse,
			!!options?.disableBigIntJsonParsing
		);
		return response;
	}

	protected async fetchApiTransaction<BodyType = undefined>(
		url: Url,
		body?: BodyType & { walletAddress?: SuiAddress },
		signal?: AbortSignal,
		options?: {
			disableBigIntJsonParsing?: boolean;
			txKind?: boolean;
		}
	) {
		const txKind = await this.fetchApi<SerializedTransaction, BodyType>(
			url,
			body,
			signal,
			options
		);
		const tx = options?.txKind
			? Transaction.fromKind(txKind)
			: Transaction.from(txKind);
		// NOTE: is this needed ?
		if (body?.walletAddress) {
			tx.setSender(body.walletAddress);
		}
		return tx;
	}

	protected async fetchApiEvents<EventType, BodyType = ApiEventsBody>(
		url: Url,
		body: BodyType,
		signal?: AbortSignal,
		options?: {
			disableBigIntJsonParsing?: boolean;
		}
	) {
		return this.fetchApi<EventsWithCursor<EventType>, BodyType>(
			url,
			body,
			signal,
			options
		);
	}

	protected async fetchApiIndexerEvents<
		EventType,
		BodyType extends ApiIndexerEventsBody
	>(
		url: Url,
		body: BodyType,
		signal?: AbortSignal,
		options?: {
			disableBigIntJsonParsing?: boolean;
		}
	): Promise<IndexerEventsWithCursor<EventType>> {
		const events = await this.fetchApi<EventType[], BodyType>(
			url,
			body,
			signal,
			options
		);
		// TODO: handle this logic on af-fe instead (to handle max limit case)
		return {
			events,
			nextCursor:
				events.length < (body.limit ?? 1)
					? undefined
					: events.length + (body.cursor ?? 0),
		};
	}

	protected setAccessToken = (accessToken: UniqueId) => {
		this.config.accessToken = accessToken;
	};
}

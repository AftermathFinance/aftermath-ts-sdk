import { Transaction } from "@mysten/sui/transactions";
import type {
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

/**
 * A JSON.stringify replacer that serializes BigInt values as strings
 * suffixed with "n" (e.g. `123n`), without mutating global prototypes.
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
	if (typeof value === "bigint") {
		return value.toString() + "n";
	}
	return value;
}

type ResponseWithTxKind = {
	txKind: SerializedTransaction;
	sponsorSignature?: string;
} & (Record<string, unknown> | {});

export class Caller {
	protected readonly apiBaseUrl?: Url;
	protected readonly apiEndpoint: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public config: CallerConfig = {},
		private readonly apiUrlPrefix: Url = ""
	) {
		this.apiBaseUrl =
			this.config.network === undefined
				? undefined
				: Caller.apiBaseUrlForNetwork(this.config.network);

		this.apiEndpoint = this.config.network === "INTERNAL" ? "af-fe" : "api";
	}

	// =========================================================================
	//  Private Methods
	// =========================================================================

	private static async fetchResponseToType<OutputType>(
		response: Response,
		disableBigIntJsonParsing: boolean
	): Promise<OutputType> {
		if (!response.ok) {
			const status = response.status;
			const body = await response.text();
			throw new Error(`HTTP ${status} ${response.statusText}: ${body}`);
		}

		const text = await response.text();

		const output = disableBigIntJsonParsing
			? JSON.parse(text, (_key, value) =>
					value === null ? undefined : value
			  )
			: Helpers.parseJsonWithBigint(text);

		return (output ?? undefined) as OutputType;
	}

	// =========================================================================
	//  Api Calling
	// =========================================================================

	private static apiBaseUrlForNetwork(network: SuiNetwork): Url {
		if (network === "MAINNET") {
			return "https://aftermath.finance";
		}
		if (network === "TESTNET") {
			return "https://testnet.aftermath.finance";
		}
		if (network === "DEVNET") {
			return "https://devnet.aftermath.finance";
		}
		if (network === "LOCAL") {
			return "http://localhost:3000";
		}
		if (network === "INTERNAL") {
			return "http://";
		}
		return network;
	}

	private urlForApiCall = (url: string): Url => {
		if (this.apiBaseUrl === undefined) {
			throw new Error("no apiBaseUrl: unable to fetch data");
		}

		// TODO: handle url prefixing and api calls based on network differently

		// Note: this slash removal is need to avoid double slashes in the url
		const safeUrl =
			this.apiBaseUrl.slice(-1) === "/"
				? this.apiBaseUrl.slice(0, -1)
				: this.apiBaseUrl;

		return `${safeUrl}/${this.apiEndpoint}/${
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
		const apiCallUrl = this.urlForApiCall(url);

		const headers = {
			"Content-Type": "application/json",
			...(this.config.accessToken
				? { Authorization: `Bearer ${this.config.accessToken}` }
				: {}),
		};

		const uncastResponse = await (body === undefined
			? fetch(apiCallUrl, { headers, signal })
			: fetch(apiCallUrl, {
					method: "POST",
					body: JSON.stringify(body, bigIntReplacer),
					headers,
					signal,
			  }));

		return Caller.fetchResponseToType<Output>(
			uncastResponse,
			!!options?.disableBigIntJsonParsing
		);
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

	protected async fetchApiTxObject<
		BodyType extends object,
		OutputType extends ResponseWithTxKind
	>(
		url: Url,
		body?: BodyType & { walletAddress?: SuiAddress },
		signal?: AbortSignal,
		options?: { disableBigIntJsonParsing?: boolean; txKind?: boolean }
	): Promise<
		Omit<Extract<OutputType, ResponseWithTxKind>, "txKind"> & {
			tx: Transaction;
		}
	> {
		const response = await this.fetchApi<OutputType, BodyType>(
			url,
			body,
			signal,
			options
		);

		const tx = response.sponsorSignature
			? Transaction.from(response.txKind)
			: Transaction.fromKind(response.txKind);

		const { txKind, ...rest } = response;
		type Rest = Omit<Extract<OutputType, ResponseWithTxKind>, "txKind">;
		return { ...(rest as Rest), tx };
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

	/**
	 * Open a generic websocket stream.
	 * - Automatically parses inbound JSON via `Helpers.parseJsonWithBigint`.
	 * - Automatically enables BigInt -> "123n" serialization (same one-liner as `fetchApi`).
	 */
	protected openWsStream<WsRequestMessage, WsResponseMessage>(args: {
		path: Url;
		onMessage: (message: WsResponseMessage) => void;
		onOpen?: (ev: Event) => void;
		onError?: (ev: Event) => void;
		onClose?: (ev: CloseEvent) => void;
	}) {
		const { path, onMessage, onOpen, onError, onClose } = args;

		/**
		 * Build a WS URL using the same base the HTTP calls use, plus this.apiEndpoint and apiUrlPrefix.
		 * Mirrors `urlForApiCall`, but swaps http(s) -> ws(s).
		 */
		const buildWsUrl = (path: string): Url => {
			if (this.apiBaseUrl === undefined) {
				throw new Error("no apiBaseUrl: unable to open websocket");
			}

			// Normalize base & path
			const baseHttp = this.apiBaseUrl.replace(/\/+$/, "");
			const baseWs = baseHttp.replace(/^http(s?):\/\//, "ws$1://");

			// Prefix with endpoint + service prefix (same pattern as fetch)
			const prefix = `${this.apiEndpoint}/${this.apiUrlPrefix}`;
			const normalizedPrefix = prefix.replace(/\/+$/, "");
			const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

			return `${baseWs}/${normalizedPrefix}${
				normalizedPath ? "/" + normalizedPath : ""
			}`;
		};

		const url = buildWsUrl(path);
		const ws = new WebSocket(url);

		ws.addEventListener("open", (ev) => onOpen?.(ev));
		ws.addEventListener("error", (ev) => onError?.(ev));
		ws.addEventListener("close", (ev) => onClose?.(ev));

		ws.addEventListener("message", (ev) => {
			try {
				const data = Helpers.parseJsonWithBigint(
					ev.data as string
				) as WsResponseMessage;
				onMessage?.(data);
			} catch (error) {
				args.onError?.(
					new ErrorEvent("message-parse-error", {
						error,
						message:
							error instanceof Error
								? error.message
								: "Failed to parse WebSocket message",
					})
				);
			}
		});

		const send = (value: WsRequestMessage) => {
			if (ws.readyState !== WebSocket.OPEN) {
				throw new Error("WebSocket is not open");
			}
			ws.send(JSON.stringify(value, bigIntReplacer));
		};

		const close = () => ws.close();

		return { ws, send, close };
	}
}

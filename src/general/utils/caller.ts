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
import {
	AftermathTransportError,
	normalizeAftermathTransportError,
	parseRetryAfter,
} from "./transportError";

/**
 * A JSON.stringify replacer that serializes BigInt values as strings
 * suffixed with "n" (e.g. `123n`), without mutating global prototypes.
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
	if (typeof value === "bigint") {
		return `${value.toString()}n`;
	}
	return value;
}

interface ResponseWithTxKind {
	txKind: SerializedTransaction;
	sponsorSignature?: string;
}

export class Caller {
	protected readonly apiBaseUrl?: Url;
	protected readonly apiEndpoint: Url;
	config: CallerConfig;
	private readonly apiUrlPrefix: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(config: CallerConfig = {}, apiUrlPrefix: Url = "") {
		this.config = config;
		this.apiUrlPrefix = apiUrlPrefix;
		this.apiBaseUrl =
			this.config.baseUrl ??
			(this.config.network === undefined
				? undefined
				: Caller.apiBaseUrlForNetwork(this.config.network));

		this.apiEndpoint = this.config.apiEndpoint ?? "api";
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
			const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
			await response.text();
			throw new AftermathTransportError("http", {
				retryAfterMs,
				status,
			});
		}

		const text = await response.text();

		let output: unknown;
		try {
			output = disableBigIntJsonParsing
				? JSON.parse(text, (_key, value) =>
						value === null ? undefined : value
					)
				: Helpers.parseJsonWithBigint(text);
		} catch (cause) {
			throw new AftermathTransportError("decode", { cause });
		}

		return (output ?? undefined) as OutputType;
	}

	// =========================================================================
	//  Api Calling
	// =========================================================================

	// Regex constants hoisted to avoid re-compilation per call.
	private static readonly TRAILING_SLASHES_REGEX = /\/+$/;
	private static readonly HTTP_PROTOCOL_REGEX = /^http(s?):\/\//;

	// Lookup tables for the SDK's well-known networks.
	private static readonly NETWORK_API_BASE_URLS: Record<SuiNetwork, Url> = {
		MAINNET: "https://aftermath.finance",
		TESTNET: "https://testnet.aftermath.finance",
		DEVNET: "https://devnet.aftermath.finance",
		LOCAL: "http://localhost:3000",
	};

	private static readonly NETWORK_FULLNODE_URLS: Record<SuiNetwork, Url> = {
		MAINNET: "https://fullnode.mainnet.sui.io:443",
		TESTNET: "https://fullnode.testnet.sui.io:443",
		DEVNET: "https://fullnode.devnet.sui.io:443",
		LOCAL: "http://127.0.0.1:9000",
	};

	/**
	 * Resolves the canonical Aftermath API base URL for a given network.
	 * To target a non-canonical host (custom deployment, local backend, etc.)
	 * pass `baseUrl` on `CallerConfig` instead.
	 */
	static apiBaseUrlForNetwork(network: SuiNetwork): Url {
		return Caller.NETWORK_API_BASE_URLS[network];
	}

	/**
	 * Resolves the canonical Sui fullnode URL for a given network. Falls back
	 * to the mainnet fullnode when `network` is undefined.
	 */
	static defaultFullnodeUrl(network: SuiNetwork | undefined): Url {
		return Caller.NETWORK_FULLNODE_URLS[network ?? "MAINNET"];
	}

	private readonly urlForApiCall = (url: string): Url => {
		if (this.apiBaseUrl === undefined) {
			throw new Error("no apiBaseUrl: unable to fetch data");
		}

		const safeUrl =
			this.apiBaseUrl.slice(-1) === "/"
				? this.apiBaseUrl.slice(0, -1)
				: this.apiBaseUrl;

		const endpointSegment = this.apiEndpoint ? `${this.apiEndpoint}/` : "";

		return `${safeUrl}/${endpointSegment}${
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
		try {
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

			return await Caller.fetchResponseToType<Output>(
				uncastResponse,
				!!options?.disableBigIntJsonParsing
			);
		} catch (error) {
			throw normalizeAftermathTransportError(error, signal);
		}
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
		OutputType extends ResponseWithTxKind,
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

	protected fetchApiEvents<EventType, BodyType = ApiEventsBody>(
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
		BodyType extends ApiIndexerEventsBody,
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
		 * Build a WS URL using the same base the HTTP calls use, plus
		 * `apiEndpoint` and `apiUrlPrefix`. Mirrors `urlForApiCall`, but
		 * swaps http(s) -> ws(s).
		 */
		const buildWsUrl = (path: string): Url => {
			if (this.apiBaseUrl === undefined) {
				throw new Error("no apiBaseUrl: unable to open websocket");
			}

			// Normalize base & path
			const baseHttp = this.apiBaseUrl.replace(
				Caller.TRAILING_SLASHES_REGEX,
				""
			);
			const baseWs = baseHttp.replace(Caller.HTTP_PROTOCOL_REGEX, "ws$1://");

			// Prefix with endpoint + service prefix (same pattern as fetch);
			// an empty `apiEndpoint` must not introduce a double slash.
			const endpointSegment = this.apiEndpoint ? `${this.apiEndpoint}/` : "";
			const prefix = `${endpointSegment}${this.apiUrlPrefix}`;
			const normalizedPrefix = prefix.replace(
				Caller.TRAILING_SLASHES_REGEX,
				""
			);
			const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

			return `${baseWs}/${normalizedPrefix}${
				normalizedPath ? `/${normalizedPath}` : ""
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

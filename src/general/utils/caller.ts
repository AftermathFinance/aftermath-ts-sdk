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
	/** The serialized transaction or transaction kind returned by the API. */
	txKind: SerializedTransaction;
	/** A sponsor signature. Its presence selects `Transaction.from`. */
	sponsorSignature?: string;
}

/**
 * Provides the shared HTTP, transaction, event, and WebSocket transport logic
 * used by the SDK's API clients.
 *
 * Subclasses supply endpoint-specific methods and use the protected request
 * helpers. Requests normalize HTTP, network, timeout, abort, and response
 * decoding failures to `AftermathTransportError`.
 */
export class Caller {
	protected readonly apiBaseUrl?: Url;
	protected readonly apiEndpoint: Url;
	/** The mutable configuration used for subsequent requests. */
	config: CallerConfig;
	private readonly apiUrlPrefix: Url;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a caller without making a network request.
	 *
	 * `config.baseUrl` takes precedence over `config.network`. If neither value
	 * supplies a host, a later request fails with a normalized `network` error.
	 * The caller stores the supplied configuration object, so later changes to
	 * mutable request fields such as `config.accessToken` affect subsequent
	 * requests. The derived host and endpoint are fixed at construction time.
	 *
	 * @param config - The network, API host, endpoint, and optional access token.
	 * @param apiUrlPrefix - The package or service path inserted after the API endpoint.
	 */
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
			const statusText = response.statusText;
			const body = await response.text();
			throw new AftermathTransportError("http", {
				message: `HTTP ${status} ${statusText}: ${body}`,
				name: "Error",
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
	 * Returns the canonical Aftermath API host for a Sui network.
	 *
	 * To target a custom or local host, pass `baseUrl` in `CallerConfig` to the
	 * constructor instead.
	 *
	 * @param network - The Sui network whose host to return.
	 * @returns The network's HTTPS or local HTTP API host.
	 */
	static apiBaseUrlForNetwork(network: SuiNetwork): Url {
		return Caller.NETWORK_API_BASE_URLS[network];
	}

	/**
	 * Returns the canonical Sui fullnode URL for a network.
	 *
	 * @param network - The network whose fullnode URL to return. `undefined`
	 * defaults to mainnet.
	 * @returns The network's fullnode URL.
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

	/**
	 * Sends an HTTP request and decodes its response.
	 *
	 * An undefined `body` uses `fetch`'s default GET behavior. A defined body
	 * uses POST and serializes every nested bigint as a decimal string with an
	 * `n` suffix, such as `123n` becoming `"123n"`. The default response parser
	 * converts those suffixed strings back to `bigint` and converts JSON `null`
	 * values to `undefined`. Set `disableBigIntJsonParsing` to keep suffixed
	 * strings as strings; JSON `null` values still become `undefined`.
	 *
	 * The method passes `signal` to `fetch` and does not serialize it into the
	 * request body. Non-2xx responses become `http` errors with their status,
	 * response body, and parsed `Retry-After` delay. Fetch failures become
	 * `network`, `timeout`, or `abort` errors. Invalid JSON or bigint parsing
	 * failures become `decode` errors.
	 *
	 * @param url - The path relative to the configured API host and prefixes.
	 * @param body - The optional JSON request body.
	 * @param signal - An optional caller-owned cancellation signal.
	 * @param options - Response decoding options.
	 * @returns The decoded response. A JSON `null` response is returned as `undefined`.
	 * @throws `AftermathTransportError` when the URL cannot be called or the
	 * response cannot be fetched, decoded, or accepted.
	 */
	protected async fetchApi<Output, BodyType = undefined>(
		url: Url,
		body?: BodyType,
		signal?: AbortSignal,
		options?: {
			/** Keep `123n` response values as strings instead of converting them. */
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

	/**
	 * Fetches a serialized transaction and parses it as a `Transaction`.
	 *
	 * `options.txKind` selects `Transaction.fromKind`; when it is false or
	 * omitted, the method selects `Transaction.from`. A truthy
	 * `body.walletAddress` is assigned to the returned transaction with
	 * `setSender`.
	 *
	 * @param url - The path relative to the configured API host and prefixes.
	 * @param body - The optional request body, including an optional wallet address.
	 * @param signal - An optional caller-owned cancellation signal.
	 * @param options - Response decoding and transaction parsing options.
	 * @returns The parsed transaction.
	 * @throws `AftermathTransportError` when the request or response fails. Errors
	 * from `Transaction.from` or `Transaction.fromKind` are propagated unchanged.
	 */
	protected async fetchApiTransaction<BodyType = undefined>(
		url: Url,
		body?: BodyType & { walletAddress?: SuiAddress },
		signal?: AbortSignal,
		options?: {
			/** Keep `123n` response values as strings instead of converting them. */
			disableBigIntJsonParsing?: boolean;
			/** Parse the response as transaction kind bytes instead of full bytes. */
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

	/**
	 * Fetches an API response that contains `txKind` and returns the transaction
	 * separately from the remaining response fields.
	 *
	 * A truthy `sponsorSignature` selects `Transaction.from`; otherwise the
	 * method selects `Transaction.fromKind`. The returned object omits `txKind`
	 * and adds `tx`. Transport and decoding failures are normalized by
	 * `fetchApi`.
	 *
	 * @param url - The path relative to the configured API host and prefixes.
	 * @param body - The optional JSON request body.
	 * @param signal - An optional caller-owned cancellation signal.
	 * @param options - Response decoding options passed to `fetchApi`.
	 * @returns The response fields other than `txKind`, plus the parsed transaction.
	 * @throws Errors from transaction parsing are propagated unchanged after
	 * `fetchApi` has normalized transport and response-decoding failures.
	 */
	protected async fetchApiTxObject<
		BodyType extends object,
		OutputType extends ResponseWithTxKind,
	>(
		url: Url,
		body?: BodyType & { walletAddress?: SuiAddress },
		signal?: AbortSignal,
		options?: {
			/** Keep `123n` response values as strings instead of converting them. */
			disableBigIntJsonParsing?: boolean;
			/** Accepted for parity with `fetchApiTransaction`; selection here uses `sponsorSignature`. */
			txKind?: boolean;
		}
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

	/**
	 * Fetches a paginated event response through `fetchApi`.
	 *
	 * The response parser applies the same bigint and `null` conversion rules as
	 * `fetchApi`.
	 *
	 * @param url - The event endpoint path.
	 * @param body - The event query body.
	 * @param signal - An optional caller-owned cancellation signal.
	 * @param options - Response decoding options.
	 * @returns The decoded events and the endpoint's cursor value.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	protected fetchApiEvents<EventType, BodyType = ApiEventsBody>(
		url: Url,
		body: BodyType,
		signal?: AbortSignal,
		options?: {
			/** Keep `123n` response values as strings instead of converting them. */
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

	/**
	 * Fetches indexer events and derives the next numeric cursor locally.
	 *
	 * If the response length is less than `body.limit` (or less than `1` when
	 * `limit` is omitted), `nextCursor` is `undefined`. Otherwise it is the
	 * response length plus `body.cursor`, treating an omitted cursor as `0`.
	 *
	 * @param url - The indexer event endpoint path.
	 * @param body - The indexer query body.
	 * @param signal - An optional caller-owned cancellation signal.
	 * @param options - Response decoding options.
	 * @returns The events and the derived numeric cursor.
	 * @throws `AftermathTransportError` when the request or response fails.
	 */
	protected async fetchApiIndexerEvents<
		EventType,
		BodyType extends ApiIndexerEventsBody,
	>(
		url: Url,
		body: BodyType,
		signal?: AbortSignal,
		options?: {
			/** Keep `123n` response values as strings instead of converting them. */
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

	/**
	 * Stores an access token on this caller for later requests.
	 *
	 * The operation mutates `config.accessToken`; it does not change any request
	 * that has already been sent.
	 *
	 * @param accessToken - The token sent as a Bearer authorization header.
	 */
	protected setAccessToken = (accessToken: UniqueId) => {
		this.config.accessToken = accessToken;
	};

	/**
	 * Opens a WebSocket stream at the configured host and path.
	 *
	 * The method constructs the URL from the API host, endpoint, prefix, and
	 * `path`, then opens the socket immediately. Incoming messages are parsed
	 * with `Helpers.parseJsonWithBigint`, so suffixed bigint strings become
	 * `bigint` values and JSON `null` values become `undefined`. A parse failure
	 * calls `onError` with an `ErrorEvent` whose type is
	 * `message-parse-error`. `send` serializes nested bigints with the same
	 * `"123n"` representation used by HTTP requests. `send` throws if the socket
	 * is not open or if JSON serialization fails, and `close` closes the socket.
	 *
	 * @param args - The path and WebSocket event callbacks.
	 * @returns The native WebSocket and the `send` and `close` operations.
	 * @throws `Error` when no API host is configured or `send` runs before the
	 * socket reaches the `OPEN` state.
	 */
	protected openWsStream<WsRequestMessage, WsResponseMessage>(args: {
		/** The stream path, with or without a leading slash. */
		path: Url;
		/** Receives each successfully decoded response message. */
		onMessage: (message: WsResponseMessage) => void;
		/** Receives the native WebSocket open event. */
		onOpen?: (ev: Event) => void;
		/** Receives native socket errors and message parse errors. */
		onError?: (ev: Event) => void;
		/** Receives the native WebSocket close event. */
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

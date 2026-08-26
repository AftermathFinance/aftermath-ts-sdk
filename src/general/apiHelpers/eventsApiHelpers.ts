import type {
	EventId,
	SuiEvent,
	SuiEventFilter,
	SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc";
import type {
	AnyObjectType,
	Event,
	EventsInputs,
	EventsWithCursor,
	SuiAddress,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";

/**
 * Queries, paginates, and locally casts Sui events.
 *
 * Most methods coordinate a caller-provided page fetcher and do not choose a
 * transport. `fetchCastEventsWithCursor` is the exception: it performs network
 * I/O through the optional JSON-RPC client because the gRPC client has no
 * equivalent for `suix_queryEvents`.
 */
export class EventsApiHelpers {
	// =========================================================================
	//  Private Static Constants
	// =========================================================================

	private static readonly constants = {
		defaultLimitStepSize: 256,
		maxLoops: 20,
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an event helper for a configured `AftermathApi`.
	 *
	 * @param api - The API instance used by the JSON-RPC event query method.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// TODO: make this filter by looking ONLY at all relevant AF packages
	// TODO: move to wallet package ?
	/**
	 * Always throws because event subscriptions are not implemented by this
	 * helper.
	 *
	 * @deprecated Not implemented. gRPC's
	 * `SubscriptionService.SubscribeEvents` is the replacement — reach it via
	 * `AftermathApi["client"].subscriptionService` — or poll
	 * {@link EventsApiHelpers.fetchCastEventsWithCursor}.
	 *
	 * @param _inputs - The wallet address and event callback that the removed
	 * subscription API would have used. Neither value is read.
	 * @throws `Error` on every call because this method is not implemented.
	 */
	public fetchSubscribeToUserEvents = async (_inputs: {
		address: SuiAddress;
		onEvent: (event: SuiEvent) => void;
	}): Promise<never> => {
		throw new Error(
			"fetchSubscribeToUserEvents is not implemented. Use gRPC's " +
				"SubscriptionService.SubscribeEvents (available on " +
				"`AftermathApi.client.subscriptionService`), or poll " +
				"fetchCastEventsWithCursor."
		);
	};

	/**
	 * Fetches and casts one page of events with the legacy JSON-RPC client.
	 *
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. `suix_queryEvents` has no
	 * `SuiGrpcClient` equivalent: the only gRPC path is the raw
	 * `ledgerService.ListEvents`, whose filter model and cursor differ from
	 * `SuiEventFilter` / `EventId`, and whose events carry BCS bytes instead of
	 * the `parsedJson` that every `eventFromEventOnChain` caster reads. Porting
	 * it would change this helper's semantics, so it still goes through
	 * JSON-RPC and will stop working when that is removed from fullnodes
	 * (scheduled for mid-October 2026).
	 *
	 * @throws If no `jsonRpcClient` was passed to {@link AftermathApi}, since it
	 * is optional there.
	 * @param inputs - A JSON-RPC event filter, an optional `EventId` cursor and
	 * page limit, and a caster for the raw event shape. The cursor's `eventSeq`
	 * value is sent as a string, as required by JSON-RPC.
	 * @returns The cast events from this page and `nextCursor`. The cursor is
	 * `null` when JSON-RPC reports no later page.
	 * @throws If the optional JSON-RPC client is absent, the request fails, or
	 * the caster throws.
	 */
	public fetchCastEventsWithCursor = async <EventOnChainType, EventType>(
		inputs: {
			query: SuiEventFilter;
			eventFromEventOnChain: (eventOnChain: EventOnChainType) => EventType;
		} & EventsInputs
	): Promise<EventsWithCursor<EventType>> => {
		const { query, eventFromEventOnChain, cursor, limit } = inputs;

		const jsonRpcClient = this.api.requireJsonRpcClient(
			"Events().fetchCastEventsWithCursor"
		);

		const fetchedEvents = await jsonRpcClient.queryEvents({
			query,
			cursor: cursor
				? { ...cursor, eventSeq: cursor.eventSeq.toString() }
				: undefined,
			limit,
		});
		const events = (fetchedEvents.data as unknown as EventOnChainType[]).map(
			eventFromEventOnChain
		);

		return { events, nextCursor: fetchedEvents.nextCursor ?? null };
	};

	// TODO: make this function use timestamp passing as one of event filter args
	/**
	 * Fetches pages until events fall outside a millisecond time window.
	 *
	 * This method does not perform I/O itself. It calls `fetchEventsFunc` with an
	 * `EventId` cursor and a page limit, so the callback determines the transport
	 * and query. It keeps events in page order, stops before the first event whose
	 * timestamp is more than `timeMs` milliseconds older than `Date.now()`, and
	 * stops after 20 pages even when the callback keeps returning a cursor.
	 * Events without a timestamp are not treated as stale.
	 *
	 * @param inputs - The page fetcher, time window in milliseconds, and optional
	 * per-page limit. The limit defaults to 256 events.
	 * @returns Events collected within the time window.
	 * @throws Errors from `fetchEventsFunc` or its event caster.
	 */
	public fetchEventsWithinTime = async <T extends Event>(inputs: {
		fetchEventsFunc: (
			eventsInputs: EventsInputs
		) => Promise<EventsWithCursor<T>>;
		timeMs: number;
		limitStepSize?: number;
	}) => {
		const { fetchEventsFunc, timeMs, limitStepSize } = inputs;
		const limit =
			limitStepSize ?? EventsApiHelpers.constants.defaultLimitStepSize;

		const eventsWithinTime: T[] = [];
		let cursor: EventId | undefined;

		for (
			let loopCount = 0;
			loopCount < EventsApiHelpers.constants.maxLoops;
			loopCount++
		) {
			const { events, nextCursor } = await fetchEventsFunc({
				cursor,
				limit,
			});

			const now = Date.now();
			const endIndex = events.findIndex(
				(event) =>
					event.timestamp !== undefined && now - event.timestamp > timeMs
			);
			eventsWithinTime.push(
				...(endIndex < 0 ? events : events.slice(0, endIndex))
			);

			if (events.length === 0 || nextCursor === null || endIndex >= 0) {
				return eventsWithinTime;
			}
			cursor = nextCursor;
		}
		return eventsWithinTime;
	};

	/**
	 * Fetches every event page until the callback returns an empty page or a
	 * `null` cursor.
	 *
	 * This method does not perform I/O itself. `fetchEventsFunc` receives the
	 * current `EventId` cursor and a page limit and may use any supported source.
	 * The default limit is 256 events per call. The method preserves page order
	 * and does not deduplicate events.
	 *
	 * @param inputs - The page fetcher and optional per-page limit.
	 * @returns All events returned by the callback.
	 * @throws Errors from `fetchEventsFunc` or its event caster.
	 */
	public fetchAllEvents = async <T /* extends Event */>(inputs: {
		fetchEventsFunc: (
			eventsInputs: EventsInputs
		) => Promise<EventsWithCursor<T>>;
		limitStepSize?: number;
	}) => {
		const { fetchEventsFunc, limitStepSize } = inputs;
		const limit =
			limitStepSize ?? EventsApiHelpers.constants.defaultLimitStepSize;

		const allEvents: T[] = [];
		let cursor: EventId | undefined;
		let done = false;

		while (!done) {
			const { events, nextCursor } = await fetchEventsFunc({
				cursor,
				limit,
			});
			allEvents.push(...events);

			if (events.length === 0 || nextCursor === null) {
				done = true;
			} else {
				cursor = nextCursor;
			}
		}
		return allEvents;
	};

	// =========================================================================
	//  Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private static resolveEventType = (
		eventType: AnyObjectType | (() => AnyObjectType)
	): AnyObjectType => (typeof eventType === "string" ? eventType : eventType());

	/**
	 * Returns an event when its type contains the requested Move type.
	 *
	 * This is a local check and performs no network I/O. A callback event type is
	 * resolved when the method runs. Matching is substring-based, so a wrapped
	 * event type also matches its inner type.
	 *
	 * @param event - The event to inspect.
	 * @param eventType - A Move type string or a callback that returns one.
	 * @returns The original event when it matches, otherwise `undefined`.
	 */
	public static suiEventOfTypeOrUndefined = (
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType)
	): SuiEvent | undefined =>
		event.type.includes(EventsApiHelpers.resolveEventType(eventType))
			? event
			: undefined;

	/**
	 * Casts one event when its type matches the requested Move type.
	 *
	 * This is a local operation. By default it uses substring matching; set
	 * `exactMatch` to `true` to require the event type to equal the resolved type.
	 * The caster runs only for a matching event.
	 *
	 * @param event - The raw Sui event to inspect.
	 * @param eventType - A Move type string or a callback that returns one.
	 * @param castFunction - Converts the raw event into the caller's event type.
	 * @param exactMatch - Whether to require exact type equality. Defaults to
	 * `false`.
	 * @returns The cast event for a match, otherwise `undefined`.
	 * @throws Errors from `castFunction`.
	 */
	public static castEventOfTypeOrUndefined = <EventTypeOnChain, EventType>(
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType,
		exactMatch?: boolean
	): EventType | undefined => {
		const resolved = EventsApiHelpers.resolveEventType(eventType);
		const matches = exactMatch
			? event.type === resolved
			: event.type.includes(resolved);
		if (!matches) {
			return undefined;
		}

		return castFunction(event as EventTypeOnChain);
	};

	/**
	 * Finds and casts every event whose type contains the requested Move type.
	 *
	 * This is a local operation with no network I/O. The result is an array in
	 * the same order as `events`; no match produces an empty array.
	 *
	 * @param inputs - The event array, Move type string or resolver, and caster.
	 * @returns All cast matches, or an empty array when no event matches.
	 * @throws Errors from `castFunction`.
	 */
	public static findCastEventsOrUndefined = <
		EventTypeOnChain,
		EventType,
	>(inputs: {
		events: SuiEvent[];
		eventType: AnyObjectType | (() => AnyObjectType);
		castFunction: (eventOnChain: EventTypeOnChain) => EventType;
	}) => {
		const { events, eventType, castFunction } = inputs;
		const resolved = EventsApiHelpers.resolveEventType(eventType);

		return events
			.filter((event) => event.type.includes(resolved))
			.map((event) => castFunction(event as EventTypeOnChain));
	};

	/**
	 * Finds and casts the first event whose type contains the requested Move type.
	 *
	 * This is a local operation with no network I/O. The event array remains in
	 * caller order, and the caster runs only for the first matching event.
	 *
	 * @param inputs - The event array, Move type string or resolver, and caster.
	 * @returns The first cast match, or `undefined` when no event matches.
	 * @throws Errors from `castFunction`.
	 */
	public static findCastEventOrUndefined = <
		EventTypeOnChain,
		EventType,
	>(inputs: {
		events: SuiEvent[];
		eventType: AnyObjectType | (() => AnyObjectType);
		castFunction: (eventOnChain: EventTypeOnChain) => EventType;
	}): EventType | undefined => {
		return EventsApiHelpers.findCastEventsOrUndefined(inputs)[0];
	};

	/**
	 * Finds and casts the first matching event in one transaction response.
	 *
	 * This is a local operation with no network I/O. A transaction without an
	 * `events` array is treated as having no matching events.
	 *
	 * @param transaction - The transaction response to inspect.
	 * @param eventType - A Move type string or a callback that returns one.
	 * @param castFunction - Converts the raw matching event.
	 * @returns The first cast match, or `undefined` when the transaction has no
	 * matching event.
	 * @throws Errors from `castFunction`.
	 */
	public static findCastEventInTransactionOrUndefined = <
		EventTypeOnChain,
		EventType,
	>(
		transaction: SuiTransactionBlockResponse,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	): EventType | undefined => {
		return EventsApiHelpers.findCastEventOrUndefined({
			events: transaction.events ?? [],
			eventType,
			castFunction,
		});
	};

	/**
	 * Finds and casts the first matching event across transaction responses.
	 *
	 * This is a local operation with no network I/O. Transactions and their
	 * events are searched in array order, and the method stops after the first
	 * match.
	 *
	 * @param transactions - The transaction responses to inspect.
	 * @param eventType - A Move type string or a callback that returns one.
	 * @param castFunction - Converts the raw matching event.
	 * @returns The first cast match, or `undefined` when no transaction matches.
	 * @throws Errors from `castFunction`.
	 */
	public static findCastEventInTransactionsOrUndefined = <
		EventTypeOnChain,
		EventType,
	>(
		transactions: SuiTransactionBlockResponse[],
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	): EventType | undefined => {
		for (const transaction of transactions) {
			const event = EventsApiHelpers.findCastEventInTransactionOrUndefined(
				transaction,
				eventType,
				castFunction
			);
			if (event !== undefined) {
				return event;
			}
		}
		return undefined;
	};

	/**
	 * Builds a fully qualified Move event type string.
	 *
	 * This is a local string operation and performs no network I/O. When
	 * `wrapperType` is provided, the result is `wrapperType<package::module::event>`.
	 * The method does not validate the individual type segments.
	 *
	 * @param packageAddress - The published package address, such as `0x2`.
	 * @param packageName - The Move module name.
	 * @param eventType - The event struct name or inner type expression.
	 * @param wrapperType - Optional outer Move type, such as `SomeWrapper`.
	 * @returns The assembled Move type string.
	 */
	public static createEventType = (
		packageAddress: string,
		packageName: string,
		eventType: string,
		wrapperType?: string
	) => {
		const innerType = `${packageAddress}::${packageName}::${eventType}`;
		return wrapperType ? `${wrapperType}<${innerType}>` : innerType;
	};
}

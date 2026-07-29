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
	 * @deprecated Not implemented. gRPC's
	 * `SubscriptionService.SubscribeEvents` is the replacement — reach it via
	 * `AftermathApi["client"].subscriptionService` — or poll
	 * {@link EventsApiHelpers.fetchCastEventsWithCursor}.
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
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. `suix_queryEvents` has no
	 * `SuiGrpcClient` equivalent: the only gRPC path is the raw
	 * `ledgerService.ListEvents`, whose filter model and cursor differ from
	 * `SuiEventFilter` / `EventId`, and whose events carry BCS bytes instead of
	 * the `parsedJson` that every `eventFromEventOnChain` caster reads. Porting
	 * it would change this helper's semantics, so it still goes through
	 * JSON-RPC and will stop working when that is removed from fullnodes
	 * (scheduled for mid-October 2026).
	 */
	public fetchCastEventsWithCursor = async <EventOnChainType, EventType>(
		inputs: {
			query: SuiEventFilter;
			eventFromEventOnChain: (eventOnChain: EventOnChainType) => EventType;
		} & EventsInputs
	): Promise<EventsWithCursor<EventType>> => {
		const { query, eventFromEventOnChain, cursor, limit } = inputs;

		const fetchedEvents = await this.api.jsonRpcClient.queryEvents({
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

	public static suiEventOfTypeOrUndefined = (
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType)
	): SuiEvent | undefined =>
		event.type.includes(EventsApiHelpers.resolveEventType(eventType))
			? event
			: undefined;

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

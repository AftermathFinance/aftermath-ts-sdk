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

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// TODO: make this filter by looking ONLY at all relevant AF packages
	// TODO: move to wallet package ?
	/**
	 * @deprecated `subscribeEvent` was removed from `SuiJsonRpcClient` in
	 * `@mysten/sui` v2. Poll `queryEvents` instead or use a WebSocket transport.
	 */
	public fetchSubscribeToUserEvents = async (_inputs: {
		address: SuiAddress;
		onEvent: (event: SuiEvent) => void;
	}): Promise<never> => {
		throw new Error(
			"fetchSubscribeToUserEvents is not supported in @mysten/sui v2. " +
				"subscribeEvent was removed from SuiJsonRpcClient. " +
				"Poll queryEvents instead or use a WebSocket transport."
		);
	};

	public fetchCastEventsWithCursor = async <EventOnChainType, EventType>(
		inputs: {
			query: SuiEventFilter;
			eventFromEventOnChain: (
				eventOnChain: EventOnChainType
			) => EventType;
		} & EventsInputs
	): Promise<EventsWithCursor<EventType>> => {
		const { query, eventFromEventOnChain, cursor, limit } = inputs;

		const fetchedEvents = await this.Provider.provider.queryEvents({
			query,
			cursor: cursor
				? { ...cursor, eventSeq: cursor.eventSeq.toString() }
				: undefined,
			limit,
		});
		const events = (
			fetchedEvents.data as unknown as EventOnChainType[]
		).map(eventFromEventOnChain);

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
					event.timestamp !== undefined &&
					now - event.timestamp > timeMs
			);
			eventsWithinTime.push(
				...(endIndex < 0 ? events : events.slice(0, endIndex))
			);

			if (
				events.length === 0 ||
				nextCursor === null ||
				endIndex >= 0
			) {
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
	): AnyObjectType =>
		typeof eventType === "string" ? eventType : eventType();

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
		if (!matches) return undefined;

		return castFunction(event as EventTypeOnChain);
	};

	public static findCastEventsOrUndefined = <
		EventTypeOnChain,
		EventType
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
		EventType
	>(inputs: {
		events: SuiEvent[];
		eventType: AnyObjectType | (() => AnyObjectType);
		castFunction: (eventOnChain: EventTypeOnChain) => EventType;
	}): EventType | undefined => {
		return EventsApiHelpers.findCastEventsOrUndefined(inputs)[0];
	};

	public static findCastEventInTransactionOrUndefined = <
		EventTypeOnChain,
		EventType
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
		EventType
	>(
		transactions: SuiTransactionBlockResponse[],
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	): EventType | undefined => {
		for (const transaction of transactions) {
			const event =
				EventsApiHelpers.findCastEventInTransactionOrUndefined(
					transaction,
					eventType,
					castFunction
				);
			if (event !== undefined) return event;
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

import {
	Event,
	EventsWithCursor,
	AnyObjectType,
	EventsInputs,
	SuiAddress,
} from "../../types";
import dayjs, { QUnitType, OpUnitType } from "dayjs";
import { AftermathApi } from "../providers/aftermathApi";
import {
	EventId,
	SuiEvent,
	SuiEventFilter,
	SuiTransactionBlockResponse,
	Unsubscribe,
} from "@mysten/sui/client";

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
	public fetchSubscribeToUserEvents = async (inputs: {
		address: SuiAddress;
		onEvent: (event: SuiEvent) => void;
	}): Promise<Unsubscribe> => {
		const { address, onEvent } = inputs;

		const unsubscribe = await this.Provider.provider.subscribeEvent({
			filter: {
				Sender: address,
			},
			onMessage: onEvent,
		});
		return unsubscribe;
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
				? {
						...cursor,
						eventSeq: cursor?.eventSeq.toString(),
				  }
				: undefined,
			limit, // defaultlimit ?
		});
		const eventsOnChain =
			fetchedEvents.data as unknown as EventOnChainType[];
		const events = eventsOnChain.map((event) =>
			eventFromEventOnChain(event)
		);
		const nextCursor = fetchedEvents.nextCursor ?? null;

		return { events, nextCursor };
	};

	// TODO: make this function use timestamp passing as one of event filter args
	public fetchEventsWithinTime = async <T extends Event>(inputs: {
		fetchEventsFunc: (
			eventsInputs: EventsInputs
		) => Promise<EventsWithCursor<T>>;
		timeUnit: QUnitType | OpUnitType;
		time: number;
		limitStepSize?: number;
	}) => {
		const { fetchEventsFunc, timeUnit, time, limitStepSize } = inputs;

		let loopCount = 0;
		let eventsWithinTime: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				{
					cursor,
					limit:
						limitStepSize ??
						EventsApiHelpers.constants.defaultLimitStepSize,
				}
			);
			const events = eventsWithCursor.events;

			const now = Date.now();
			const endIndex = events.findIndex((event) => {
				if (event.timestamp === undefined) return false;

				const eventDate = dayjs.unix(event.timestamp / 1000);
				return dayjs(now).diff(eventDate, timeUnit, true) > time;
			});
			eventsWithinTime = [
				...eventsWithinTime,
				...(endIndex < 0 ? events : events.slice(0, endIndex)),
			];

			if (
				events.length === 0 ||
				// events.length < limitStepSize ||
				eventsWithCursor.nextCursor === null ||
				endIndex >= 0
			)
				return eventsWithinTime;

			cursor = eventsWithCursor.nextCursor;

			loopCount += 1;
			if (loopCount >= EventsApiHelpers.constants.maxLoops) {
				return eventsWithinTime;
			}
		} while (true);
	};

	public fetchAllEvents = async <T /* extends Event */>(inputs: {
		fetchEventsFunc: (
			eventsInputs: EventsInputs
		) => Promise<EventsWithCursor<T>>;
		limitStepSize?: number;
	}) => {
		const { fetchEventsFunc, limitStepSize } = inputs;

		let allEvents: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				{
					cursor,
					limit:
						limitStepSize ??
						EventsApiHelpers.constants.defaultLimitStepSize,
				}
			);
			const events = eventsWithCursor.events;
			allEvents = [...allEvents, ...events];

			if (events.length === 0 || eventsWithCursor.nextCursor === null)
				return allEvents;
			cursor = eventsWithCursor.nextCursor;
		} while (true);
	};

	// =========================================================================
	//  Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static suiEventOfTypeOrUndefined = (
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType)
	): SuiEvent | undefined =>
		// event.type === (typeof eventType === "string" ? eventType : eventType())
		event.type.includes(
			typeof eventType === "string" ? eventType : eventType()
		)
			? event
			: undefined;

	public static castEventOfTypeOrUndefined = <EventTypeOnChain, EventType>(
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType,
		exactMatch?: boolean
	): EventType | undefined => {
		if (
			exactMatch
				? event.type !==
				  (typeof eventType === "string" ? eventType : eventType())
				: !event.type.includes(
						typeof eventType === "string" ? eventType : eventType()
				  )
		)
			return;

		const castedEvent = castFunction(event as EventTypeOnChain);
		return castedEvent;
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

		const foundEvents = events.filter(
			(event) =>
				EventsApiHelpers.suiEventOfTypeOrUndefined(event, eventType) !==
				undefined
		);
		const castedEvents = foundEvents.map((event) =>
			castFunction(event as EventTypeOnChain)
		);
		return castedEvents;
	};

	public static findCastEventOrUndefined = <
		EventTypeOnChain,
		EventType
	>(inputs: {
		events: SuiEvent[];
		eventType: AnyObjectType | (() => AnyObjectType);
		castFunction: (eventOnChain: EventTypeOnChain) => EventType;
	}) => {
		const events = this.findCastEventsOrUndefined(inputs);
		if (events.length <= 0) return;
		return events[0];
	};

	public static findCastEventInTransactionOrUndefined = <
		EventTypeOnChain,
		EventType
	>(
		transaction: SuiTransactionBlockResponse,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	) => {
		return this.findCastEventOrUndefined({
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
	) => {
		if (transactions.length === 0) return;

		const foundEvent = transactions
			.map((transaction) =>
				EventsApiHelpers.findCastEventInTransactionOrUndefined(
					transaction,
					eventType,
					castFunction
				)
			)
			.find((event) => event !== undefined);

		return foundEvent;
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

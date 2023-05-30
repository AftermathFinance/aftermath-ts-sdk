import { Event, EventsWithCursor, AnyObjectType } from "../../types";
import {
	EventId,
	SuiAddress,
	SuiEvent,
	SuiEventFilter,
	SuiTransactionBlockResponse,
} from "@mysten/sui.js";
import dayjs, { QUnitType, OpUnitType } from "dayjs";
import { AftermathApi } from "../providers/aftermathApi";
import { EventOnChain } from "../types/castingTypes";

export class EventsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Private Static Constants
	/////////////////////////////////////////////////////////////////////

	private static readonly constants = {
		defaultLimitStepSize: 256,
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	// TODO: make this filter by looking ONLY at all relevant AF packages
	public fetchSubscribeToUserEvents = async (
		address: SuiAddress,
		onEvent: (event: SuiEvent) => void
	): Promise<number> => {
		const userEventSubscriptionId =
			await this.Provider.provider.subscribeEvent({
				filter: {
					Sender: address,
				},
				onMessage: onEvent,
			});
		return userEventSubscriptionId;
	};

	public fetchUnsubscribeFromEvents = async (
		subscriptionId: number
	): Promise<boolean> => {
		const success = await this.Provider.provider.unsubscribeEvent({
			id: subscriptionId,
		});
		return success;
	};

	// TODO: handle extending event type correctly (for access to timestamp, etc)
	public fetchEventsOnChainWithCursor = async <EventOnChainType>(
		query: SuiEventFilter,
		cursor?: EventId,
		limit?: number
	): Promise<EventsWithCursor<EventOnChainType>> => {
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

		const events = fetchedEvents.data as EventOnChainType[];
		const nextCursor = fetchedEvents.nextCursor;

		return { events, nextCursor };
	};

	public fetchCastEventsWithCursor = async <
		EventOnChainType,
		EventType
	>(inputs: {
		query: SuiEventFilter;
		eventFromEventOnChain: (eventOnChain: EventOnChainType) => EventType;
		cursor?: EventId;
		limit?: number;
	}): Promise<EventsWithCursor<EventType>> => {
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
		const nextCursor = fetchedEvents.nextCursor;
		return { events, nextCursor };
	};

	// TODO: make this function use timestamp passing as one of event filter args
	public fetchEventsWithinTime = async <T extends Event>(
		fetchEventsFunc: (
			cursor?: EventId,
			limit?: number
		) => Promise<EventsWithCursor<T>>,
		timeUnit: QUnitType | OpUnitType,
		time: number,
		limitStepSize: number = EventsApiHelpers.constants.defaultLimitStepSize
	) => {
		let eventsWithinTime: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				cursor,
				limitStepSize
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
		} while (true);
	};

	public fetchAllEvents = async <T /* extends Event */>(
		fetchEventsFunc: (
			cursor?: EventId,
			limit?: number
		) => Promise<EventsWithCursor<T>>,
		limitStepSize: number = EventsApiHelpers.constants.defaultLimitStepSize
	) => {
		let allEvents: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				cursor,
				limitStepSize
			);
			const events = eventsWithCursor.events;
			allEvents = [...allEvents, ...events];

			if (events.length === 0 || eventsWithCursor.nextCursor === null)
				return allEvents;
			cursor = eventsWithCursor.nextCursor;
		} while (true);
	};

	/////////////////////////////////////////////////////////////////////
	//// Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static suiEventOfTypeOrUndefined = (
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType)
	): SuiEvent | undefined =>
		event.type === (typeof eventType === "string" ? eventType : eventType())
			? event
			: undefined;

	public static castEventOfTypeOrUndefined = <EventTypeOnChain, EventType>(
		event: SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	): EventType | undefined => {
		if (
			!(
				event.type ===
				(typeof eventType === "string" ? eventType : eventType())
			)
		)
			return;

		const castedEvent = castFunction(event as EventTypeOnChain);
		return castedEvent;
	};

	public static findCastEventInTransactionOrUndefined = <
		EventTypeOnChain,
		EventType
	>(
		transaction: SuiTransactionBlockResponse,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	) => {
		const foundEvent = transaction.events?.find(
			(event) =>
				EventsApiHelpers.suiEventOfTypeOrUndefined(event, eventType) !==
				undefined
		);
		if (!foundEvent) return;

		const castedEvent = castFunction(foundEvent as EventTypeOnChain);
		return castedEvent;
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
		eventType: string
	) => `${packageAddress}::${packageName}::${eventType}`;
}

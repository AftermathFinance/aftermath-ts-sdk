import { Event, EventsWithCursor, AnyObjectType } from "../../types";
import {
	EventId,
	EventQuery,
	SuiAddress,
	MoveEvent,
	SuiEvent,
	SuiEventEnvelope,
	SuiTransactionResponse,
} from "@mysten/sui.js";
import dayjs, { QUnitType, OpUnitType } from "dayjs";
import { AftermathApi } from "../providers/aftermathApi";

export class EventsApiHelpers {
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

	public fetchSubscribeToUserEvents = async (
		address: SuiAddress,
		onEvent: (event: SuiEventEnvelope) => void
	): Promise<number> => {
		const userEventSubscriptionId =
			await this.Provider.provider.subscribeEvent(
				{
					SenderAddress: address,
				},
				onEvent
			);
		return userEventSubscriptionId;
	};

	public fetchUnsubscribeFromEvents = async (
		subscriptionId: number
	): Promise<boolean> => {
		const success = await this.Provider.provider.unsubscribeEvent(
			subscriptionId
		);
		return success;
	};

	// TODO: handle extending event type correctly (for access to timestamp, etc)
	public fetchEventsOnChainWithCursor = async <EventOnChainType>(
		query: EventQuery,
		cursor?: EventId,
		eventLimit?: number
	): Promise<EventsWithCursor<EventOnChainType>> => {
		const fetchedEvents = await this.Provider.provider.getEvents(
			query,
			cursor === undefined ? null : cursor,
			eventLimit || null // defaultEventLimit ?
		);

		const events = fetchedEvents.data as EventOnChainType[];
		const nextCursor = fetchedEvents.nextCursor;

		return { events, nextCursor };
	};

	public fetchCastEventsWithCursor = async <EventOnChainType, EventType>(
		query: EventQuery,
		eventFromEventOnChain: (eventOnChain: EventOnChainType) => EventType,
		cursor?: EventId,
		eventLimit?: number
	) => {
		const fetchedEvents = await this.Provider.provider.getEvents(
			query,
			cursor === undefined ? null : cursor,
			eventLimit || null // defaultEventLimit ?
		);
		const eventsOnChain =
			fetchedEvents.data as unknown as EventOnChainType[];
		const events = eventsOnChain.map((event) =>
			eventFromEventOnChain(event)
		);
		const nextCursor = fetchedEvents.nextCursor;
		return { events, nextCursor } as EventsWithCursor<EventType>;
	};

	public fetchEventsWithinTime = async <T extends Event>(
		fetchEventsFunc: (
			cursor?: EventId,
			eventLimit?: number
		) => Promise<EventsWithCursor<T>>,
		timeUnit: QUnitType | OpUnitType,
		time: number,
		eventLimitStepSize: number = 500
	) => {
		let eventsWithinTime: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				cursor,
				eventLimitStepSize
			);
			const events = eventsWithCursor.events;

			const now = Date.now();
			const endIndex = events.findIndex(
				(event) =>
					dayjs(now).diff(event.timestamp, timeUnit, true) > time
			);
			eventsWithinTime = [
				...eventsWithinTime,
				...(endIndex < 0 ? events : events.slice(0, endIndex)),
			];

			if (
				events.length === 0 ||
				eventsWithCursor.nextCursor === null ||
				endIndex >= 0
			)
				return eventsWithinTime;
			cursor = eventsWithCursor.nextCursor;
		} while (true);
	};

	public fetchAllEvents = async <T extends Event>(
		fetchEventsFunc: (
			cursor?: EventId,
			eventLimit?: number
		) => Promise<EventsWithCursor<T>>,
		eventLimitStepSize: number = 500
	) => {
		let allEvents: T[] = [];
		let cursor: EventId | undefined = undefined;
		do {
			const eventsWithCursor: EventsWithCursor<T> = await fetchEventsFunc(
				cursor,
				eventLimitStepSize
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

	public static moveEventOfTypeOrUndefined = (
		event: SuiEventEnvelope | SuiEvent,
		eventType: AnyObjectType | (() => AnyObjectType)
	): MoveEvent | undefined => {
		const actualEvent = "id" in event ? event.event : event;
		return "moveEvent" in actualEvent &&
			actualEvent.moveEvent.type ===
				(typeof eventType === "string" ? eventType : eventType())
			? actualEvent.moveEvent
			: undefined;
	};

	public static castEventEnvelopeOfTypeOrUndefined = <
		EventTypeOnChain,
		EventType
	>(
		eventEnvelope: SuiEventEnvelope,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	): EventType | undefined => {
		const actualEvent =
			"id" in eventEnvelope ? eventEnvelope.event : eventEnvelope;
		if (
			!("moveEvent" in actualEvent) ||
			!(
				actualEvent.moveEvent.type ===
				(typeof eventType === "string" ? eventType : eventType())
			)
		)
			return;

		const castedEvent = castFunction(eventEnvelope as EventTypeOnChain);
		return castedEvent;
	};

	public static findCastEventInTransactionOrUndefined = <
		EventTypeOnChain,
		EventType
	>(
		transaction: SuiTransactionResponse,
		eventType: AnyObjectType | (() => AnyObjectType),
		castFunction: (eventOnChain: EventTypeOnChain) => EventType
	) => {
		const foundEvent = transaction.effects.events?.find(
			(event) =>
				EventsApiHelpers.moveEventOfTypeOrUndefined(
					event,
					eventType
				) !== undefined
		);
		if (!foundEvent) return;

		const eventEnvelope =
			EventsApiHelpers.eventEnvelopeFromEventAndTransaction(
				foundEvent,
				transaction
			);

		const castedEvent = castFunction(eventEnvelope as EventTypeOnChain);
		return castedEvent;
	};

	public static findCastEventInTransactionsOrUndefined = <
		EventTypeOnChain,
		EventType
	>(
		transactions: SuiTransactionResponse[],
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

	public static eventEnvelopeFromEventAndTransaction = (
		event: SuiEvent,
		transaction: SuiTransactionResponse
	): SuiEventEnvelope => {
		const txDigest = transaction.effects.transactionDigest;
		const eventWithData = {
			id: {
				txDigest,
				eventSeq: -1,
			},
			event: { ...event },
			timestamp: transaction.timestamp_ms ?? Date.now(),
			txDigest,
		};
		return eventWithData;
	};
}

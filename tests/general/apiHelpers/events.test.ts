import {
	EventsApiHelpers,
	event,
	jest,
	makeApi,
	OWNER,
	type SuiEvent,
} from "@test/general/fixtures/services.js";

describe("EventsApiHelpers", () => {
	it("queries JSON-RPC events with a stringified event sequence and casts the page", async () => {
		const queryEvents = jest.fn().mockResolvedValue({
			data: [{ type: "raw-event", value: 7 }],
			nextCursor: undefined,
		});
		const api = makeApi({}, {}, { queryEvents });
		const query = { MoveEventType: "0x2::module::Event" } as never;
		const cursor = { txDigest: "digest-1", eventSeq: "7" } as never;

		await expect(
			new EventsApiHelpers(api).fetchCastEventsWithCursor({
				query,
				cursor,
				limit: 5,
				eventFromEventOnChain: (raw: { type: string; value: number }) => ({
					type: raw.type,
					value: raw.value + 1,
				}),
			})
		).resolves.toEqual({
			events: [{ type: "raw-event", value: 8 }],
			nextCursor: null,
		});
		expect(queryEvents).toHaveBeenCalledWith({
			query,
			cursor: { txDigest: "digest-1", eventSeq: "7" },
			limit: 5,
		});
	});

	it("requires the optional JSON-RPC client for the legacy event query seam", async () => {
		const helper = new EventsApiHelpers(makeApi({}));

		await expect(
			helper.fetchCastEventsWithCursor({
				query: { All: true } as never,
				eventFromEventOnChain: (value: unknown) => value,
			})
		).rejects.toThrow(
			"Events().fetchCastEventsWithCursor requires a `SuiJsonRpcClient`"
		);
	});

	it("fetches events within a time window and stops at the first stale event", async () => {
		jest.spyOn(Date, "now").mockReturnValue(1_000_000);
		const fetchEventsFunc = jest.fn().mockResolvedValue({
			events: [
				event("fresh", 999_500, "tx-fresh"),
				event("stale", 998_000, "tx-stale"),
			],
			nextCursor: { txDigest: "next", eventSeq: "2" },
		});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchEventsWithinTime({
				fetchEventsFunc,
				timeMs: 1000,
				limitStepSize: 9,
			})
		).resolves.toEqual([event("fresh", 999_500, "tx-fresh")]);
		expect(fetchEventsFunc).toHaveBeenCalledWith({
			cursor: undefined,
			limit: 9,
		});
	});

	it("fetches all event pages until an empty page or null cursor", async () => {
		const fetchEventsFunc = jest
			.fn()
			.mockResolvedValueOnce({
				events: [event("first", undefined, "tx-1")],
				nextCursor: { txDigest: "next", eventSeq: "1" },
			})
			.mockResolvedValueOnce({
				events: [event("second", undefined, "tx-2")],
				nextCursor: null,
			});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchAllEvents({
				fetchEventsFunc,
				limitStepSize: 3,
			})
		).resolves.toEqual([
			event("first", undefined, "tx-1"),
			event("second", undefined, "tx-2"),
		]);
		expect(fetchEventsFunc).toHaveBeenNthCalledWith(1, {
			cursor: undefined,
			limit: 3,
		});
		expect(fetchEventsFunc).toHaveBeenNthCalledWith(2, {
			cursor: { txDigest: "next", eventSeq: "1" },
			limit: 3,
		});
	});

	it("supports event type matching, exact matching, callback resolution, and transaction search", () => {
		const matching = {
			type: "0xpackage::module::WrappedEvent<0xpackage::module::Event>",
			parsedJson: { amount: "9" },
		} as unknown as SuiEvent;
		const other = {
			type: "0xpackage::module::Other",
			parsedJson: {},
		} as unknown as SuiEvent;
		const cast = (raw: SuiEvent) => ({
			type: raw.type,
			parsed: raw.parsedJson,
		});

		expect(
			EventsApiHelpers.suiEventOfTypeOrUndefined(
				matching,
				"0xpackage::module::Event"
			)
		).toBe(matching);
		expect(
			EventsApiHelpers.suiEventOfTypeOrUndefined(
				other,
				() => "0xpackage::module::Event"
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.castEventOfTypeOrUndefined(
				matching,
				"0xpackage::module::Event",
				cast,
				true
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.castEventOfTypeOrUndefined(
				matching,
				() => "0xpackage::module::WrappedEvent<0xpackage::module::Event>",
				cast,
				true
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventsOrUndefined({
				events: [other, matching, matching],
				eventType: "0xpackage::module::Event",
				castFunction: cast,
			})
		).toHaveLength(2);
		expect(
			EventsApiHelpers.findCastEventOrUndefined({
				events: [other, matching],
				eventType: "0xpackage::module::Event",
				castFunction: cast,
			})
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionOrUndefined(
				{ events: [other, matching] } as never,
				"0xpackage::module::Event",
				cast
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionsOrUndefined(
				[{ events: [other] }, { events: [matching] }] as never,
				"0xpackage::module::Event",
				cast
			)
		).toEqual({ type: matching.type, parsed: matching.parsedJson });
		expect(
			EventsApiHelpers.findCastEventInTransactionsOrUndefined(
				[{ events: [other] }] as never,
				"0xpackage::module::Event",
				cast
			)
		).toBeUndefined();
		expect(
			EventsApiHelpers.createEventType(
				"0xpackage",
				"module",
				"Event",
				"Wrapper"
			)
		).toBe("Wrapper<0xpackage::module::Event>");
		expect(
			EventsApiHelpers.createEventType("0xpackage", "module", "Event")
		).toBe("0xpackage::module::Event");
	});

	it("reports the deprecated event subscription as an explicit unsupported operation", async () => {
		await expect(
			new EventsApiHelpers(makeApi({})).fetchSubscribeToUserEvents({
				address: OWNER,
				onEvent: jest.fn(),
			})
		).rejects.toThrow("fetchSubscribeToUserEvents is not implemented");
	});

	it("caps time-window pagination at its deterministic loop limit", async () => {
		const fetchEventsFunc = jest.fn().mockResolvedValue({
			events: [event("fresh", undefined, "tx-fresh")],
			nextCursor: { txDigest: "next", eventSeq: "1" },
		});

		await expect(
			new EventsApiHelpers(makeApi({})).fetchEventsWithinTime({
				fetchEventsFunc,
				timeMs: 1000,
			})
		).resolves.toHaveLength(20);
		expect(fetchEventsFunc).toHaveBeenCalledTimes(20);
	});
});

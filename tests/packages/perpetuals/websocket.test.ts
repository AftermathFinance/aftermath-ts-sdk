import { afterEach, describe, expect, it } from "@jest/globals";
import type { PerpetualsWsUpdatesResponseMessage } from "@sdk/packages/perpetuals/perpetualsTypes";
import { clientForTest } from "@test/packages/perpetuals/fixturesApi.js";

class MockWebSocket {
	static readonly OPEN = 1;
	readonly sent: string[] = [];
	readonly listeners = new Map<string, EventListener[]>();
	readyState = MockWebSocket.OPEN;

	constructor(readonly url: string) {}

	addEventListener(type: string, listener: EventListener): void {
		const callbacks = this.listeners.get(type) ?? [];
		callbacks.push(listener);
		this.listeners.set(type, callbacks);
	}

	emit(type: string, event: Event): void {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event);
		}
	}

	send(value: string): void {
		this.sent.push(value);
	}

	close(): void {
		this.readyState = 3;
	}
}

const originalWebSocket = globalThis.WebSocket;

afterEach(() => {
	if (originalWebSocket === undefined) {
		Reflect.deleteProperty(globalThis, "WebSocket");
	} else {
		globalThis.WebSocket = originalWebSocket;
	}
});

describe("Perpetuals public WebSocket streams", () => {
	it("sends market subscriptions and parses update messages", () => {
		globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
		const messages: unknown[] = [];
		const stream = clientForTest().openUpdatesWebsocketStream({
			onMessage: (message) => messages.push(message),
		});
		const socket = stream.ws as unknown as MockWebSocket;
		expect(socket.url).toBe("wss://sdk.test/api/perpetuals/ws/updates");

		stream.subscribeMarket({ marketId: "0x1" });
		expect(socket.sent).toEqual([
			JSON.stringify({
				action: "subscribe",
				subscriptionType: { market: { marketId: "0x1" } },
			}),
		]);

		socket.emit(
			"message",
			Object.assign(new Event("message"), {
				data: '{"oracle":{"marketId":"0x1","basePrice":123}}',
			})
		);
		expect(messages).toEqual([{ oracle: { marketId: "0x1", basePrice: 123 } }]);
		stream.close();
		expect(socket.readyState).toBe(3);
	});

	it("parses orderbook delta nonces with and without prevNonce", () => {
		globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
		const messages: PerpetualsWsUpdatesResponseMessage[] = [];
		const stream = clientForTest().openUpdatesWebsocketStream({
			onMessage: (message) => messages.push(message),
		});
		const socket = stream.ws as unknown as MockWebSocket;

		stream.subscribeOrderbook({ marketId: "0x1" });
		expect(socket.sent).toEqual([
			JSON.stringify({
				action: "subscribe",
				subscriptionType: { orderbook: { marketId: "0x1" } },
			}),
		]);

		const deltas = {
			bidsDeltas: [],
			asksDeltas: [],
			asksTotalSizeDelta: 0,
			bidsTotalSizeDelta: 0,
		};
		const emitDelta = (nonces: Record<string, string>) =>
			socket.emit(
				"message",
				Object.assign(new Event("message"), {
					data: JSON.stringify({
						orderbook: {
							marketId: "0x1",
							orderbookDeltas: { ...deltas, ...nonces },
						},
					}),
				})
			);
		// Current backends: `prevNonce` uses the same suffixed encoding as `nonce`.
		emitDelta({ nonce: "12n", prevNonce: "9n" });
		// Older backends omit `prevNonce`.
		emitDelta({ nonce: "13n" });

		const parsed = messages.map((message) =>
			"orderbook" in message ? message.orderbook.orderbookDeltas : undefined
		);
		expect(parsed).toEqual([
			{ ...deltas, nonce: 12n, prevNonce: 9n },
			{ ...deltas, nonce: 13n },
		]);
		expect(parsed[1]?.prevNonce).toBeUndefined();
		expect(parsed[1] !== undefined && "prevNonce" in parsed[1]).toBe(false);
		stream.close();
	});

	it("subscribes to candles on open and forwards the candle payload", () => {
		globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
		const messages: unknown[] = [];
		const stream = clientForTest().openMarketCandlesWebsocketStream({
			marketId: "0x1",
			interval: "1m",
			onMessage: (message) => messages.push(message),
		});
		const socket = stream.ws as unknown as MockWebSocket;
		expect(socket.url).toBe("wss://sdk.test/api/perpetuals/ws/updates");
		socket.emit("open", new Event("open"));
		expect(socket.sent).toEqual([
			JSON.stringify({
				action: "subscribe",
				subscriptionType: {
					marketCandles: { marketId: "0x1", interval: "1m" },
				},
			}),
		]);

		socket.emit(
			"message",
			Object.assign(new Event("message"), {
				data: '{"marketCandles":{"marketId":"0x1","lastCandle":{"startTimeMs":"1n"}}}',
			})
		);
		expect(messages).toEqual([
			{ marketId: "0x1", lastCandle: { startTimeMs: 1n } },
		]);
		stream.close();
		expect(socket.readyState).toBe(3);
	});
});

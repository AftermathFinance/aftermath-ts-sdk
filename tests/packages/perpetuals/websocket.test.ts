import { afterEach, describe, expect, it } from "@jest/globals";
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

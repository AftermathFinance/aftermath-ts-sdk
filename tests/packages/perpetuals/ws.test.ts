import type { PerpetualsWsUpdatesResponseMessage } from "@sdk/types";
import { Perpetuals } from "@test/packages/perpetuals/fixturesDomain.js";

type MockWsCallback = (event: unknown) => void;

class MockWS {
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	readonly listeners: Record<string, MockWsCallback[]> = {};
	readonly sent: string[] = [];
	readyState = MockWS.OPEN;
	readonly url: string;

	constructor(url: string) {
		this.url = url;
	}

	addEventListener(event: string, callback: MockWsCallback) {
		const callbacks = this.listeners[event] ?? [];
		callbacks.push(callback);
		this.listeners[event] = callbacks;
	}

	removeEventListener() {
		// The fixture does not need listener removal.
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.readyState = MockWS.CLOSED;
	}

	triggerMessage(data: string) {
		for (const callback of this.listeners.message ?? []) {
			callback({ data });
		}
	}
}

describe("Perpetuals updates websocket", () => {
	const originalWebSocket = globalThis.WebSocket;

	afterEach(() => {
		globalThis.WebSocket = originalWebSocket;
	});

	it("preserves market mark price and revives a null oracle book price", () => {
		globalThis.WebSocket = MockWS as unknown as typeof WebSocket;
		const messages: PerpetualsWsUpdatesResponseMessage[] = [];
		const perps = new Perpetuals({ baseUrl: "https://sdk.test" });
		const { ws } = perps.openUpdatesWebsocketStream({
			onMessage: (message: PerpetualsWsUpdatesResponseMessage) => {
				messages.push(message);
			},
		});
		const mockWs = ws as unknown as MockWS;

		mockWs.triggerMessage(
			JSON.stringify({
				market: {
					objectId: "0xmarket",
					markPrice: 81_000,
				},
			})
		);
		mockWs.triggerMessage(
			JSON.stringify({
				oracle: {
					marketId: "0xmarket",
					basePrice: 80_990,
					collateralPrice: 1,
					markPrice: 81_000,
					bookPrice: null,
				},
			})
		);

		expect(messages[0]).toEqual({
			market: { objectId: "0xmarket", markPrice: 81_000 },
		});
		expect(messages[1]).toEqual({
			oracle: {
				marketId: "0xmarket",
				basePrice: 80_990,
				collateralPrice: 1,
				markPrice: 81_000,
				bookPrice: undefined,
			},
		});
	});
});

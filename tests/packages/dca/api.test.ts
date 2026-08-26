import {
	COIN_A,
	COIN_B,
	DcaApi,
	dcaAddresses,
	describe,
	EVENTS,
	EVENTS_V2,
	expect,
	fakeApi,
	it,
	moveCallData,
	ORDER_ID,
	PACKAGE,
	Transaction,
} from "@test/packages/dca/fixtures.js";

describe("DcaApi on-chain boundary", () => {
	it("requires DCA addresses and exposes all event type variants", () => {
		expect(() => new DcaApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
		const api = new DcaApi(fakeApi({ addresses: { dca: dcaAddresses } }));
		expect(api.addresses).toEqual(dcaAddresses);
		expect(api.eventTypes).toEqual({
			createdOrder: `${EVENTS}::events::CreatedOrderEvent`,
			createdOrderV2: `${EVENTS_V2}::events::CreatedOrderEventV2`,
			closedOrder: `${EVENTS}::events::ClosedOrderEvent`,
			executedTrade: `${EVENTS}::events::ExecutedTradeEvent`,
		});
	});

	it("builds close_order for both object IDs and prebuilt transaction arguments", () => {
		const api = new DcaApi(fakeApi({ addresses: { dca: dcaAddresses } }));
		const tx = new Transaction();
		api.createCloseOrderTx({
			tx,
			allocateCoinType: COIN_A,
			buyCoinType: COIN_B,
			orderId: ORDER_ID,
		});
		expect(moveCallData(tx)).toMatchObject({
			package: PACKAGE,
			module: "order",
			function: "close_order",
			typeArguments: [COIN_A, COIN_B],
		});

		const argumentTx = new Transaction();
		const orderArgument = argumentTx.object(ORDER_ID);
		api.createCloseOrderTx({
			tx: argumentTx,
			allocateCoinType: COIN_A,
			buyCoinType: COIN_B,
			orderId: orderArgument,
		});
		expect(moveCallData(argumentTx)).toMatchObject({
			function: "close_order",
			typeArguments: [COIN_A, COIN_B],
		});
	});
});

import {
	describe,
	EVENTS,
	expect,
	fakeApi,
	it,
	LimitOrdersApi,
	limitAddresses,
} from "@test/packages/limitOrders/fixtures.js";

describe("LimitOrdersApi event boundary", () => {
	it("requires addresses and creates the CreatedOrderEventV1 type", () => {
		expect(() => new LimitOrdersApi(fakeApi())).toThrow(
			"not all required addresses have been set in provider"
		);
		const api = new LimitOrdersApi(
			fakeApi({ addresses: { limitOrders: limitAddresses } })
		);
		expect(api.addresses).toEqual(limitAddresses);
		expect(api.eventTypes).toEqual({
			createdOrder: `${EVENTS}::events::CreatedOrderEventV1`,
		});
	});
});

import { PriceFeeds, PriceFeedsApi } from "@test/general/fixtures/services.js";

describe("Caller-backed general services", () => {
	it("the inactive price-feed modules remain explicit empty exports", () => {
		expect(PriceFeeds).toEqual({});
		expect(PriceFeedsApi).toEqual({});
	});
});

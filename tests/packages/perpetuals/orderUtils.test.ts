import {
	Perpetuals,
	PerpetualsOrderSide,
	PerpetualsOrderUtils,
	USDC,
} from "@test/packages/perpetuals/fixturesDomain.js";

describe("PerpetualsOrderUtils and pure protocol helpers", () => {
	it("encodes and decodes ask and bid order ids without losing bigint precision", () => {
		const ask = PerpetualsOrderUtils.orderId(
			1234n,
			42n,
			PerpetualsOrderSide.Ask
		);
		const bid = PerpetualsOrderUtils.orderId(
			1234n,
			42n,
			PerpetualsOrderSide.Bid
		);

		expect(ask).toBe(0x4d2000000000000002an);
		expect(bid).toBe(0xfffffffffffffb2d000000000000002an);
		expect(PerpetualsOrderUtils.isAsk(ask)).toBe(true);
		expect(PerpetualsOrderUtils.isAsk(bid)).toBe(false);
		expect(PerpetualsOrderUtils.price(ask)).toBe(1234n);
		expect(PerpetualsOrderUtils.price(bid)).toBe(1234n);
		expect(PerpetualsOrderUtils.counter(42n)).toBe(42n);
		expect(Perpetuals.orderIdToSide(ask)).toBe(PerpetualsOrderSide.Ask);
		expect(Perpetuals.orderIdToSide(bid)).toBe(PerpetualsOrderSide.Bid);
	});

	it("converts fixed prices and sizes at the documented nine-decimal boundary", () => {
		expect(Perpetuals.priceToOrderPrice({ price: 12.345_678_901_6 })).toBe(
			12_345_678_902n
		);
		expect(
			Perpetuals.orderPriceToPrice({ orderPrice: 12_345_678_902n })
		).toBeCloseTo(12.345_678_902, 9);
		expect(Perpetuals.lotOrTickSizeToBigInt(0.125)).toBe(125_000_000n);
		expect(Perpetuals.lotOrTickSizeToNumber(125_000_000n)).toBe(0.125);
	});

	it("maps position sides, execution prices, and collateral event types", () => {
		expect(Perpetuals.positionSide({ baseAssetAmount: 3 })).toBe(
			PerpetualsOrderSide.Bid
		);
		expect(Perpetuals.positionSide({ baseAssetAmount: 0 })).toBe(
			PerpetualsOrderSide.Bid
		);
		expect(Perpetuals.positionSide({ baseAssetAmount: -3 })).toBe(
			PerpetualsOrderSide.Ask
		);
		expect(
			Perpetuals.orderPriceFromEvent({
				orderEvent: {
					baseAssetDelta: 2,
					quoteAssetDelta: 4500,
				} as never,
			})
		).toBe(2250);
		expect(
			Perpetuals.eventTypeForCollateral({
				eventType: "0xperps::events::Liquidated",
				collateralCoinType: USDC,
			})
		).toBe("0xperps::events::Liquidated<0x2::usdc::USDC>");
	});
});

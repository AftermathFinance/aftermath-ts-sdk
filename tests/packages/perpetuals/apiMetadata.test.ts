import {
	COLLATERAL,
	describe,
	EVENT_PACKAGE,
	expect,
	FULL_ID,
	it,
	PerpetualsApi,
} from "@test/packages/perpetuals/fixturesApi.js";

describe("PerpetualsApi metadata seam", () => {
	const addresses = {
		packages: { events: EVENT_PACKAGE },
		objects: { registry: FULL_ID },
	};

	it("requires configured perpetuals addresses", () => {
		expect(
			() =>
				new PerpetualsApi({
					addresses: {},
				} as never)
		).toThrow("not all required addresses have been set in provider");
	});

	it("builds all event type selectors and account capability types", () => {
		const api = new PerpetualsApi({
			addresses: { perpetuals: addresses },
		} as never);
		const event = (name: string) => `${EVENT_PACKAGE}::events::${name}`;

		expect(api.addresses).toEqual(addresses);
		expect(api.moveErrors).toEqual({});
		expect(api.eventTypes).toEqual({
			withdrewCollateral: event("WithdrewCollateral"),
			depositedCollateral: event("DepositedCollateral"),
			settledFunding: event("SettledFunding"),
			allocatedCollateral: event("AllocatedCollateral"),
			deallocatedCollateral: event("DeallocatedCollateral"),
			liquidated: event("LiquidatedPosition"),
			filledTakerOrderLiquidator: event("FilledTakerOrderLiquidator"),
			performedLiquidation: event("PerformedLiquidation"),
			createdAccount: event("CreatedAccount"),
			canceledOrder: event("CanceledOrder"),
			filledMakerOrders: event("FilledMakerOrders"),
			filledMakerOrder: event("FilledMakerOrder"),
			filledTakerOrder: event("FilledTakerOrder"),
			reducedOrder: event("ReducedOrder"),
			postedOrder: event("PostedOrder"),
			updatedPremiumTwap: event("UpdatedPremiumTwap"),
			updatedSpreadTwap: event("UpdatedSpreadTwap"),
			updatedFunding: event("UpdatedFunding"),
			updatedMarketVersion: event("UpdatedClearingHouseVersion"),
			createdStopOrderTicket: event("CreatedStopOrderTicket"),
			deletedStopOrderTicket: event("DeletedStopOrderTicket"),
			editedStopOrderTicketExecutor: event("EditedStopOrderTicketExecutor"),
			addedStopOrderTicketCollateral: event("AddedStopOrderTicketCollateral"),
			removedStopOrderTicketCollateral: event(
				"RemovedStopOrderTicketCollateral"
			),
			editedStopOrderTicketDetails: event("EditedStopOrderTicketDetails"),
			executedStopOrderTicket: event("ExecutedStopOrderTicket"),
			performedAdl: event("PerformedADL"),
		});
		expect(api.getAccountCapType({ collateralCoinType: COLLATERAL })).toBe(
			`${EVENT_PACKAGE}::account::Account<${COLLATERAL}>`
		);
	});
});

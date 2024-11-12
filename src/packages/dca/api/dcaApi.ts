import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, DcaAddresses } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";

export class DcaApi {
	// =========================================================================
	// Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			dca: "order",
			events: "events",
			config: "config",
		},
		eventNames: {
			createdOrder: "CreatedOrderEvent",
			closedOrder: "ClosedOrderEvent",
			executedTrade: "ExecutedTradeEvent",
		},
	};

	// =========================================================================
	// Class Members
	// =========================================================================

	public readonly addresses: DcaAddresses;
	public readonly eventTypes: {
		createdOrder: AnyObjectType;
		closedOrder: AnyObjectType;
		executedTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.dca;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
			closedOrder: this.closedOrderEventType(),
			executedTrade: this.executedOrderEventType(),
		};
	}

	// =========================================================================
	// Events
	// =========================================================================

	private createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);

	private closedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

	private executedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);
}

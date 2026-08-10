import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import type { AftermathApi } from "../../../general/providers";
import type { AnyObjectType, LimitAddresses } from "../../../types";

export class LimitOrdersApi {
	// =========================================================================
	// Class Members
	// =========================================================================

	public readonly addresses: LimitAddresses;
	public readonly eventTypes: {
		createdOrder: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.limitOrders;
		if (!addresses) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
		};
	}

	// =========================================================================
	// Events
	// =========================================================================

	private readonly createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			"events",
			"CreatedOrderEventV1"
		);
}

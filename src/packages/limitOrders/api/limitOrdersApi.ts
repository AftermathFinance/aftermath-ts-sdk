import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, LimitAddresses } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";

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

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.limitOrders;
		if (!addresses) {
			throw new Error(
				"not all required addresses have been set in provider"
			);
		}

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
		};
	}

	// =========================================================================
	// Events
	// =========================================================================

	private createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.limitOrdersInitial,
			"events",
			"CreatedOrderEventV1"
		);
}

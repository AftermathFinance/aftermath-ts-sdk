import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import type { AftermathApi } from "../../../general/providers";
import type { AnyObjectType, LimitAddresses } from "../../../types";

/**
 * Provides low-level limit-order addresses and event type strings.
 *
 * This class does not perform HTTP requests or build user-facing limit-order
 * transactions. Use `LimitOrders` for the API facade and `AftermathApi` for
 * direct on-chain access.
 */
export class LimitOrdersApi {
	// =========================================================================
	// Class Members
	// =========================================================================

	/** Package addresses used by limit-order transactions and events. */
	public readonly addresses: LimitAddresses;
	/** Fully qualified event types exposed by the limit-order package. */
	public readonly eventTypes: {
		/** Type of the version-one order-created event. */
		createdOrder: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a low-level limit-order helper from a configured `AftermathApi`.
	 *
	 * @param api - Provider containing the limit-order package and event addresses.
	 * @throws `Error` when the provider does not contain limit-order addresses.
	 */
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

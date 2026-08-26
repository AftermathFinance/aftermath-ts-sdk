import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import type { AftermathApi } from "../../../general/providers/aftermathApi";
import type {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface";
import type { AnyObjectType, RouterAddresses } from "../../../types";

/**
 * Provides router package addresses, event types, and decoded Move errors for
 * applications that use `AftermathApi` directly.
 *
 * The high-level `Router` class performs HTTP reads and transaction requests.
 * `RouterApi` exposes the provider-side on-chain metadata used to interpret
 * those requests and events.
 */
export class RouterApi implements MoveErrorsInterface {
	// =========================================================================
	//  Constants
	// =========================================================================

	/** Names of the router Move modules used to build event and error keys. */
	public static readonly constants = {
		/** Move module names in the router utility package. */
		moduleNames: {
			/** The module that validates routed swaps. */
			router: "router",
			/** The module that emits router events. */
			events: "events",
			/** The module that charges protocol fees. */
			protocolFee: "protocol_fee",
			/** The module that guards package versions. */
			version: "version",
			/** The module that authorizes shared-object access. */
			admin: "admin",
		},
		/** Event names emitted by the router utility package. */
		eventNames: {
			/** The event emitted after a routed swap completes. */
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	/** The configured router package and object addresses. */
	public readonly addresses: RouterAddresses;
	/** Event types derived from the configured router package address. */
	public readonly eventTypes: {
		/** The fully qualified `SwapCompletedEvent` type. */
		routerTrade: AnyObjectType;
	};
	/** Move error names grouped by package, module, and numeric code. */
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates the provider-side router metadata.
	 *
	 * This constructor does not make a network request. It throws before the
	 * instance is usable when `api.addresses.router` is missing.
	 *
	 * @param api - The configured `AftermathApi` provider.
	 * @throws `Error` when the provider has no router address configuration.
	 */
	constructor(private readonly api: AftermathApi) {
		if (!this.api.addresses.router) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = this.api.addresses.router;
		this.eventTypes = {
			routerTrade: this.routerTradeEventType(),
		};
		this.moveErrors = {
			[this.addresses.packages.utils]: {
				[RouterApi.constants.moduleNames.protocolFee]: {
					/// A non-one-time-witness type has been provided to the `ProtocolFeeConfig`'s `create` function.
					1: "Protocol Fee Config Already Created",
					/// Occurs when `change_fee` is called more than once during the same Epoch.
					2: "Bad Epoch",
					/// A user provided a new protocol fees that do not sum to one.
					3: "Not Normalized",
				},
				[RouterApi.constants.moduleNames.router]: {
					0: "Not Authorized",
					1: "Invalid Coin In",
					2: "Invalid Coin Out",
					4: "Invalid Previous Swap",
					5: "Invalid Slippage",
					/// A route is constructed that bypasses one of `begin_router_tx_and_pay_fees` or
					///  `end_router_tx_and_pay_fees`.
					6: "No Fees Paid",
				},
				[RouterApi.constants.moduleNames.version]: {
					/// A user tries to interact with an old contract.
					0: "Invalid Version",
				},
				[RouterApi.constants.moduleNames.admin]: {
					/// Admin has not authorized the calling shared object to acess a permissioned function.
					0: "Not Authorized",
					/// Admin has already authorized the calling shared object to acess a permissioned function.
					1: "Already Authorized",
				},
			},
		};
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Events
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private readonly routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.utils,
			RouterApi.constants.moduleNames.events,
			RouterApi.constants.eventNames.routerTrade
		);
}

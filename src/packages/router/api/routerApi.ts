import { AftermathApi } from "../../../general/providers/aftermathApi.ts";
import {
	UserEventsInputs,
	RouterTradeEvent,
	AnyObjectType,
	RouterAddresses,
} from "../../../types.ts";
import { RouterTradeEventOnChain } from "./routerApiCastingTypes.ts";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers.ts";
import { RouterApiCasting } from "./routerApiCasting.ts";
import {
	MoveErrors,
	MoveErrorsInterface,
} from "../../../general/types/moveErrorsInterface.ts";

/**
 * RouterApi class provides methods for interacting with the Aftermath Router API.
 * @class
 */
export class RouterApi implements MoveErrorsInterface {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		moduleNames: {
			router: "router",
			events: "events",
			protocolFee: "protocol_fee",
			version: "version",
			admin: "admin",
		},
		eventNames: {
			routerTrade: "SwapCompletedEvent",
		},
	};

	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly addresses: RouterAddresses;
	public readonly eventTypes: {
		routerTrade: AnyObjectType;
	};
	public readonly moveErrors: MoveErrors;

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an instance of RouterApi.
	 * @constructor
	 * @param {AftermathApi} Provider - The Aftermath API instance.
	 */
	constructor(private readonly Provider: AftermathApi) {
		if (!this.Provider.addresses.router)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = this.Provider.addresses.router;
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

	private routerTradeEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.utils,
			RouterApi.constants.moduleNames.events,
			RouterApi.constants.eventNames.routerTrade
		);
}

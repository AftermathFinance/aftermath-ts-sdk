import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, LimitAddresses, SuiAddress } from "../../../types";
import {
	Transaction,
	TransactionObjectArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import {
	ApiLimitTransactionForCancelOrderBody,
	ApiLimitTransactionForCreateOrderBody,
	LimitOrderObject,
	LimitOrdersObject,
} from "../limitTypes";
import { Coin } from "../../coin";
import {
	LimitIndexerActiveOrdersRequest,
	LimitIndexerOrderCancelRequest,
	LimitIndexerOrderCancelResponse,
	LimitIndexerOrderCreateRequest,
	LimitIndexerOrderCreateResponse,
	LimitIndexerOrderResponse,
	LimitIndexerOrdersRequest,
} from "./limitApiCastingTypes";
import { Casting, Helpers } from "../../../general/utils";
import { TransactionsApiHelpers } from "../../../general/apiHelpers/transactionsApiHelpers";
import { Limit } from "../limit";

export class LimitApi {
	// =========================================================================
	// Constants
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			limit: "order",
			events: "events",
		},
		eventNames: {
			createdOrder: "CreatedOrderEvent",
		},
	};

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
		const addresses = this.Provider.addresses.limit;
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
			this.addresses.packages.limit,
			LimitApi.constants.moduleNames.events,
			LimitApi.constants.eventNames.createdOrder
		);
}

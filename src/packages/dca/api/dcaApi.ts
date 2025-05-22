import { AftermathApi } from "../../../general/providers";
import {
	AnyObjectType,
	CoinType,
	DcaAddresses,
	ObjectId,
} from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Helpers } from "../../../general/utils";
import { Transaction, TransactionArgument } from "@mysten/sui/transactions";

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
			createdOrderV2: "CreatedOrderEventV2",
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
		createdOrderV2: AnyObjectType;
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
			createdOrderV2: this.createdOrderEventTypeV2(),
			closedOrder: this.closedOrderEventType(),
			executedTrade: this.executedOrderEventType(),
		};
	}

	public createCloseOrderTx = (inputs: {
		tx: Transaction;
		allocateCoinType: CoinType;
		buyCoinType: CoinType;
		orderId: ObjectId | TransactionArgument;
	}) => {
		const { tx } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.dca,
				DcaApi.constants.moduleNames.dca,
				"close_order"
			),
			typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
			arguments: [
				tx.object(inputs.orderId),
				tx.object(this.addresses.objects.config),
			],
		});
	};

	// =========================================================================
	// Events
	// =========================================================================

	private createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);

	private createdOrderEventTypeV2 = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.eventsV2,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrderV2
		);

	private closedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

	private executedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);
}

import { AftermathApi } from "../../../general/providers";
import {
	AnyObjectType,
	CoinType,
	DcaAddresses,
	ObjectId,
} from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { Helpers } from "../../../general/utils";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { Transaction } from "@mysten/sui/transactions";

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

	public createCloseOrderTx = (inputs: {
		tx: Transaction | TransactionBlock;
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
			this.addresses.packages.dcaInitial,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);

	private closedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dcaInitial,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

	private executedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.dcaInitial,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);
}

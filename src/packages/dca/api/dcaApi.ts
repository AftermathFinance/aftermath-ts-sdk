import type {
	Transaction,
	TransactionArgument,
} from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import type { AftermathApi } from "../../../general/providers";
import { Helpers } from "../../../general/utils";
import type {
	AnyObjectType,
	CoinType,
	DcaAddresses,
	ObjectId,
} from "../../../types";

/**
 * Provides the low-level on-chain helpers used by the DCA package.
 *
 * The class reads DCA package addresses from `AftermathApi` and builds Move
 * arguments or event type strings. It does not send HTTP requests or submit
 * transactions.
 */
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

	/** Package and shared-object addresses required by DCA transactions and events. */
	public readonly addresses: DcaAddresses;
	/** Fully qualified event types for the DCA event versions exposed by this API. */
	public readonly eventTypes: {
		/** Type of the version-one order-created event. */
		createdOrder: AnyObjectType;
		/** Type of the version-two order-created event. */
		createdOrderV2: AnyObjectType;
		/** Type of the order-closed event. */
		closedOrder: AnyObjectType;
		/** Type of the executed-trade event. */
		executedTrade: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a low-level DCA helper from a configured `AftermathApi`.
	 *
	 * @param api - Provider containing the DCA package and object addresses.
	 * @throws `Error` when the provider does not contain DCA addresses.
	 */
	constructor(private readonly api: AftermathApi) {
		const addresses = this.api.addresses.dca;
		if (!addresses) {
			throw new Error("not all required addresses have been set in provider");
		}

		this.addresses = addresses;
		this.eventTypes = {
			createdOrder: this.createdOrderEventType(),
			createdOrderV2: this.createdOrderEventTypeV2(),
			closedOrder: this.closedOrderEventType(),
			executedTrade: this.executedOrderEventType(),
		};
	}

	/**
	 * Appends the DCA `close_order` Move call to a transaction.
	 *
	 * This method only mutates the supplied transaction. It does not make a
	 * network request, sign the transaction, or execute it. Pass the order ID
	 * as a string to create an object argument, or pass an existing
	 * `TransactionArgument` when composing a larger transaction.
	 *
	 * @param inputs - Transaction, coin type arguments, and the DCA order ID.
	 * @returns The Move-call result appended to `inputs.tx`.
	 * @throws `Error` when the configured DCA addresses are unavailable.
	 * @example
	 * ```typescript
	 * import { Transaction } from "@mysten/sui/transactions";
	 * import { DcaApi, type AftermathApi } from "aftermath-ts-sdk";
	 *
	 * declare const aftermathApi: AftermathApi;
	 * const api = new DcaApi(aftermathApi);
	 * const tx = new Transaction();
	 * api.createCloseOrderTx({
	 *	tx,
	 *	allocateCoinType: "0x2::sui::SUI",
	 *	buyCoinType: "0xcoin::asset::COIN",
	 *	orderId: "0xorder",
	 * });
	 * ```
	 */
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
				typeof inputs.orderId === "string"
					? tx.object(inputs.orderId)
					: inputs.orderId,
				tx.object(this.addresses.objects.config),
			],
		});
	};

	// =========================================================================
	// Events
	// =========================================================================

	private readonly createdOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);

	private readonly createdOrderEventTypeV2 = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.eventsV2,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrderV2
		);

	private readonly closedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

	private readonly executedOrderEventType = () =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);
}

import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import {
	AnyObjectType,
	BigIntAsString,
	CoinDecimal,
	CoinSymbol,
	ObjectId,
	OracleAddresses,
} from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";
import { Sui } from "../../sui";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";

export class OracleApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	private static readonly constants = {
		moduleNames: {
			events: "events",
		},
	};

	public readonly addresses: OracleAddresses;

	public readonly eventTypes: {
		updatedPriceFeed: AnyObjectType;
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		const addresses = this.Provider.addresses.oracle;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
		this.eventTypes = {
			updatedPriceFeed: this.eventType("UpdatedPriceFeed"),
		};
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPrice = async (inputs: {
		priceFeedId: ObjectId;
	}): Promise<number> => {
		const tx = new Transaction();

		this.getPriceTx({ ...inputs, tx });

		const priceBytes =
			await this.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const price = Casting.bigIntFromBytes(priceBytes);
		return IFixedUtils.numberFromIFixed(price);
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public getPriceTx = (inputs: {
		tx: Transaction;
		priceFeedId: ObjectId;
	}) /* u256 */ => {
		const { tx, priceFeedId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracleReader,
				"oracle_reader",
				"get_average_price_for_all_sources"
			),
			typeArguments: [],
			arguments: [
				tx.object(priceFeedId), // PriceFeedStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure.u64(Casting.u64MaxBigInt), // A really huge value for tolerance, we never want it here
				tx.pure.bool(false), // price of unit
				tx.pure.bool(false), // may abort
			],
		});
	};

	// =========================================================================
	//  Private
	// =========================================================================

	// =========================================================================
	//  Event Types
	// =========================================================================

	private eventType = (eventName: string) =>
		EventsApiHelpers.createEventType(
			this.addresses.packages.events,
			OracleApi.constants.moduleNames.events,
			eventName
		);
}

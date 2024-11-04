import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { ObjectId, OracleAddresses } from "../../../types";
import { Sui } from "../../sui";

export class OracleApi {
	public readonly addresses: OracleAddresses;

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
	}

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
}

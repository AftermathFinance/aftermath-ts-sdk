import { TransactionBlock } from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { ObjectId, OracleAddresses } from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";
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
	//  Inspections
	// =========================================================================

	public fetchPrice = async (inputs: {
		PriceFeedId: ObjectId;
	}): Promise<number> => {
		const tx = new TransactionBlock();

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
		tx: TransactionBlock;
		PriceFeedId: ObjectId;
	}) /* u256 */ => {
		const { tx, PriceFeedId } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracleReader,
				"oracle_reader",
				"get_average_price_for_all_sources"
			),
			typeArguments: [],
			arguments: [
				tx.object(PriceFeedId), // PriceFeedStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure(Casting.u64MaxBigInt), // A really huge value for tolerance, we never want it here
				tx.pure(false), // price of unit
				tx.pure(false), // may abort
			],
		});
	};
}

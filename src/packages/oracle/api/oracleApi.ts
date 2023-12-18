import { TransactionBlock } from "@mysten/sui.js/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { OracleAddresses } from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";
import { Sui } from "../../sui";

export type OracleCoinSymbol = string;

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
		coinSymbol: OracleCoinSymbol;
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
		coinSymbol: OracleCoinSymbol;
	}) /* u256 */ => {
		const { tx, coinSymbol } = inputs;
		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				this.addresses.packages.oracle,
				"oracle_reader",
				"get_average_price_for_all_sources"
			),
			typeArguments: [],
			arguments: [
				tx.object(this.addresses.objects.priceFeedStorage), // PriceFeedStorage
				tx.object(Sui.constants.addresses.suiClockId), // Clock
				tx.pure(coinSymbol), // symbol
				tx.pure(1000000000000000), // A really huge value for tolerance, we never want it here
				tx.pure(Boolean(false)), // price of unit
				tx.pure(Boolean(false)), // may abort
			],
		});
	};
}

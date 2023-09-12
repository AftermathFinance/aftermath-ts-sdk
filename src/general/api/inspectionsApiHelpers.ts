import { TransactionBlock } from "@mysten/sui.js/transactions";
import { AftermathApi } from "../providers/aftermathApi";
import { Byte, SuiAddress } from "../../types";

export class InspectionsApiHelpers {
	public static constants = {
		devInspectSigner:
			"0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5",
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchFirstBytesFromTxOutput = async (
		tx: TransactionBlock,
		sender?: SuiAddress
	) => {
		return (await this.fetchAllBytesFromTxOutput({ tx, sender }))[0];
	};

	// TODO: replace all bytes types with uint8array type
	public fetchAllBytesFromTxOutput = async (inputs: {
		tx: TransactionBlock;
		sender?: SuiAddress;
	}): Promise<Byte[][]> => {
		const sender =
			inputs.sender ?? InspectionsApiHelpers.constants.devInspectSigner;
		const response =
			await this.Provider.provider.devInspectTransactionBlock({
				sender,
				transactionBlock: inputs.tx,
			});

		if (response.effects.status.status === "failure") {
			console.error(response.error);
			console.error(response.effects.status.error);
			throw Error("dev inspect move call failed");
		}

		if (!response.results)
			throw Error("dev inspect move call returned no results");

		const returnVals = response.results[0].returnValues;
		if (!returnVals)
			throw Error("dev inspect move call had no return values");

		const outputsBytes = returnVals.map((val) => val[0]);
		return outputsBytes;
	};
}

import { TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../providers/aftermathApi";
import { RpcApiHelpers } from "./rpcApiHelpers";
import { Byte } from "../../types";

export class InspectionsApiHelpers {
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

	public fetchFirstBytesFromTxOutput = async (tx: TransactionBlock) => {
		return (await this.fetchAllBytesFromTxOutput({ tx }))[0];
	};

	// TODO: replace all bytes types with uint8array type
	public fetchAllBytesFromTxOutput = async (inputs: {
		tx: TransactionBlock;
	}): Promise<Byte[][]> => {
		const signer = RpcApiHelpers.constants.devInspectSigner;

		const response =
			await this.Provider.provider.devInspectTransactionBlock({
				sender: signer,
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

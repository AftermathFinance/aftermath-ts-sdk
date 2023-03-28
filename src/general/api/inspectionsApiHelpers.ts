import { TransactionBlock } from "@mysten/sui.js";
import { AftermathApi } from "../providers/aftermathApi";
import { RpcApiHelpers } from "./rpcApiHelpers";
import { Byte } from "../../types";

export class InspectionsApiHelpers {
	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	/////////////////////////////////////////////////////////////////////
	//// Public Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Fetching
	/////////////////////////////////////////////////////////////////////

	public fetchBytesFromTransaction = async (tx: TransactionBlock) => {
		const signer = RpcApiHelpers.constants.devInspectSigner;

		const response =
			await this.Provider.provider.devInspectTransactionBlock({
				sender: signer,
				transactionBlock: tx,
			});

		if (response.effects.status.status === "failure")
			throw Error("dev inspect move call failed");

		if (!response.results)
			throw Error("dev inspect move call returned no results");

		const returnVals = response.results[0].returnValues;
		if (!returnVals)
			throw Error("dev inspect move call had no return values");

		const bytes: Byte[] = returnVals[0][0];
		return bytes;
	};
}

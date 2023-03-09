import { MoveCallTransaction } from "@mysten/sui.js";
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

	public fetchBytesFromMoveCallTransaction = async (
		moveCallTransaction: MoveCallTransaction
	) => {
		const signer = RpcApiHelpers.constants.devInspectSigner;

		const response = await this.Provider.provider.devInspectTransaction(
			signer,
			{
				kind: "moveCall",
				data: moveCallTransaction,
			}
		);

		if (response.effects.status.status === "failure")
			throw Error("dev inspect move call failed");

		if (!("Ok" in response.results)) throw Error("move call failed");

		const returnVals = response.results.Ok[0][1].returnValues;
		if (!returnVals) throw Error("no return values");

		const bytes: Byte[] = returnVals[0][0];
		return bytes;
	};
}

import { Transaction } from "@mysten/sui/transactions";
import { AftermathApi } from "../../../general/providers";
import { Casting, Helpers } from "../../../general/utils";
import { IFixedAsString, IFixedAsStringBytes, ObjectId } from "../../../types";
import { IFixedUtils } from "../../../general/utils/iFixedUtils";

export class OracleApi {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchPrices = async (inputs: {
		priceFeedIds: ObjectId[];
	}): Promise<number[]> => {
		const prices = await this.Provider.indexerCaller.fetchIndexer<
			IFixedAsStringBytes[],
			{
				priceFeedIds: ObjectId[];
			}
		>(
			`oracle/prices`,
			{
				priceFeedIds: inputs.priceFeedIds,
			},
			undefined,
			undefined,
			undefined,
			true
		);
		return prices.map((price) =>
			Casting.IFixed.numberFromIFixed(
				Casting.IFixed.iFixedFromStringBytes(price)
			)
		);
	};
}

import {
	SuiTransactionBlockResponseQuery,
	TransactionDigest,
} from "@mysten/sui.js";
import { TransactionsWithCursor } from "../../types";
import { AftermathApi } from "../providers/aftermathApi";

export class TransactionsApiHelpers {
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

	public fetchTransactionsWithCursor = async (
		query: SuiTransactionBlockResponseQuery,
		cursor?: TransactionDigest,
		limit?: number
	): Promise<TransactionsWithCursor> => {
		const transactionsWithCursor =
			await this.Provider.provider.queryTransactionBlocks({
				...query,
				cursor,
				limit,
				options: {
					showEvents: true,
					// showBalanceChanges: true,
					// showEffects: true,
					// showObjectChanges: true
				},
			});

		return {
			transactions: transactionsWithCursor.data,
			nextCursor: transactionsWithCursor.nextCursor,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Public Static Methods
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	//// Helpers
	/////////////////////////////////////////////////////////////////////

	public static createTransactionTarget = (
		packageAddress: string,
		packageName: string,
		functionName: string
	): `${string}::${string}::${string}` =>
		`${packageAddress}::${packageName}::${functionName}`;
}

import { TransactionDigest } from "@mysten/sui.js";
import {
	TransactionDigestsWithCursor,
	TransactionsWithCursor,
} from "../../types";
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

	public fetchTransactionDigestsWithCursor = async (
		query: TransactionQuery,
		cursor?: TransactionDigest,
		limit?: number
	): Promise<TransactionDigestsWithCursor> => {
		const transactionDigestsWithCursor =
			await this.Provider.provider.getTransactions(
				query,
				cursor ?? null,
				limit ?? null
			);

		return {
			transactionDigests: transactionDigestsWithCursor.data,
			nextCursor: transactionDigestsWithCursor.nextCursor,
		};
	};

	public fetchTransactionsWithCursor = async (
		query: TransactionQuery,
		cursor?: TransactionDigest,
		limit?: number
	): Promise<TransactionsWithCursor> => {
		const transactionDigestsWithCursor =
			await this.fetchTransactionDigestsWithCursor(query, cursor, limit);

		const transactions =
			await this.Provider.provider.getTransactionWithEffectsBatch(
				transactionDigestsWithCursor.transactionDigests
			);

		return {
			transactions,
			nextCursor: transactionDigestsWithCursor.nextCursor,
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

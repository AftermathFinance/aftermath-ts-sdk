import {
	SuiAddress,
	SuiTransactionBlockResponseQuery,
	TransactionBlock,
	TransactionDigest,
	getTotalGasUsedUpperBound,
} from "@mysten/sui.js";
import { SerializedTransaction, TransactionsWithCursor } from "../../types";
import { AftermathApi } from "../providers/aftermathApi";
import { RpcApiHelpers } from "./rpcApiHelpers";

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

	public fetchSetGasBudgetForTransaction = async (
		tx: TransactionBlock
	): Promise<TransactionBlock> => {
		const sender = tx.blockData.sender;
		if (!sender) throw new Error("no sender set for transaction");

		const response =
			await this.Provider.provider.devInspectTransactionBlock({
				sender,
				transactionBlock: tx,
			});

		const gasUsed = getTotalGasUsedUpperBound(response.effects);
		if (gasUsed === undefined) throw Error("dev inspect move call failed");

		tx.setGasBudget(gasUsed);
		return tx;
	};

	public fetchSetGasBudgetAndSerializeTransaction = async (
		tx: TransactionBlock | Promise<TransactionBlock>
	): Promise<SerializedTransaction> => {
		return (
			await this.fetchSetGasBudgetForTransaction(await tx)
		).serialize();
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

	public static createOptionObject = <InnerType>(
		inner: InnerType | undefined
	): { None: true } | { Some: InnerType } =>
		inner === undefined ? { None: true } : { Some: inner };
}

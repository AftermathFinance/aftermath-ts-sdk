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
		const signer = RpcApiHelpers.constants.devInspectSigner;
		const response =
			await this.Provider.provider.devInspectTransactionBlock({
				sender: tx.blockData.sender ?? signer,
				transactionBlock: tx,
			});

		const gasUsed = getTotalGasUsedUpperBound(response.effects);
		if (gasUsed === undefined) throw Error("dev inspect move call failed");

		tx.setGasBudget(gasUsed);
		return tx;
	};

	public fetchSetGasBudgetAndSerializeTransaction = async (
		tx: TransactionBlock | Promise<TransactionBlock>,
		referrer?: SuiAddress
	): Promise<SerializedTransaction> => {
		const txBlock = await tx;

		let newTx: TransactionBlock;
		if (referrer) {
			newTx = new TransactionBlock();

			// this.Provider.ReferralVault().Helpers.addUpdateReferrerCommandToTransaction(
			// 	{
			// 		tx: newTx,
			// 		referrer,
			// 	}
			// );

			for (const command of txBlock.blockData.transactions) {
				newTx.add(command);
			}
		} else {
			newTx = txBlock;
		}

		return (await this.fetchSetGasBudgetForTransaction(newTx)).serialize();
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

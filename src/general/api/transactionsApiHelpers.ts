import {
	SuiAddress,
	SuiTransactionBlockResponseQuery,
	TransactionArgument,
	TransactionBlock,
	TransactionDigest,
	getExecutionStatusGasSummary,
	getGasData,
	getTotalGasUsedUpperBound,
} from "@mysten/sui.js";
import { SerializedTransaction, TransactionsWithCursor } from "../../types";
import { AftermathApi } from "../providers/aftermathApi";
import { RpcApiHelpers } from "./rpcApiHelpers";

export class TransactionsApiHelpers {
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

	public fetchSetGasBudgetForTx = async (
		tx: TransactionBlock
	): Promise<TransactionBlock> => {
		const [txResponse, referenceGasPrice] = await Promise.all([
			this.Provider.provider.dryRunTransactionBlock({
				transactionBlock: await tx.build({
					provider: this.Provider.provider,
				}),
			}),
			this.Provider.provider.getReferenceGasPrice(),
		]);

		const gasUsed = getTotalGasUsedUpperBound(txResponse.effects);
		if (gasUsed === undefined) throw Error("dry run move call failed");

		const safeGasBudget = gasUsed + gasUsed / BigInt(10);

		tx.setGasBudget(safeGasBudget);
		tx.setGasPrice(referenceGasPrice);
		return tx;
	};

	public fetchSetGasBudgetAndSerializeTx = async (
		tx: TransactionBlock | Promise<TransactionBlock>
	): Promise<SerializedTransaction> => {
		return (await this.fetchSetGasBudgetForTx(await tx)).serialize();
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static createTxTarget = (
		packageAddress: string,
		packageName: string,
		functionName: string
	): `${string}::${string}::${string}` =>
		`${packageAddress}::${packageName}::${functionName}`;

	public static createOptionObject = <InnerType>(
		inner: InnerType | undefined
	): { None: true } | { Some: InnerType } =>
		inner === undefined ? { None: true } : { Some: inner };

	public static creatBuildTxFunc = <Inputs>(
		func: (inputs: Inputs) => TransactionArgument
	): ((
		inputs: {
			walletAddress: SuiAddress;
		} & Omit<Inputs, "tx">
	) => TransactionBlock) => {
		const builderFunc = (
			someInputs: {
				walletAddress: SuiAddress;
			} & Omit<Inputs, "tx">
		) => {
			const tx = new TransactionBlock();
			tx.setSender(someInputs.walletAddress);

			func({
				tx,
				...someInputs,
			} as Inputs);

			return tx;
		};

		return builderFunc;
	};
}

import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import {
	Balance,
	CoinType,
	ObjectId,
	SerializedTransaction,
	SuiAddress,
	TransactionDigest,
	TransactionsWithCursor,
} from "../../types";
import { AftermathApi } from "../providers/aftermathApi";
import { SuiTransactionBlockResponseQuery } from "@mysten/sui.js/client";

export class TransactionsApiHelpers {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
		this.Provider = Provider;
	}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	public fetchTransactionsWithCursor = async (inputs: {
		query: SuiTransactionBlockResponseQuery;
		cursor?: TransactionDigest;
		limit?: number;
	}): Promise<TransactionsWithCursor> => {
		const { query, cursor, limit } = inputs;

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
			nextCursor: transactionsWithCursor.nextCursor ?? null,
		};
	};

	public fetchSetGasBudgetForTx = async (inputs: {
		tx: TransactionBlock;
		gasCoinType?: CoinType;
	}): Promise<TransactionBlock> => {
		const { tx, gasCoinType } = inputs;

		if (
			!gasCoinType
			// || Helpers.addLeadingZeroesToType(gasCoinType) ===
			// 	Coin.constants.suiCoinType
		) {
			// using sui as gas

			const [txResponse, referenceGasPrice] = await Promise.all([
				this.Provider.provider.dryRunTransactionBlock({
					transactionBlock: await tx.build({
						provider: this.Provider.provider,
					}),
				}),
				this.Provider.provider.getReferenceGasPrice(),
			]);

			const gasData = txResponse.effects.gasUsed;
			const gasUsed =
				BigInt(gasData.computationCost) + BigInt(gasData.storageCost);
			// scale up by 10% for safety margin
			const safeGasBudget = gasUsed + gasUsed / BigInt(10);

			tx.setGasBudget(safeGasBudget);
			tx.setGasPrice(referenceGasPrice);
			return tx;
		} else {
			// using non-sui as gas (dynamic gas)
			// if (!tx.blockData.sender)
			// 	throw new Error(
			// 		"unable to set dynamic gas budget with no sender set on tx"
			// 	);
			// const allGasCoins = await this.Provider.Coin().fetchAllCoins({
			// 	walletAddress: tx.blockData.sender,
			// 	coinType: gasCoinType,
			// });
			// const gasCoinIds = allGasCoins.map((coin) => coin.coinObjectId);
			return tx;
		}
	};

	public fetchSetGasBudgetAndSerializeTx = async (inputs: {
		tx: TransactionBlock | Promise<TransactionBlock>;
	}): Promise<SerializedTransaction> => {
		return (
			await this.fetchSetGasBudgetForTx({ tx: await inputs.tx })
		).serialize();
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

	public static createBuildTxFunc = <Inputs>(
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

	public static splitCoinsTx(inputs: {
		tx: TransactionBlock;
		coinType: CoinType;
		// coinId: TransactionArgument | ObjectId;
		coinId: ObjectId;
		amounts: TransactionArgument[] | Balance[];
	}) {
		const { tx, coinType, coinId, amounts } = inputs;
		return tx.moveCall({
			target: this.createTxTarget(
				// Sui.constants.addresses.suiPackageId,
				"0x2",
				"pay",
				"split_vec"
			),
			typeArguments: [coinType],
			arguments: [
				typeof coinId === "string" ? tx.object(coinId) : coinId, // Coin,
				tx.pure(amounts, "vector<u64>"), // split_amounts
			],
		});
	}

	// public static mergeCoinsTx(inputs: {
	// 	tx: TransactionBlock;
	// 	coinType: CoinType;
	// 	destinationCoinId: TransactionArgument | string;
	// 	sources: TransactionArgument[] | ObjectId[];
	// }) {
	// 	const { tx, coinType, destinationCoinId, sources } = inputs;

	// 	// TODO: clean this up
	// 	const coinVec =
	// 		typeof sources[0] === "string"
	// 			? tx.makeMoveVec({
	// 					objects: sources.map((source) =>
	// 						tx.object(source as ObjectId)
	// 					),
	// 					type: `Coin<${coinType}>`,
	// 			  })
	// 			: sources;
	// 	return tx.moveCall({
	// 		target: this.createTxTarget(
	// 			Sui.constants.addresses.suiPackageId,
	// 			"pay",
	// 			"join_vec"
	// 		),
	// 		typeArguments: [coinType],
	// 		arguments: [
	// 			typeof destinationCoinId === "string"
	// 				? tx.object(destinationCoinId)
	// 				: destinationCoinId, // Coin,

	// 			// TODO: clean this up
	// 			// @ts-ignore
	// 			coinVec, // coins
	// 		],
	// 	});
	// }
}

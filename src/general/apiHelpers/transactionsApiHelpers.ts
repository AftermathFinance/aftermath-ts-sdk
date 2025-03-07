import {
	TransactionArgument,
	Transaction,
	TransactionObjectArgument,
	Argument,
	isTransaction,
} from "@mysten/sui/transactions";
import {
	Balance,
	CoinTransactionObjectArgumentV0,
	CoinType,
	ObjectId,
	SerializedTransaction,
	ServiceCoinData,
	ServiceCoinDataV2,
	SuiAddress,
	TransactionDigest,
	TransactionsWithCursor,
} from "../../types";
import { AftermathApi } from "../providers/aftermathApi";
import { SuiTransactionBlockResponseQuery } from "@mysten/sui/client";
import { Helpers } from "../utils";
import {
	TransactionBlock,
	TransactionObjectArgument as TransactionObjectArgumentV0,
	TransactionArgument as TransactionArgumentV0,
} from "@mysten/sui.js/transactions";

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
					showBalanceChanges: true,
					showEffects: true,
					showObjectChanges: true,
					showInput: true,
				},
			});

		return {
			transactions: transactionsWithCursor.data,
			nextCursor: transactionsWithCursor.nextCursor ?? null,
		};
	};

	public fetchSetGasBudgetForTx = async (inputs: {
		tx: Transaction;
	}): Promise<Transaction> => {
		const { tx } = inputs;

		const [txResponse, referenceGasPrice] = await Promise.all([
			this.Provider.provider.dryRunTransactionBlock({
				transactionBlock: await tx.build({
					client: this.Provider.provider,
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
	};

	public fetchSetGasBudgetForTxV0 = async (inputs: {
		tx: TransactionBlock;
	}): Promise<TransactionBlock> => {
		const { tx } = inputs;

		const [txResponse, referenceGasPrice] = await Promise.all([
			this.Provider.providerV0?.dryRunTransactionBlock({
				transactionBlock: await tx.build({
					client: this.Provider.providerV0,
				}),
			}),
			this.Provider.provider.getReferenceGasPrice(),
		]);

		const gasUsed = !txResponse
			? // TODO: make this into larger val
			  BigInt(0)
			: (() => {
					const gasData = txResponse.effects.gasUsed;
					return (
						BigInt(gasData.computationCost) +
						BigInt(gasData.storageCost)
					);
			  })();

		// scale up by 10% for safety margin
		const safeGasBudget = gasUsed + gasUsed / BigInt(10);

		tx.setGasBudget(safeGasBudget);
		tx.setGasPrice(referenceGasPrice);
		return tx;
	};

	public fetchSetGasBudgetAndSerializeTx = async (inputs: {
		tx: Transaction | Promise<Transaction>;
		isSponsoredTx?: boolean;
	}): Promise<SerializedTransaction> => {
		const { tx, isSponsoredTx } = inputs;

		if (isSponsoredTx) return (await tx).serialize();

		return (
			await this.fetchSetGasBudgetForTx({ tx: await tx })
		).serialize();
	};

	public fetchSetGasBudgetAndSerializeTxV0 = async (inputs: {
		tx: TransactionBlock | Promise<TransactionBlock>;
		isSponsoredTx?: boolean;
	}): Promise<SerializedTransaction> => {
		const { tx, isSponsoredTx } = inputs;

		if (isSponsoredTx) return (await tx).serialize();

		return (
			await this.fetchSetGasBudgetForTxV0({ tx: await tx })
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

	public static createBuildTxFunc = <Inputs>(
		func: (inputs: Inputs) => TransactionArgument
	): ((
		inputs: {
			walletAddress: SuiAddress;
		} & Omit<Inputs, "tx">
	) => Transaction) => {
		const builderFunc = (
			someInputs: {
				walletAddress: SuiAddress;
			} & Omit<Inputs, "tx">
		) => {
			const tx = new Transaction();
			tx.setSender(someInputs.walletAddress);

			func({
				tx,
				...someInputs,
			} as Inputs);

			return tx;
		};

		return builderFunc;
	};

	public static splitCoinTx(inputs: {
		tx: Transaction | TransactionBlock;
		coinType: CoinType;
		// coinId: TransactionArgument | ObjectId;
		coinId: ObjectId;
		amount: Balance;
	}) {
		const { tx, coinType, coinId, amount } = inputs;
		return tx.moveCall({
			target: this.createTxTarget(
				// Sui.constants.addresses.suiPackageId,
				"0x2",
				"coin",
				"split"
			),
			typeArguments: [coinType],
			arguments: [
				typeof coinId === "string" ? tx.object(coinId) : coinId, // Coin,
				tx.pure.u64(amount), // split_amount
			],
		});
	}

	public static serviceCoinDataFromCoinTxArg = (inputs: {
		coinTxArg: TransactionObjectArgument | Argument | ObjectId;
	}): ServiceCoinData => {
		const { coinTxArg } = inputs;

		if (typeof coinTxArg === "string")
			return { Coin: Helpers.addLeadingZeroesToType(coinTxArg) };

		if (!("$kind" in coinTxArg)) {
			if (typeof coinTxArg === "function" || "GasCoin" in coinTxArg)
				throw new Error(
					"unable to convert gas coin arg to service coin data"
				);
			// Input
			return coinTxArg;
		}

		if (coinTxArg.$kind === "NestedResult")
			return {
				[coinTxArg.$kind]: coinTxArg.NestedResult,
			};

		if (coinTxArg.$kind === "Result")
			return { [coinTxArg.$kind]: coinTxArg.Result };

		if (coinTxArg.$kind === "GasCoin")
			throw new Error(
				"unable to convert gas coin arg to service coin data"
			);

		// Input
		return { [coinTxArg.$kind]: coinTxArg.Input };
	};

	public static serviceCoinDataV2FromCoinTxArg = (inputs: {
		coinTxArg: TransactionObjectArgument | Argument;
	}): ServiceCoinDataV2 => {
		const { coinTxArg } = inputs;

		if (!("$kind" in coinTxArg)) {
			if ("Result" in coinTxArg) return { result: coinTxArg.Result };

			if ("NestedResult" in coinTxArg)
				return { result: coinTxArg.NestedResult };

			if ("GasCoin" in coinTxArg) return "gas";

			if ("Input" in coinTxArg) return { input: coinTxArg.Input };

			// TODO: handle this case better
			throw new Error(`coinTxArg in format ${coinTxArg} not supported`);
		}

		if (coinTxArg.$kind === "NestedResult")
			return {
				result: coinTxArg.NestedResult,
			};

		if (coinTxArg.$kind === "Result") return { result: coinTxArg.Result };

		if (coinTxArg.$kind === "GasCoin") return "gas";

		// Input
		return { input: coinTxArg.Input };
	};

	public static serviceCoinDataFromCoinTxArgV0 = (inputs: {
		coinTxArg: CoinTransactionObjectArgumentV0 | ObjectId;
	}): ServiceCoinData => {
		const { coinTxArg } = inputs;

		// TODO: handle gas coin

		if (typeof coinTxArg === "string")
			return { Coin: Helpers.addLeadingZeroesToType(coinTxArg) };

		if (coinTxArg.kind === "NestedResult")
			return {
				[coinTxArg.kind]: [coinTxArg.index, coinTxArg.resultIndex],
			};

		if (coinTxArg.kind === "Result")
			return { [coinTxArg.kind]: coinTxArg.index };

		// Input
		return { [coinTxArg.kind]: coinTxArg.index };
	};

	public static serviceCoinDataV2FromCoinTxArgV0 = (inputs: {
		coinTxArg: CoinTransactionObjectArgumentV0 | ObjectId;
	}): ServiceCoinDataV2 => {
		const { coinTxArg } = inputs;

		// TODO: handle gas coin

		if (typeof coinTxArg === "string")
			// TODO: handle this case better
			throw new Error(`coinTxArg in format ${coinTxArg} not supported`);

		if (coinTxArg.kind === "NestedResult")
			return {
				result: [coinTxArg.index, coinTxArg.resultIndex],
			};

		if (coinTxArg.kind === "Result") return { result: coinTxArg.index };

		// Input
		return { input: coinTxArg.index };
	};

	public static coinTxArgFromServiceCoinData = (inputs: {
		serviceCoinData: ServiceCoinData;
	}): TransactionObjectArgument => {
		const { serviceCoinData } = inputs;

		const key = Object.keys(serviceCoinData)[0];

		// TODO: handle all cases
		if (key === "Coin")
			throw new Error(
				"serviceCoinData in format { Coin: ObjectId } not supported"
			);

		// TODO: handle this cleaner
		const kind = key as "Input" | "NestedResult" | "Result";

		if (kind === "NestedResult") {
			return {
				NestedResult: Object.values(serviceCoinData)[0],
			};
		}
		if (kind === "Input") {
			return {
				Input: Object.values(serviceCoinData)[0],
			};
		}
		return {
			Result: Object.values(serviceCoinData)[0],
		};
	};

	public static coinTxArgFromServiceCoinDataV2 = (inputs: {
		serviceCoinDataV2: ServiceCoinDataV2;
	}): TransactionObjectArgument => {
		const { serviceCoinDataV2 } = inputs;

		if (typeof serviceCoinDataV2 === "string") {
			return { GasCoin: true };
		}

		const key = Object.keys(serviceCoinDataV2)[0];
		const value: number | [number, number] =
			Object.values(serviceCoinDataV2)[0];

		// TODO: handle this cleaner ?
		const kind = key as "input" | "result";

		if (kind === "result") {
			if (typeof value === "number") {
				return {
					Result: value,
				};
			}
			return {
				NestedResult: value,
			};
		}
		if (kind === "input" && typeof value === "number") {
			return {
				Input: value,
			};
		}

		throw new Error(
			`serviceCoinDataV2 format ${JSON.stringify(
				serviceCoinDataV2
			)} not supported`
		);
	};

	public static coinTxArgFromServiceCoinDataV0 = (inputs: {
		serviceCoinData: ServiceCoinData;
	}): CoinTransactionObjectArgumentV0 => {
		const { serviceCoinData } = inputs;

		const key = Object.keys(serviceCoinData)[0];

		// TODO: handle all cases
		if (key === "Coin")
			throw new Error(
				"serviceCoinData in format { Coin: ObjectId } not supported"
			);

		// TODO: handle this cleaner
		const kind = key as "Input" | "NestedResult" | "Result";

		if (kind === "NestedResult") {
			return {
				kind,
				index: Object.values(serviceCoinData)[0][0],
				resultIndex: Object.values(serviceCoinData)[0][1],
			};
		}
		return {
			kind,
			index: Object.values(serviceCoinData)[0],
		};
	};

	public static coinTxArgFromServiceCoinDataV2V0 = (inputs: {
		serviceCoinDataV2: ServiceCoinDataV2;
	}): CoinTransactionObjectArgumentV0 => {
		const { serviceCoinDataV2 } = inputs;

		if (typeof serviceCoinDataV2 === "string") {
			throw new Error(
				`serviceCoinDataV2 format ${JSON.stringify(
					serviceCoinDataV2
				)} not supported`
			);
		}

		const key = Object.keys(serviceCoinDataV2)[0];
		const value: number | [number, number] =
			Object.values(serviceCoinDataV2)[0];

		// TODO: handle this cleaner ?
		const kind = key as "input" | "result";

		if (kind === "result") {
			if (typeof value === "number") {
				return {
					kind: "Result",
					index: value,
				};
			}
			return {
				kind: "NestedResult",
				index: value[0],
				resultIndex: value[1],
			};
		}
		if (kind === "input" && typeof value === "number") {
			return {
				kind: "Input",
				index: value,
			};
		}

		throw new Error(
			`serviceCoinDataV2 format ${JSON.stringify(
				serviceCoinDataV2
			)} not supported`
		);
	};

	// public static mergeCoinsTx(inputs: {
	// 	tx: Transaction;
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

	public static transferTxMetadata = (inputs: {
		initTx: Transaction;
		newTx: Transaction;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.getData().sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.getData().expiration;
		if (expiration) newTx.setExpiration(expiration);

		const gasData = initTx.getData().gasData;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment) newTx.setGasPayment(gasData.payment);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);
	};

	public static transferTxMetadataV0 = (inputs: {
		initTx: TransactionBlock;
		newTx: TransactionBlock;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.blockData.sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.blockData.expiration;
		if (expiration && !("None" in expiration && expiration.None === null))
			// @ts-ignore
			newTx.setExpiration(expiration);

		const gasData = initTx.blockData.gasConfig;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment)
			newTx.setGasPayment(
				gasData.payment.map((payment) => ({
					...payment,
					version:
						typeof payment.version === "bigint"
							? Number(payment.version)
							: payment.version,
				}))
			);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);
	};
}

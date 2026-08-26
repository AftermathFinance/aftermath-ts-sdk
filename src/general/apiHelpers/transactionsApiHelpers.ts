import type { SuiTransactionBlockResponseQuery } from "@mysten/sui/jsonRpc";
import {
	type Argument,
	Transaction,
	type TransactionArgument,
	type TransactionObjectArgument,
} from "@mysten/sui/transactions";
import type {
	Balance,
	CoinType,
	ObjectId,
	SerializedTransaction,
	ServiceCoinData,
	ServiceCoinDataV2,
	SuiAddress,
	TransactionDigest,
	TransactionsWithCursor,
} from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting } from "../utils/grpcCasting";
import { Helpers } from "../utils/helpers";

/**
 * Queries transaction history and builds or converts Sui transaction data.
 *
 * Transaction history still uses the optional JSON-RPC client. Gas estimation
 * uses the configured gRPC client and reference gas price. Static conversion
 * and transaction-builder methods run locally and do not perform network I/O.
 */
export class TransactionsApiHelpers {
	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates a transaction helper for a configured `AftermathApi`.
	 *
	 * @param api - The API instance used by history queries and gas estimation.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	/**
	 * Fetches one page of transaction history and returns the next digest cursor.
	 *
	 * This method performs network I/O through the optional JSON-RPC client. It
	 * requests input, effects, events, balance changes, and object changes for
	 * every returned transaction. The gRPC client has no equivalent for this
	 * query, so callers must configure `AftermathApi.jsonRpcClient`.
	 *
	 * @remarks **Remaining JSON-RPC surface.** `suix_queryTransactionBlocks` has
	 * no gRPC equivalent — Sui's own migration cookbook directs callers to
	 * GraphQL or an indexer — so this helper still goes through
	 * {@link AftermathApi.jsonRpcClient} and will stop working when JSON-RPC is
	 * removed from fullnodes (scheduled for mid-October 2026). Prefer the
	 * Aftermath API's transaction-history endpoints.
	 *
	 * @throws If no `jsonRpcClient` was passed to {@link AftermathApi}, since it
	 * is optional there.
	 * @param inputs - The JSON-RPC transaction query, optional transaction digest
	 * cursor, and page limit. The cursor is the last digest from the previous
	 * page.
	 * @returns The transaction responses and `nextCursor`. `nextCursor` is
	 * `null` when no later page is available.
	 * @throws If the JSON-RPC client is missing or the request fails.
	 */
	public fetchTransactionsWithCursor = async (inputs: {
		query: SuiTransactionBlockResponseQuery;
		cursor?: TransactionDigest;
		limit?: number;
	}): Promise<TransactionsWithCursor> => {
		const { query, cursor, limit } = inputs;

		const jsonRpcClient = this.api.requireJsonRpcClient(
			"Transactions().fetchTransactionsWithCursor"
		);

		const transactionsWithCursor =
			await jsonRpcClient.queryTransactionBlocks({
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

	/**
	 * Estimates gas with gRPC simulation and applies a safe budget and reference
	 * gas price to a transaction.
	 *
	 * This method performs two gRPC requests: it simulates the built transaction
	 * and reads the current reference gas price. The budget is the simulation's
	 * computation cost plus storage cost, increased by 10% with integer division.
	 * Storage rebate and non-refundable storage fee are not included. The method
	 * sets both values as `bigint` on the original transaction and returns that
	 * same transaction object. Failed simulations can still provide effects and
	 * are used for the gas estimate.
	 *
	 * @param inputs - The transaction to build and update. The transaction must
	 * contain enough information for `tx.build` to resolve its inputs.
	 * @returns The same transaction after `setGasBudget` and `setGasPrice` run.
	 * @throws Errors from transaction building, gRPC simulation, reference gas
	 * price lookup, or missing gas-effect data.
	 */
	public fetchSetGasBudgetForTx = async (inputs: {
		tx: Transaction;
	}): Promise<Transaction> => {
		const { tx } = inputs;

		// @dev: `dryRunTransactionBlock` -> `simulateTransaction`. Verified live
		// that the two return identical `gasUsed`
		// (`{computationCost, storageCost, storageRebate,
		// nonRefundableStorageFee}` as decimal strings).
		const [simulation, { referenceGasPrice }] = await Promise.all([
			this.api.client.simulateTransaction({
				transaction: await tx.build({
					client: this.api.client,
				}),
				include: { effects: true },
			}),
			this.api.client.getReferenceGasPrice(),
		]);

		// @dev: a simulation that fails on-chain still carries effects, but under
		// the `FailedTransaction` arm of the `$kind` union. Reading only
		// `result.Transaction` would silently drop the gas estimate exactly when
		// the caller needs it most.
		const { effects } = GrpcCasting.transactionFromResult(simulation);

		const gasData = effects.gasUsed;
		const gasUsed =
			BigInt(gasData.computationCost) + BigInt(gasData.storageCost);

		// scale up by 10% for safety margin
		const safeGasBudget = gasUsed + gasUsed / BigInt(10);

		tx.setGasBudget(safeGasBudget);
		// @dev: gRPC nests this under `referenceGasPrice`; JSON-RPC returned a bare
		// decimal string.
		tx.setGasPrice(BigInt(referenceGasPrice));
		return tx;
	};

	/**
	 * Serializes a transaction, estimating gas unless it is already sponsored.
	 *
	 * A sponsored transaction is serialized locally with `toJSON()` and does not
	 * call the gRPC client. An unsponsored transaction performs the same gRPC gas
	 * simulation and reference-price lookup as `fetchSetGasBudgetForTx` before
	 * serialization. The input may be an existing transaction or a promise for
	 * one.
	 *
	 * @param inputs - The transaction or transaction promise and the sponsorship
	 * flag. Set `isSponsoredTx` to `true` only when gas has already been supplied
	 * by the sponsor.
	 * @returns The serialized transaction string produced by `toJSON()`.
	 * @throws Errors from the transaction promise, gas estimation, or
	 * serialization.
	 */
	public fetchSetGasBudgetAndSerializeTx = async (inputs: {
		tx: Transaction | Promise<Transaction>;
		isSponsoredTx?: boolean;
	}): Promise<SerializedTransaction> => {
		const { tx, isSponsoredTx } = inputs;

		if (isSponsoredTx) {
			return (await tx).toJSON();
		}

		return (await this.fetchSetGasBudgetForTx({ tx: await tx })).toJSON();
	};

	/**
	 * Builds the transaction kind and encodes its bytes as base64.
	 *
	 * This helper performs no direct network request. It asks the Sui transaction
	 * builder for `onlyTransactionKind: true`, using the configured gRPC client
	 * as the builder client when input resolution requires it. An absent
	 * transaction is treated as no work and returns `undefined`.
	 *
	 * @param inputs - The transaction to build, or `undefined`.
	 * @returns Base64 transaction-kind bytes, or `undefined` when `tx` is absent.
	 * @throws Errors from the Sui transaction builder.
	 */
	public fetchBase64TxKindFromTx = async (inputs: {
		tx: Transaction | undefined;
	}): Promise<SerializedTransaction | undefined> => {
		const { tx } = inputs;

		if (!tx) {
			return;
		}

		const txBytes = await tx.build({
			client: this.api?.client,
			onlyTransactionKind: true,
		});

		return Buffer.from(txBytes).toString("base64");
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	/**
	 * Builds a fully qualified Move call target.
	 *
	 * This is a local string operation and performs no network I/O. It does not
	 * validate the address, module, or function segments.
	 *
	 * @param packageAddress - The published package address.
	 * @param packageName - The Move module name.
	 * @param functionName - The Move function name.
	 * @returns A string in the form `packageAddress::packageName::functionName`.
	 */
	public static createTxTarget = (
		packageAddress: string,
		packageName: string,
		functionName: string
	): `${string}::${string}::${string}` =>
		`${packageAddress}::${packageName}::${functionName}`;

	/**
	 * Creates a transaction-builder function with a fixed sender input.
	 *
	 * This factory performs no network I/O. Each returned function creates a new
	 * `Transaction`, sets its sender to `walletAddress`, and invokes `func` with
	 * the new transaction plus the remaining inputs. `func` must add commands to
	 * `inputs.tx`; its returned `TransactionArgument` is ignored.
	 *
	 * @example
	 * ```typescript
	 * import { AftermathApi } from "aftermath-ts-sdk";
	 * import type { Transaction } from "@mysten/sui/transactions";
	 *
	 * const build = AftermathApi.helpers.transactions.createBuildTxFunc(
	 *	(inputs: { tx: Transaction; walletAddress: string; amount: bigint }) => {
	 *		const amount = inputs.tx.pure.u64(inputs.amount);
	 *		inputs.tx.moveCall({
	 *			target: "0x2::example::use_amount",
	 *			arguments: [amount],
	 *		});
	 *		return amount;
	 *	}
	 * );
	 * const tx = build({
	 *	walletAddress: "0x0000000000000000000000000000000000000000000000000000000000000001",
	 *	amount: 10n,
	 * });
	 * ```
	 *
	 * @param func - The callback that receives the new transaction and inputs.
	 * @returns A function that builds a new transaction with the supplied sender.
	 */
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

	/**
	 * Adds a Sui coin-split Move call to a transaction.
	 *
	 * This is a local transaction builder and performs no network I/O. It adds
	 * `0x2::coin::split<CoinType>` to `tx`, using `coinId` as the source coin and
	 * `amount` as a `u64` in the coin's smallest on-chain unit. The transaction is
	 * mutated in place and still needs gas, signing, and execution by the caller.
	 *
	 * @param inputs - The transaction, coin Move type, source coin object ID, and
	 * amount in the coin's smallest unit.
	 * @returns The transaction argument returned by `moveCall`.
	 * @throws Errors from the Sui transaction builder.
	 */
	public static splitCoinTx(inputs: {
		tx: Transaction;
		coinType: CoinType;
		// coinId: TransactionArgument | ObjectId;
		coinId: ObjectId;
		amount: Balance;
	}) {
		const { tx, coinType, coinId, amount } = inputs;
		return tx.moveCall({
			target: TransactionsApiHelpers.createTxTarget(
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

	/**
	 * Converts a Sui coin transaction argument to the service coin-data shape.
	 *
	 * This is a local conversion and performs no network I/O. Object or type
	 * strings are normalized with 64-hex-digit leading zeroes. Input, result,
	 * and nested-result arguments keep their indices. Gas coin arguments cannot
	 * be represented by `ServiceCoinData` and throw instead.
	 *
	 * @param inputs - The object ID or transaction argument to convert.
	 * @returns A `ServiceCoinData` object with `Coin`, `Input`, `Result`, or
	 * `NestedResult`.
	 * @throws An `Error` for gas coins and unsupported argument kinds.
	 */
	public static serviceCoinDataFromCoinTxArg = (inputs: {
		coinTxArg: TransactionObjectArgument | Argument | ObjectId;
	}): ServiceCoinData => {
		const { coinTxArg } = inputs;

		if (typeof coinTxArg === "string") {
			return { Coin: Helpers.addLeadingZeroesToType(coinTxArg) };
		}

		if (!("$kind" in coinTxArg)) {
			if (typeof coinTxArg === "function" || "GasCoin" in coinTxArg) {
				throw new Error("unable to convert gas coin arg to service coin data");
			}
			// Input
			return coinTxArg;
		}

		if (coinTxArg.$kind === "NestedResult") {
			return {
				[coinTxArg.$kind]: coinTxArg.NestedResult,
			};
		}

		if (coinTxArg.$kind === "Result") {
			return { [coinTxArg.$kind]: coinTxArg.Result };
		}

		if (coinTxArg.$kind === "GasCoin") {
			throw new Error("unable to convert gas coin arg to service coin data");
		}

		if (coinTxArg.$kind === "Input") {
			return { Input: coinTxArg.Input };
		}

		throw new Error(`unexpected coinTxArg.$kind: ${coinTxArg.$kind}`);
	};

	/**
	 * Converts a Sui coin transaction argument to the legacy V2 service shape.
	 *
	 * This is a local conversion and performs no network I/O. Input, result, and
	 * nested-result indices are preserved. A gas coin is represented by the
	 * string `"Gas"`; this V2 shape does not accept an object ID string.
	 *
	 * @param inputs - The transaction argument to convert.
	 * @returns `"Gas"`, or an `Input`, `Result`, or `NestedResult` object.
	 * @throws An `Error` when the argument uses an unsupported shape or kind.
	 */
	public static serviceCoinDataV2FromCoinTxArg = (inputs: {
		coinTxArg: TransactionObjectArgument | Argument;
	}): ServiceCoinDataV2 => {
		const { coinTxArg } = inputs;

		if (!("$kind" in coinTxArg)) {
			if ("Result" in coinTxArg) {
				return { Result: coinTxArg.Result };
			}

			if ("NestedResult" in coinTxArg) {
				return { NestedResult: coinTxArg.NestedResult };
			}

			if ("GasCoin" in coinTxArg) {
				return "Gas";
			}

			if ("Input" in coinTxArg) {
				return { Input: coinTxArg.Input };
			}

			// TODO: handle this case better
			throw new Error(`coinTxArg in format ${coinTxArg} not supported`);
		}

		if (coinTxArg.$kind === "NestedResult") {
			return {
				NestedResult: coinTxArg.NestedResult,
			};
		}

		if (coinTxArg.$kind === "Result") {
			return { Result: coinTxArg.Result };
		}

		if (coinTxArg.$kind === "GasCoin") {
			return "Gas";
		}

		if (coinTxArg.$kind === "Input") {
			return { Input: coinTxArg.Input };
		}

		throw new Error(`unexpected coinTxArg.$kind: ${coinTxArg.$kind}`);
	};

	/**
	 * Converts service coin data back to a Sui transaction object argument.
	 *
	 * This is a local conversion and performs no network I/O. `Input`, `Result`,
	 * and `NestedResult` forms are supported. The `{ Coin: ObjectId }` form is
	 * intentionally unsupported by this converter and throws an error.
	 *
	 * @param inputs - The service coin-data value to convert.
	 * @returns A Sui transaction object argument.
	 * @throws An `Error` when the value uses the unsupported `Coin` form.
	 */
	public static coinTxArgFromServiceCoinData = (inputs: {
		serviceCoinData: ServiceCoinData;
	}): TransactionObjectArgument => {
		const { serviceCoinData } = inputs;

		const key = Object.keys(serviceCoinData)[0];

		// TODO: handle all cases
		if (key === "Coin") {
			throw new Error(
				"serviceCoinData in format { Coin: ObjectId } not supported"
			);
		}

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

	/**
	 * Converts legacy V2 service coin data back to a Sui transaction argument.
	 *
	 * This is a local conversion and performs no network I/O. `"Gas"` becomes
	 * `{ GasCoin: true }`; indexed input, result, and nested-result forms keep
	 * their numeric indices. The value type must match its key.
	 *
	 * @param inputs - The legacy service coin-data value to convert.
	 * @returns A Sui transaction object argument.
	 * @throws An `Error` when the key and index shape are unsupported or do not
	 * match.
	 */
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
		const kind = key as "Input" | "Result" | "NestedResult";

		if (kind === "Result" && typeof value === "number") {
			return {
				Result: value,
			};
		}
		if (kind === "NestedResult" && typeof value !== "number") {
			return {
				NestedResult: value,
			};
		}
		if (kind === "Input" && typeof value === "number") {
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
	// 			// @ts-expect-error
	// 			coinVec, // coins
	// 		],
	// 	});
	// }

	/**
	 * Copies sender, expiration, and gas metadata from one transaction to another.
	 *
	 * This is a local transaction operation and performs no network I/O. It
	 * copies `sender`, `expiration`, `gasData.owner`, `gasData.payment`, and gas
	 * values when they are `bigint`. String gas budget and price values are
	 * skipped because the transaction setters require numeric values here. Fields
	 * absent from `initTx` are not cleared from `newTx`.
	 *
	 * @param inputs - The source transaction and the transaction to update.
	 * @returns Nothing. `newTx` is mutated in place.
	 * @throws Errors from the destination transaction setters.
	 */
	public static transferTxMetadata = (inputs: {
		initTx: Transaction;
		newTx: Transaction;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.getData().sender;
		if (sender) {
			newTx.setSender(sender);
		}

		const expiration = initTx.getData().expiration;
		if (expiration) {
			newTx.setExpiration(expiration);
		}

		const gasData = initTx.getData().gasData;

		if (gasData.budget && typeof gasData.budget !== "string") {
			newTx.setGasBudget(gasData.budget);
		}

		if (gasData.owner) {
			newTx.setGasOwner(gasData.owner);
		}

		if (gasData.payment) {
			newTx.setGasPayment(gasData.payment);
		}

		if (gasData.price && typeof gasData.price !== "string") {
			newTx.setGasPrice(gasData.price);
		}
	};
}

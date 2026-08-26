import type { SuiClientTypes } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { Byte, SuiAddress } from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting } from "../utils/grpcCasting";

/**
 * Simulates transactions with the configured Sui gRPC client and exposes
 * command return values as byte arrays.
 *
 * These helpers perform network I/O through `simulateTransaction`. They use
 * gRPC response types and do not require the optional JSON-RPC client.
 */
export class InspectionsApiHelpers {
	/**
	 * Default signer used when an inspection input does not provide a sender.
	 */
	public static constants = {
		/** Sender assigned to a cloned transaction for default simulations. */
		devInspectSigner:
			"0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5",
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an inspection helper for a configured `AftermathApi`.
	 *
	 * @param api - The API instance whose gRPC client runs simulations.
	 */
	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// TODO: replace all bytes types with uint8array type

	/**
	 * Simulates a transaction and returns the first returned byte value from its
	 * last command.
	 *
	 * The method performs gRPC network I/O and uses `sender` as the simulation
	 * sender. When `sender` is omitted, it uses
	 * `InspectionsApiHelpers.constants.devInspectSigner`. The transaction is
	 * cloned before the sender is set, so the input transaction is not modified.
	 *
	 * @param inputs - The transaction and optional Sui sender address.
	 * @returns The first BCS return value from the last command, represented as a
	 * number array whose entries are bytes from 0 through 255. A simulation with
	 * an empty `commandResults` array has no last command and yields no value.
	 * @throws An `Error` when simulation fails or returns no command results.
	 */
	public fetchFirstBytesFromTxOutput = async (inputs: {
		tx: Transaction;
		sender?: SuiAddress;
	}) => {
		return (await this.fetchAllBytesFromTxOutput(inputs))[0];
	};

	/**
	 * Simulates a transaction and returns all returned byte values from its last
	 * command.
	 *
	 * The method performs gRPC network I/O and uses the optional `sender`, or
	 * `InspectionsApiHelpers.constants.devInspectSigner` when it is omitted. The
	 * transaction is cloned before simulation. Each inner array is one BCS return
	 * value, and each number is a byte from 0 through 255.
	 *
	 * @param inputs - The transaction and optional Sui sender address.
	 * @returns The last command's returned BCS values. A simulation with an empty
	 * `commandResults` array has no last command and yields no value.
	 * @throws An `Error` when simulation fails or returns no command results.
	 */
	public fetchAllBytesFromTxOutput = async (inputs: {
		tx: Transaction;
		sender?: SuiAddress;
	}): Promise<Byte[][]> => {
		const { allBytes } = await this.fetchAllBytesFromTx(inputs);
		return allBytes[allBytes.length - 1];
	};

	/**
	 * Simulates `tx` and returns the BCS bytes each command returned.
	 *
	 * @remarks Ported from JSON-RPC's `devInspectTransactionBlock` to gRPC's
	 * `simulateTransaction`. Three things differ:
	 * - the sender is taken from the transaction (`tx.setSenderIfNotSet`), not
	 *   passed as a separate option;
	 * - `checksEnabled: false` is what makes inspecting non-entry / non-public
	 *   Move functions possible (with checks on, the node rejects an unsigned
	 *   transaction touching objects the sender does not own);
	 * - return values arrive as `commandResults[i].returnValues[j].bcs`
	 *   (`Uint8Array`) instead of JSON-RPC's `[number[], type]` tuples. Note
	 *   `commandResults` is requested **inside** `include`.
	 *
	 * `events` and `effects` are now gRPC-shaped (`SuiClientTypes.Event` /
	 * `SuiClientTypes.TransactionEffects`) rather than the JSON-RPC types — a
	 * `success: boolean` status instead of `status: "success" | "failure"`, and
	 * BCS bytes rather than `parsedJson` on events. Nothing in this SDK reads
	 * either field.
	 *
	 * The method performs network I/O through the configured gRPC client. It
	 * clones `tx` before assigning the sender, so the caller's transaction keeps
	 * its original sender. `allBytes[commandIndex][returnValueIndex]` is a byte
	 * array containing the BCS value returned by that command.
	 *
	 * @param inputs - The transaction and optional Sui sender address. When the
	 * sender is omitted, the fixed inspection signer in `constants` is used.
	 * @returns gRPC events, transaction effects, and BCS return bytes for every
	 * command.
	 * @throws An `Error` with the simulation status message when the simulation
	 * fails, or when the response has no `commandResults`.
	 */
	public fetchAllBytesFromTx = async (inputs: {
		tx: Transaction;
		sender?: SuiAddress;
	}): Promise<{
		events: SuiClientTypes.Event[];
		effects: SuiClientTypes.TransactionEffects;
		allBytes: Byte[][][];
	}> => {
		const sender =
			inputs.sender ?? InspectionsApiHelpers.constants.devInspectSigner;

		// @dev: gRPC takes the sender off the transaction, so it has to be set —
		// but `devInspectTransactionBlock` took it as a separate option and left
		// the caller's transaction untouched. Clone before setting it so a caller
		// that later executes the same transaction does not inherit the
		// dev-inspect signer.
		const tx = Transaction.from(inputs.tx.serialize());
		tx.setSenderIfNotSet(sender);

		const simulation = await this.api.client.simulateTransaction({
			transaction: tx,
			include: { effects: true, events: true, commandResults: true },
			checksEnabled: false,
		});

		const { effects, events, status } =
			GrpcCasting.transactionFromResult(simulation);

		if (!status.success) {
			throw new Error(status.error?.message ?? "dev inspect failed");
		}

		if (!simulation.commandResults) {
			throw new Error("dev inspect move call returned no results");
		}

		const resultBytes = simulation.commandResults.map((result) =>
			result.returnValues.map((val) => Array.from(val.bcs))
		);
		return {
			events,
			effects,
			allBytes: resultBytes,
		};
	};
}

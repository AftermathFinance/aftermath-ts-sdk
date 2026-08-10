import type { SuiClientTypes } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import type { Byte, SuiAddress } from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";
import { GrpcCasting } from "../utils/grpcCasting";

export class InspectionsApiHelpers {
	public static constants = {
		devInspectSigner:
			"0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5",
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Public Methods
	// =========================================================================

	// =========================================================================
	//  Fetching
	// =========================================================================

	// TODO: replace all bytes types with uint8array type

	public fetchFirstBytesFromTxOutput = async (inputs: {
		tx: Transaction;
		sender?: SuiAddress;
	}) => {
		return (await this.fetchAllBytesFromTxOutput(inputs))[0];
	};

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

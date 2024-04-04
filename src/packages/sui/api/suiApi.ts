import { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui.js/client";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Helpers } from "../../../general/utils";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { AnyObjectType } from "../../../types";

export class SuiApi {
	// =========================================================================
	//  Constants
	// =========================================================================

	private static readonly constants = {
		objectTypes: {
			transferRequest:
				"0x0000000000000000000000000000000000000000000000000000000000000002::transfer_policy::TransferRequest",
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public fetchCommitteeInfo = async (): Promise<CommitteeInfo> => {
		return this.Provider.provider.getCommitteeInfo();
	};

	public fetchSystemState = async (): Promise<SuiSystemStateSummary> => {
		const systemState =
			await this.Provider.provider.getLatestSuiSystemState();

		const activeValidators = systemState.activeValidators.map(
			(validator) => ({
				...validator,
				suiAddress: Helpers.addLeadingZeroesToType(
					validator.suiAddress
				),
			})
		);

		return {
			...systemState,
			activeValidators,
		};
	};

	// =========================================================================
	//  Transaction Commands
	// =========================================================================

	public vectorPopBackTx = (inputs: {
		tx: TransactionBlock;
		objectType: AnyObjectType;
		vectorId: TransactionArgument;
	}): TransactionArgument => {
		const { tx, objectType, vectorId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				"vector",
				"pop_back"
			),
			typeArguments: [objectType],
			arguments: [vectorId],
		});
	};

	public vectorDestroyEmptyTx = (inputs: {
		tx: TransactionBlock;
		objectType: AnyObjectType;
		vectorId: TransactionArgument;
	}) => {
		const { tx, objectType, vectorId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000001",
				"vector",
				"destroy_empty"
			),
			typeArguments: [objectType],
			arguments: [vectorId],
		});
	};

	public publicShareObjectTx = (inputs: {
		tx: TransactionBlock;
		objectType: AnyObjectType;
		objectId: TransactionArgument;
	}) => {
		const { tx, objectType, objectId } = inputs;

		return tx.moveCall({
			target: Helpers.transactions.createTxTarget(
				"0x0000000000000000000000000000000000000000000000000000000000000002",
				"transfer",
				"public_share_object"
			),
			typeArguments: [objectType],
			arguments: [objectId],
		});
	};

	// =========================================================================
	//  Public Helpers
	// =========================================================================

	public static transferRequestType = (inputs: {
		innerType: AnyObjectType;
	}) => {
		return `${this.constants.objectTypes.transferRequest}<${inputs.innerType}>`;
	};
}

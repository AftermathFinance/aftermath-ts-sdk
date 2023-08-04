import { TransactionArgument, TransactionBlock } from "@mysten/sui.js";
import { ManagementWithdrawLpInfo } from "../../../managementTypes";

// =========================================================================
//  Types
// =========================================================================

export interface ManagementWithdrawTxInputs<
	LpInfoType extends ManagementWithdrawLpInfo
> {
	tx: TransactionBlock;
	lpInfo: LpInfoType;
}

// =========================================================================
//  Interface
// =========================================================================

export interface ManagementApiWithdrawInterface<
	LpInfoType extends ManagementWithdrawLpInfo
> {
	// =========================================================================
	//  Required Functions
	// =========================================================================

	withdrawTx: (
		inputs: ManagementWithdrawTxInputs<LpInfoType>
	) => TransactionArgument[];
}

import {
	SuiAddress,
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js";
import { ManagementLpInfo } from "../../../managementTypes";
import { Balance } from "../../../../../types";

// =========================================================================
//  Types
// =========================================================================

export interface ManagementOwnedLpInfosInputs {
	walletAddress: SuiAddress;
}

export interface ManagementWithdrawTxInputs<
	LpInfoType extends ManagementLpInfo
> {
	tx: TransactionBlock;
	lpInfo: LpInfoType;
}

export interface ManagementCalcWithdrawAmountsOutInputs<
	LpInfoType extends ManagementLpInfo
> {
	lpInfo: LpInfoType;
}

// =========================================================================
//  Interface
// =========================================================================

export interface ManagementApiWithdrawInterface<
	LpInfoType extends ManagementLpInfo
> {
	// =========================================================================
	//  Required Functions
	// =========================================================================

	fetchOwnedLpInfos: (
		inputs: ManagementOwnedLpInfosInputs
	) => Promise<LpInfoType[]>;

	withdrawTx: (
		inputs: ManagementWithdrawTxInputs<LpInfoType>
	) => TransactionArgument[];

	calcWithdrawAmountsOut: (
		inputs: ManagementCalcWithdrawAmountsOutInputs<LpInfoType>
	) => Balance[];
}

import {
	ApiUnstakeSuiFrenBody,
	ApiWithdrawSuiFrenFeesBody,
	StakedSuiFrenInfo,
	SuiNetwork,
	Url,
} from "../../types";
import { SuiFren } from "./suiFren";
import { Caller } from "../../general/utils/caller";

export class StakedSuiFren extends Caller {
	// =========================================================================
	//  Class Members
	// =========================================================================

	public readonly suiFren: SuiFren;

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly info: StakedSuiFrenInfo,
		public readonly network?: SuiNetwork | Url
	) {
		super(network, "sui-frens");
		this.suiFren = new SuiFren(info.suiFren, this.network, true);
	}

	// =========================================================================
	//  Calculations
	// =========================================================================

	// public feesEarned(): Balance {
	// 	return this.metadata.collectedFees;
	// }

	// public currentFee(): Balance {
	// 	return this.metadata.mixFee;
	// }

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getUnstakeTransaction() {
		return this.fetchApiTransaction<ApiUnstakeSuiFrenBody>(
			"transactions/stake",
			{
				stakedPositionId: this.info.position.objectId,
			}
		);
	}

	public async getWithdrawFeesTransaction() {
		return this.fetchApiTransaction<ApiWithdrawSuiFrenFeesBody>(
			"transactions/withdraw-fees",
			{
				stakedPositionId: this.info.position.objectId,
			}
		);
	}
}

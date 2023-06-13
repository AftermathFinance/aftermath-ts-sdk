import {
	ApiUnstakeSuiFrenBody,
	ApiWithdrawSuiFrenFeesBody,
	Balance,
	StakedSuiFrenInfo,
	SuiNetwork,
	Url,
} from "../../types";
import { SuiFren } from "./suiFren";
import { Caller } from "../../general/utils/caller";
import { ObjectId } from "@mysten/sui.js";

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
		public readonly network?: SuiNetwork | Url,
		public readonly isOwned: boolean = false
	) {
		super(network, "sui-frens");
		this.suiFren = new SuiFren(info.suiFren, this.network, true, isOwned);
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	public mixFee(): Balance {
		return this.info.metadata.mixFee;
	}

	public suiFrenId(): ObjectId {
		return this.suiFren.suiFren.objectId;
	}

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

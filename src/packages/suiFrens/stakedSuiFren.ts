import {
	ApiAddSuiFrenAccessoryBody,
	ApiRemoveSuiFrenAccessoryBody,
	ApiUnstakeSuiFrenBody,
	ApiWithdrawStakedSuiFrenFeesBody,
	Balance,
	StakedSuiFrenInfo,
	SuiFrenAccessoryType,
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
	//  Objects
	// =========================================================================

	public async getAccessories() {
		return this.suiFren.getAccessories();
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getUnstakeTransaction() {
		return this.fetchApiTransaction<ApiUnstakeSuiFrenBody>(
			"transactions/unstake",
			{
				suiFrenType: this.suiFren.suiFrenType(),
				stakedPositionId: this.info.position.objectId,
			}
		);
	}

	public async getWithdrawFeesTransaction() {
		return this.fetchApiTransaction<ApiWithdrawStakedSuiFrenFeesBody>(
			"transactions/withdraw-fees",
			{
				suiFrenType: this.suiFren.suiFrenType(),
				stakedPositionId: this.info.position.objectId,
			}
		);
	}

	public async getAddAccessoryTransaction(inputs: { accessoryId: ObjectId }) {
		return this.suiFren.getAddAccessoryTransaction(inputs);
	}

	public async getRemoveAccessoryTransaction(inputs: {
		accessoryType: SuiFrenAccessoryType;
	}) {
		if (!this.isOwned)
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);

		return this.fetchApiTransaction<ApiRemoveSuiFrenAccessoryBody>(
			"transactions/remove-accessory",
			{
				...inputs,
				suiFrenType: this.suiFren.suiFrenType(),
				stakedPositionId: this.info.position.objectId,
			}
		);
	}
}

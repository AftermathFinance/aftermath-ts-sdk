import type { AftermathApi } from "../../general/providers";
import { Caller } from "../../general/utils/caller";
import type {
	Balance,
	CallerConfig,
	ObjectId,
	StakedSuiFrenInfo,
	SuiAddress,
	SuiFrenAccessoryType,
} from "../../types";
import { SuiFren } from "./suiFren";

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
		config?: CallerConfig,
		public readonly isOwned: boolean = false,
		public readonly api?: AftermathApi
	) {
		super(config, "sui-frens");
		this.suiFren = new SuiFren(info.suiFren, this.config, true, isOwned);
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

	public clone(): StakedSuiFren {
		return new StakedSuiFren(this.info, this.config, this.isOwned, this.api);
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

	public async getUnstakeTransaction(inputs: { walletAddress: SuiAddress }) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}

		return this.suiFrensApi().fetchUnstakeTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	public async getHarvestFeesTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}
		if (!this.isOwned) {
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);
		}

		return this.suiFrensApi().fetchBuildHarvestFeesTx({
			...inputs,
			stakedPositionIds: [this.info.position.objectId],
		});
	}

	public async getAddAccessoryTransaction(inputs: {
		accessoryId: ObjectId;
		walletAddress: SuiAddress;
	}) {
		return this.suiFren.getAddAccessoryTransaction(inputs);
	}

	public async getRemoveAccessoryTransaction(inputs: {
		accessoryType: SuiFrenAccessoryType;
		walletAddress: SuiAddress;
	}) {
		if (!this.info.position) {
			throw new Error("no position found on suiFren");
		}
		if (!this.isOwned) {
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);
		}

		return this.suiFrensApi().fetchBuildRemoveAccessoryTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private suiFrensApi = () => {
		const suiFrens = this.api?.SuiFrens();
		if (!suiFrens) {
			throw new Error("missing AftermathApi instance");
		}
		return suiFrens;
	};
}

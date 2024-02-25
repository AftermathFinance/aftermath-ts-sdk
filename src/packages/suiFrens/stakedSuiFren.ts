import {
	ApiAddSuiFrenAccessoryBody,
	ApiRemoveSuiFrenAccessoryBody,
	ApiUnstakeSuiFrenBody,
	ApiHarvestSuiFrenFeesBody,
	Balance,
	StakedSuiFrenInfo,
	SuiFrenAccessoryType,
	SuiNetwork,
	Url,
	ObjectId,
	SuiAddress,
} from "../../types";
import { SuiFren } from "./suiFren";
import { Caller } from "../../general/utils/caller";
import { AftermathApi } from "../../general/providers";

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
		public readonly network?: SuiNetwork,
		public readonly isOwned: boolean = false,
		private readonly Provider?: AftermathApi
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

	public clone(): StakedSuiFren {
		return new StakedSuiFren(
			this.info,
			this.network,
			this.isOwned,
			this.Provider
		);
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
		if (!this.info.position)
			throw new Error("no position found on suiFren");

		return this.useProvider().fetchUnstakeTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	public async getHarvestFeesTransaction(inputs: {
		walletAddress: SuiAddress;
	}) {
		if (!this.info.position)
			throw new Error("no position found on suiFren");
		if (!this.isOwned)
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);

		return this.useProvider().fetchBuildHarvestFeesTx({
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
		if (!this.info.position)
			throw new Error("no position found on suiFren");
		if (!this.isOwned)
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);

		return this.useProvider().fetchBuildRemoveAccessoryTx({
			...inputs,
			suiFrenType: this.suiFren.suiFrenType(),
			stakedPositionId: this.info.position.objectId,
		});
	}

	// =========================================================================
	//  Private Helpers
	// =========================================================================

	private useProvider = () => {
		const provider = this.Provider?.SuiFrens();
		if (!provider) throw new Error("missing AftermathApi Provider");
		return provider;
	};
}

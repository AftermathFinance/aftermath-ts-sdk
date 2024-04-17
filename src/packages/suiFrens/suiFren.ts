import {
	ApiStakeSuiFrenBody,
	SuiNetwork,
	SuiFrenObject,
	Url,
	Nft,
	Balance,
	SuiFrenAccessoryType,
	ApiAddSuiFrenAccessoryBody,
	ApiRemoveSuiFrenAccessoryBody,
	SuiFrenAccessoryObject,
	ApiAccessoriesForSuiFrenBody,
	AnyObjectType,
	ObjectId,
	SuiAddress,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import dayjs from "dayjs";
import { Coin } from "..";
import { AftermathApi } from "../../general/providers";

export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly suiFren: SuiFrenObject,
		public readonly network?: SuiNetwork,
		public readonly isStaked: boolean = false,
		public readonly isOwned: boolean = false,
		private readonly Provider?: AftermathApi
	) {
		super(network, "sui-frens");
	}

	// =========================================================================
	//  Getters
	// =========================================================================

	public suiFrenType(): AnyObjectType {
		return new Coin(this.suiFren.objectType).innerCoinType;
	}

	public properties(): Record<string, string> {
		return {
			Skin: this.suiFren.attributes.skin,
			Ears: this.suiFren.attributes.ears,
			Expression: this.suiFren.attributes.expression,
			"Main Color": this.suiFren.attributes.main,
			"Secondary Color": this.suiFren.attributes.secondary,
			"Birth Location": this.suiFren.birthLocation,
			Birthday: dayjs(this.suiFren.birthdate).format("MMMM D, YYYY"),
			Cohort: this.suiFren.cohort.toString(),
			Generation: this.suiFren.generation.toString(),
			// Genes: this.suiFren.genes.toString(),
		};
	}

	public dynamicFields(): Record<string, string> {
		return {
			...(this.suiFren.mixLimit
				? {
						"Mixes Remaining": this.suiFren.mixLimit.toString(),
				  }
				: {}),
			...(this.suiFren.lastEpochMixed
				? {
						"Last Epoch Mixed":
							this.suiFren.lastEpochMixed.toString(),
				  }
				: {}),
		};
	}

	public displayNumber(): string {
		return this.suiFren.objectId.slice(-5, -1).toUpperCase();
	}

	public clone(): SuiFren {
		return new SuiFren(
			this.suiFren,
			this.network,
			this.isStaked,
			this.isOwned
		);
	}

	// public asNft(): Nft {
	// 	return {
	// 		info: {
	// 			objectId: this.suiFren.objectId,
	// 			objectType: this.suiFren.objectType,
	// 		},
	// 		display: {
	// 			suggested: {
	// 				name: "SuiFren",
	// 				...this.suiFren.display,
	// 			},
	// 			other: {
	// 				Skin: this.suiFren.attributes.skin,
	// 				Ears: this.suiFren.attributes.ears,
	// 				Expression: this.suiFren.attributes.expression,
	// 				"Main Color": this.suiFren.attributes.main,
	// 				"Secondary Color": this.suiFren.attributes.secondary,
	// 				"Birth Location": this.suiFren.birthLocation,
	// 				Birthday: dayjs(this.suiFren.birthdate).format(
	// 					"MMMM D, YYYY"
	// 				),
	// 				Cohort: this.suiFren.cohort.toString(),
	// 				Generation: this.suiFren.generation.toString(),
	// 				...(this.suiFren.mixLimit
	// 					? {
	// 							"Mixes Remaining":
	// 								this.suiFren.mixLimit.toString(),
	// 					  }
	// 					: {}),
	// 				...(this.suiFren.lastEpochMixed
	// 					? {
	// 							"Last Epoch Mixed":
	// 								this.suiFren.lastEpochMixed.toString(),
	// 					  }
	// 					: {}),
	// 				// Genes: this.suiFren.genes.toString(),
	// 			},
	// 		},
	// 	};
	// }

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getAccessories() {
		return this.fetchApi<
			SuiFrenAccessoryObject[],
			ApiAccessoriesForSuiFrenBody
		>("accessories", {
			suiFrenId: this.suiFren.objectId,
		});
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: {
		baseFee: Balance;
		feeIncrementPerMix: Balance;
		minRemainingMixesToKeep: bigint;
		walletAddress: SuiAddress;
	}) {
		if (this.isStaked)
			throw new Error("unable to stake already staked suiFren");

		return this.useProvider().fetchStakeTx({
			...inputs,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
		});
	}

	public async getAddAccessoryTransaction(inputs: {
		accessoryId: ObjectId;
		walletAddress: SuiAddress;
	}) {
		return this.useProvider().fetchBuildAddAccessoryTx({
			...inputs,
			isOwned: this.isOwned,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
		});
	}

	public async getRemoveAccessoryTransaction(inputs: {
		accessoryType: SuiFrenAccessoryType;
		walletAddress: SuiAddress;
	}) {
		if (!this.isOwned)
			throw new Error(
				"unable to remove accessory from suiFren that is not owned by caller"
			);

		return this.useProvider().fetchBuildRemoveAccessoryTx({
			...inputs,
			suiFrenType: this.suiFrenType(),
			suiFrenId: this.suiFren.objectId,
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

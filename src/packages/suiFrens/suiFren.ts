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
	ApiSuiFrenAccessoriesBody,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import dayjs from "dayjs";
import { ObjectId } from "@mysten/sui.js";

export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly suiFren: SuiFrenObject,
		public readonly network?: SuiNetwork | Url,
		public readonly isStaked: boolean = false,
		public readonly isOwned: boolean = false
	) {
		super(network, "sui-frens");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getAccessories() {
		return this.fetchApi<
			SuiFrenAccessoryObject[],
			ApiSuiFrenAccessoriesBody
		>("accessories", {
			suiFrenId: this.suiFren.objectId,
		});
	}

	public asNft(): Nft {
		return {
			info: {
				objectId: this.suiFren.objectId,
				objectType: this.suiFren.objectType,
			},
			display: {
				suggested: {
					...this.suiFren.display,
				},
				other: {
					Skin: this.suiFren.attributes.skin,
					Ears: this.suiFren.attributes.ears,
					Expression: this.suiFren.attributes.expression,
					"Main Color": this.suiFren.attributes.mainColor,
					"Secondary Color": this.suiFren.attributes.secondaryColor,
					"Birth Location": this.suiFren.birthLocation,
					Birthday: dayjs(this.suiFren.birthdate).format(
						"MMMM D, YYYY"
					),
					Cohort: this.suiFren.cohort.toString(),
					Generation: this.suiFren.generation.toString(),
					...(this.suiFren.mixLimit
						? {
								"Mixes Remaining":
									this.suiFren.mixLimit.toString(),
						  }
						: {}),
					...(this.suiFren.lastEpochMixed
						? {
								"Last Epoch Mixed":
									this.suiFren.lastEpochMixed.toString(),
						  }
						: {}),
					// Genes: this.suiFren.genes.toString(),
				},
			},
		};
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: {
		mixFee: Balance;
		feeIncrementPerMix: Balance;
		minRemainingMixesToKeep: bigint;
	}) {
		if (this.isStaked)
			throw new Error("unable to stake already staked suiFren");

		return this.fetchApiTransaction<ApiStakeSuiFrenBody>(
			"transactions/stake",
			{
				...inputs,
				suiFrenId: this.suiFren.objectId,
			}
		);
	}

	public async getAddAccessoryTransaction(inputs: { accessoryId: ObjectId }) {
		return this.fetchApiTransaction<ApiAddSuiFrenAccessoryBody>(
			"transactions/add-accessory",
			{
				...inputs,
				suiFrenId: this.suiFren.objectId,
			}
		);
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
				suiFrenId: this.suiFren.objectId,
			}
		);
	}
}

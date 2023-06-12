import {
	ApiStakeSuiFrenBody,
	SuiNetwork,
	SuiFrenObject,
	Url,
	Nft,
	Balance,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import dayjs from "dayjs";

export class SuiFren extends Caller {
	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		public readonly suiFren: SuiFrenObject,
		public readonly network?: SuiNetwork | Url,
		public readonly isStaked: boolean = false
	) {
		super(network, "sui-frens");
		this.suiFren = suiFren;
		this.isStaked = isStaked;
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public asNft(): Nft {
		return {
			info: {
				objectId: this.suiFren.objectId,
				version: "",
				digest: "",
				// type?: AnyObjectType,
			},
			display: {
				suggested: {
					name: "SuiFren",
					// link?: Url,
					imageUrl: this.suiFren.imageUrl,
					// description?: string,
					// projectUrl?: Url,
					// creator?: string,
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
}

import {
	ApiStakeBody,
	SuiNetwork,
	Balance,
	Url,
	Percentage,
	StakedSuiVaultStateObject,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { SuiValidatorSummary } from "@mysten/sui.js/client";

export class SuperStaking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		bounds: {},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "super-staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.fetchApiTransaction<ApiStakeBody>(
			"transactions/super-stake",
			inputs
		);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	public static calcAtomicUnstakeFee(inputs: {
		stakedSuiVaultState: StakedSuiVaultStateObject;
	}): Percentage {
		return 0;
	}
}

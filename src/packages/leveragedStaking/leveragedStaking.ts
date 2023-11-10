import {
	SuiNetwork,
	Url,
	ScallopMarketPool,
	ScallopMarketCollateral,
	LeveragedStakeObligation,
	ApiLeveragedStakeObligationBody,
	ApiLeveragedStakeObligationResponse,
	LeveragedAfSuiState,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class LeveragedStaking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		bounds: {
			maxLeverage: 3.5,
		},
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "leveraged-staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getOwnedObligation(
		inputs: ApiLeveragedStakeObligationBody
	): Promise<ApiLeveragedStakeObligationResponse> {
		return this.fetchApi("obligation", inputs);
	}

	public async getLeveragedAfSuiState(): Promise<LeveragedAfSuiState> {
		return this.fetchApi("leveraged-afsui-state");
	}

	public async getSuiMarketPool(): Promise<ScallopMarketPool> {
		return this.fetchApi("sui-market-pool");
	}

	public async getAfSuiMarketCollateral(): Promise<ScallopMarketCollateral> {
		return this.fetchApi("afsui-market-collateral");
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	// public async getStakeTransaction(inputs: ApiStakeBody) {
	// 	return this.fetchApiTransaction<ApiStakeBody>(
	// 		"transactions/leveraged-stake",
	// 		inputs
	// 	);
	// }

	// =========================================================================
	//  Inspections
	// =========================================================================

	// public async getSuiTvl(): Promise<Balance> {
	// 	return this.fetchApi("sui-tvl");
	// }

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	// public static calcAtomicUnstakeFee(inputs: {
	// 	stakedSuiVaultState: StakedSuiVaultStateObject;
	// }): Percentage {
	// 	return 0;
	// }
}

import {
	SuiNetwork,
	Url,
	ScallopMarketPool,
	ScallopMarketCollateral,
	ApiLeveragedStakePositionBody,
	ApiLeveragedStakePositionResponse,
	LeveragedAfSuiState,
	Balance,
	LeveragedStakingPerformanceDataBody,
	LeveragedStakingPerformanceDataPoint,
	LeveragedStakingEvent,
	ApiIndexerUserEventsBody,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class LeveragedStaking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		bounds: {
			maxLeverage: 2.5,
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

	public async getLeveragedStakePosition(
		inputs: ApiLeveragedStakePositionBody
	): Promise<ApiLeveragedStakePositionResponse> {
		return this.fetchApi("leveraged-stake-position", inputs);
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
	//  Events
	// =========================================================================

	public async getEventsForUser(inputs: ApiIndexerUserEventsBody) {
		return this.fetchApiEvents<
			LeveragedStakingEvent,
			ApiIndexerUserEventsBody
		>("events", inputs);
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
	//  Graph Data
	// =========================================================================

	public async getPerformanceData(
		inputs: LeveragedStakingPerformanceDataBody
	): Promise<LeveragedStakingPerformanceDataPoint[]> {
		return this.fetchApi(
			`performance-data/${inputs.timeframe}/${inputs.borrowRate}`
		);
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	public static calcLeverage = (inputs: {
		totalSuiDebt: Balance;
		totalAfSuiCollateral: Balance;
	}): number => {
		if (inputs.totalAfSuiCollateral === BigInt(0)) return 1;
		return (
			1 /
			(1 -
				Number(inputs.totalSuiDebt) /
					Number(inputs.totalAfSuiCollateral))
		);
	};

	public static calcTotalSuiDebt = (inputs: {
		leverage: number;
		totalAfSuiCollateral: Balance;
	}): Balance => {
		return BigInt(
			Math.floor(
				Number(inputs.totalAfSuiCollateral) * (1 - 1 / inputs.leverage)
			)
		);
	};
}

import {
	SuiNetwork,
	Url,
	// ScallopMarketPool,
	// ScallopMarketCollateral,
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

/**
 * Represents the Leveraged Staking module.
 */
export class LeveragedStaking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	// public static readonly constants = {};

	// =========================================================================
	//  Constructor
	// =========================================================================

	/**
	 * Creates an instance of the LeveragedStaking class.
	 * @param network The network to connect to.
	 */
	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "leveraged-staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Retrieves the leveraged stake position.
	 * @param inputs The input parameters for the API request.
	 * @returns A Promise that resolves to the API response.
	 */
	public async getLeveragedStakePosition(
		inputs: ApiLeveragedStakePositionBody
	): Promise<ApiLeveragedStakePositionResponse> {
		return this.fetchApi("leveraged-stake-position", inputs);
	}

	/**
	 * Retrieves the Leveraged AfSui state.
	 * @returns A Promise that resolves to the LeveragedAfSuiState object.
	 */
	public async getLeveragedAfSuiState(): Promise<LeveragedAfSuiState> {
		return this.fetchApi("leveraged-afsui-state");
	}

	/**
	 * Retrieves the SUI market pool.
	 * @returns A promise that resolves to a ScallopMarketPool object.
	 */
	public async getSuiMarketPool(): Promise<any> {
		// ScallopMarketPool
		return this.fetchApi("sui-market-pool");
	}

	/**
	 * Retrieves the AfSui market collateral.
	 * @returns A promise that resolves to a `ScallopMarketCollateral` object.
	 */
	public async getAfSuiMarketCollateral(): Promise<any> {
		// ScallopMarketCollateral
		return this.fetchApi("afsui-market-collateral");
	}

	// =========================================================================
	//  Events
	// =========================================================================

	/**
	 * Retrieves events for a specific user.
	 * @param inputs The input parameters for the API request.
	 * @returns A promise that resolves to the fetched events.
	 */
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

	/**
	 * Retrieves the performance data for leveraged staking.
	 * @param inputs - The input parameters for fetching performance data.
	 * @returns A promise that resolves to an array of LeveragedStakingPerformanceDataPoint objects.
	 */
	public async getPerformanceData(
		inputs: LeveragedStakingPerformanceDataBody
	): Promise<LeveragedStakingPerformanceDataPoint[]> {
		return this.fetchApi(
			`performance-data/${inputs.timeframe}/${inputs.borrowRate}/${inputs.maxLeverage}`
		);
	}

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	/**
	 * Calculates the leverage based on the provided inputs.
	 * @param inputs - The inputs required for leverage calculation.
	 * @returns The calculated leverage.
	 */
	public static calcLeverage = (inputs: {
		totalAfSuiCollateral: Balance;
		totalSuiDebt: Balance;
		afSuiToSuiExchangeRate: number;
	}): number => {
		return LeveragedStaking.calcLeverageNormalized({
			normalizedTotalSuiDebt: inputs.totalSuiDebt,
			normalizedTotalAfSuiCollateral: BigInt(
				Math.floor(
					Number(inputs.totalAfSuiCollateral) /
						inputs.afSuiToSuiExchangeRate
				)
			),
		});
	};

	/**
	 * Calculates the total SUI debt based on the provided inputs.
	 *
	 * @param inputs - The inputs required for the calculation.
	 * @returns The total SUI debt as a Balance.
	 */
	public static calcTotalSuiDebt = (inputs: {
		leverage: number;
		totalAfSuiCollateral: Balance;
		afSuiToSuiExchangeRate: number;
	}): Balance => {
		return BigInt(
			Math.floor(
				Number(inputs.totalAfSuiCollateral) *
					inputs.afSuiToSuiExchangeRate *
					(1 - (inputs.leverage ? 1 / inputs.leverage : 0))
			)
		);
	};

	// =========================================================================
	//  Private Static Methods
	// =========================================================================

	// =========================================================================
	//  Calculations
	// =========================================================================

	private static calcLeverageNormalized = (inputs: {
		normalizedTotalAfSuiCollateral: Balance;
		normalizedTotalSuiDebt: Balance;
	}): number => {
		const normalizedTotalAfSuiCollateralNum = Number(
			inputs.normalizedTotalAfSuiCollateral
		);
		if (!normalizedTotalAfSuiCollateralNum) return 1;

		return (
			1 /
			(1 -
				Number(inputs.normalizedTotalSuiDebt) /
					normalizedTotalAfSuiCollateralNum)
		);
	};
}

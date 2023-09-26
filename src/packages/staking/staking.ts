import {
	ApiStakeBody,
	ApiUnstakeBody,
	SuiNetwork,
	ApiStakingPositionsBody,
	StakingPosition,
	StakeRequestEvent,
	ApiStakingEventsBody,
	Balance,
	Url,
	UnstakeEvent,
	ValidatorConfigObject,
	ApiStakeStakedSuiBody,
	ApiDelegatedStakesBody,
	SuiDelegatedStake,
} from "../../types";
import { Caller } from "../../general/utils/caller";
import { SuiValidatorSummary, ValidatorsApy } from "@mysten/sui.js/client";

export class Staking extends Caller {
	// =========================================================================
	//  Constants
	// =========================================================================

	public static readonly constants = {
		fees: {
			protocolUnstake: 0.05, // 5%
		},
		bounds: {
			minStake: BigInt("1000000000"), // 1 SUI
		},
		defaultValidatorFee: 0, // 0%
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(public readonly network?: SuiNetwork | Url) {
		super(network, "staking");
	}

	// =========================================================================
	//  Objects
	// =========================================================================

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	public async getValidatorApys(): Promise<ValidatorsApy> {
		return this.fetchApi("validator-apys");
	}

	public async getValidatorConfigs(): Promise<ValidatorConfigObject[]> {
		return this.fetchApi("validator-configs");
	}

	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	public async getDelegatedStakes(
		inputs: ApiDelegatedStakesBody
	): Promise<SuiDelegatedStake[]> {
		return this.fetchApi("delegated-stakes", inputs);
	}

	// =========================================================================
	//  Transactions
	// =========================================================================

	public async getStakeTransaction(inputs: ApiStakeBody) {
		return this.fetchApiTransaction<ApiStakeBody>(
			"transactions/stake",
			inputs
		);
	}

	public async getUnstakeTransaction(inputs: ApiUnstakeBody) {
		return this.fetchApiTransaction<ApiUnstakeBody>(
			"transactions/unstake",
			inputs
		);
	}

	public async getStakeStakedSuiTransaction(inputs: ApiStakeStakedSuiBody) {
		return this.fetchApiTransaction<ApiStakeStakedSuiBody>(
			"transactions/stake-staked-sui",
			inputs
		);
	}

	// =========================================================================
	//  Inspections
	// =========================================================================

	public async getSuiTvl(): Promise<Balance> {
		return this.fetchApi("sui-tvl");
	}

	public async getAfSuiToSuiExchangeRate(): Promise<number> {
		return this.fetchApi("afsui-exchange-rate");
	}

	public async getApy(): Promise<number> {
		return this.fetchApi("apy");
	}
}

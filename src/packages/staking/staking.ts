import {
	SuiAddress,
	DelegatedStake,
	SuiValidatorSummary,
} from "@mysten/sui.js";
import {
	ApiStakeBody,
	ApiUnstakeBody,
	StakeFailedEvent,
	StakeRequestEvent,
	UnstakeRequestEvent,
	StakingStats,
	SuiNetwork,
	ApiEventsBody,
	ApiStakingPositionsBody,
	StakingPosition,
} from "../../types";
import { Caller } from "../../general/utils/caller";

export class Staking extends Caller {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		objectTypes: {
			stakedSuiType: "0x2::staking_pool::StakedSui",
			delegationType: "0x2::staking_pool::Delegation",
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	constructor(public readonly network?: SuiNetwork) {
		super(network, "staking");
	}

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public async getStakePositions(
		walletAddress: SuiAddress
	): Promise<DelegatedStake[]> {
		return this.fetchApi<DelegatedStake[]>(
			`stake-positions/${walletAddress}`
		);
	}

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	/////////////////////////////////////////////////////////////////////
	//// Stats
	/////////////////////////////////////////////////////////////////////

	public async getStats(): Promise<StakingStats> {
		return this.fetchApi("stats");
	}

	/////////////////////////////////////////////////////////////////////
	//// Positions
	/////////////////////////////////////////////////////////////////////

	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

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
}

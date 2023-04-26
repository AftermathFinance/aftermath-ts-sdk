import {
	SuiAddress,
	DelegatedStake,
	SuiValidatorSummary,
} from "@mysten/sui.js";
import {
	ApiStakingStakeBody,
	ApiStakingUnstakeBody,
	StakeFailedEvent,
	StakeRequestEvent,
	UnstakeRequestEvent,
	StakingStats,
	SuiNetwork,
	ApiEventsBody,
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
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getStakeEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<StakeRequestEvent>("events/stake", inputs);
	}

	public async getUnstakeEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<UnstakeRequestEvent>(
			"events/unstake",
			inputs
		);
	}

	public async getFailedStakeEvents(inputs: ApiEventsBody) {
		return this.fetchApiEvents<StakeFailedEvent>(
			"events/failed-stake",
			inputs
		);
	}

	/////////////////////////////////////////////////////////////////////
	//// Transactions
	/////////////////////////////////////////////////////////////////////

	public async getStakeTransaction(inputs: ApiStakingStakeBody) {
		return this.fetchApiTransaction<ApiStakingStakeBody>(
			"transactions/stake",
			inputs
		);
	}

	public async getUnstakeTransaction(inputs: ApiStakingUnstakeBody) {
		return this.fetchApiTransaction<ApiStakingUnstakeBody>(
			"transactions/unstake",
			inputs
		);
	}
}

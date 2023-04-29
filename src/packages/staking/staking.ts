import { SuiValidatorSummary } from "@mysten/sui.js";
import {
	ApiStakeBody,
	ApiUnstakeBody,
	SuiNetwork,
	ApiStakingPositionsBody,
	StakingPosition,
	ApiEventsBody,
	StakeRequestEvent,
	UnstakeRequestEvent,
	ApiStakingEventsBody,
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

	public async getActiveValidators(): Promise<SuiValidatorSummary[]> {
		return this.fetchApi("active-validators");
	}

	public async getStakingPositions(
		inputs: ApiStakingPositionsBody
	): Promise<StakingPosition[]> {
		return this.fetchApi("staking-positions", inputs);
	}

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public async getStakeRequestEvents(inputs: ApiStakingEventsBody) {
		return this.fetchApiEvents<StakeRequestEvent>(
			"events/stake-request",
			inputs
		);
	}

	public async getUnstakeRequestEvents(inputs: ApiStakingEventsBody) {
		return this.fetchApiEvents<UnstakeRequestEvent>(
			"events/unstake-request",
			inputs
		);
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

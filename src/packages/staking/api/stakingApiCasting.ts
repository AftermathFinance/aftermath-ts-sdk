import {
	StakingFailedStakeEvent,
	StakingStakeEvent,
	StakingUnstakeEvent,
} from "../../../types";
import {
	StakingFailedStakeEventOnChain,
	StakingStakeEventOnChain,
	StakingUnstakeEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static stakeEventFromOnChain = (
		eventOnChain: StakingStakeEventOnChain
	): StakingStakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static unstakeEventFromOnChain = (
		eventOnChain: StakingUnstakeEventOnChain
	): StakingUnstakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiWrapperId: fields.afsui_wrapper_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static failedStakeEventFromOnChain = (
		eventOnChain: StakingFailedStakeEventOnChain
	): StakingFailedStakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			staker: fields.staker,
			validatorAddress: fields.validator,
			epoch: BigInt(fields.epoch),
			stakedSuiAmount: BigInt(fields.amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};
}

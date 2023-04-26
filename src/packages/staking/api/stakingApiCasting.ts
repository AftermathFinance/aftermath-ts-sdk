import { FailedStakeEvent, StakeEvent, UnstakeEvent } from "../../../types";
import {
	StakeFailedEventOnChain,
	StakeRequestEventOnChain,
	UnstakeRequestEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static stakeEventFromOnChain = (
		eventOnChain: StakeRequestEventOnChain
	): StakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static unstakeEventFromOnChain = (
		eventOnChain: UnstakeRequestEventOnChain
	): UnstakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiWrapperId: fields.afsui_wrapper_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static failedStakeEventFromOnChain = (
		eventOnChain: StakeFailedEventOnChain
	): FailedStakeEvent => {
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

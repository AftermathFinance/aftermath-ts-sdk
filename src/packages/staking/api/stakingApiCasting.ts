import {
	AfSuiMintedEvent,
	StakeFailedEvent,
	StakeRequestEvent,
	StakeSuccessEvent,
	UnstakeRequestEvent,
	UnstakeSuccessEvent,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	StakeFailedEventOnChain,
	StakeRequestEventOnChain,
	StakeSuccessEventOnChain,
	UnstakeRequestEventOnChain,
	UnstakeSuccessEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static stakeRequestEventFromOnChain = (
		eventOnChain: StakeRequestEventOnChain
	): StakeRequestEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			staker: fields.staker,
			validatorAddress: fields.validator,
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static unstakeRequestEventFromOnChain = (
		eventOnChain: UnstakeRequestEventOnChain
	): UnstakeRequestEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiWrapperId: fields.afsui_wrapper_id,
			staker: fields.staker,
			epoch: BigInt(fields.epoch),
			afSuiAmountGiven: BigInt(fields.provided_afsui_amount),
			suiUnstakeAmount: BigInt(fields.sui_amount_to_withdraw),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static stakeSuccessEventFromOnChain = (
		eventOnChain: StakeSuccessEventOnChain
	): StakeSuccessEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			staker: fields.staker,
			validatorAddress: fields.validator,
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static unstakeSuccessEventFromOnChain = (
		eventOnChain: UnstakeSuccessEventOnChain
	): UnstakeSuccessEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiWrapperId: fields.afsui_wrapper_id,
			staker: fields.staker,
			epoch: BigInt(fields.epoch),
			// afSuiAmountGiven: BigInt(fields.provided_afsui_amount),
			suiUnstakeAmount: BigInt(fields.withdrawn_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static stakeFailedEventFromOnChain = (
		eventOnChain: StakeFailedEventOnChain
	): StakeFailedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			staker: fields.staker,
			validatorAddress: fields.validator,
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.returned_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static afSuiMintedEventFromOnChain = (
		eventOnChain: AfSuiMintedEventOnChain
	): AfSuiMintedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiWrapperId: fields.sui_wrapper_id,
			staker: fields.staker,
			epoch: BigInt(fields.epoch),
			afSuiMintAmount: BigInt(fields.minted_afsui_amount),
			suiStakeAmount: BigInt(fields.staked_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};
}

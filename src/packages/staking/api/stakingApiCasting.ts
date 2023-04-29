import {
	AfSuiMintedEvent,
	StakeFailedEvent,
	StakePosition,
	StakeRequestEvent,
	StakeSuccessEvent,
	UnstakePosition,
	UnstakeRequestEvent,
	UnstakeSuccessEvent,
	isStakeEvent,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	StakeFailedEventOnChain,
	StakeRequestEventOnChain,
	StakeSuccessEventOnChain,
	UnstakeRequestEventOnChain,
	UnstakeSuccessEventOnChain,
} from "./stakingApiCastingTypes";
import { StakingApiHelpers } from "./stakingApiHelpers";

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
			type: eventOnChain.type,
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
			type: eventOnChain.type,
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
			type: eventOnChain.type,
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
			afSuiAmountGiven: BigInt(fields.provided_afsui_amount),
			suiUnstakeAmount: BigInt(fields.withdrawn_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
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
			type: eventOnChain.type,
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
			type: eventOnChain.type,
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Staking Positions
	/////////////////////////////////////////////////////////////////////

	// TODO: use this func in staking api helpers
	public static stakePositionFromStakeRequestEvent = (
		event: StakeRequestEvent
	): StakePosition => {
		return {
			...event,
			state: "REQUEST",
		};
	};

	// TODO: use this func in staking api helpers
	public static unstakePositionFromUnstakeRequestEvent = (
		event: UnstakeRequestEvent
	): UnstakePosition => {
		return {
			...event,
			state: "REQUEST",
		};
	};
}

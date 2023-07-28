import {
	AfSuiMintedEvent,
	StakePosition,
	UnstakePosition,
	UnstakeEvent,
	StakeRequestEvent,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	StakeRequestEventOnChain,
	UnstakeEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApiCasting {
	// =========================================================================
	//  Events
	// =========================================================================

	public static stakeRequestEventFromOnChain = (
		eventOnChain: StakeRequestEventOnChain
	): StakeRequestEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiId: fields.sui_id,
			stakedSuiId: fields.staked_sui_id,
			staker: fields.staker,
			validatorAddress: fields.validator,
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeEventFromOnChain = (
		eventOnChain: UnstakeEventOnChain
	): UnstakeEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: fields.afsui_id,
			paybackCoinId: fields.payback_coin_id,
			staker: fields.staker,
			epoch: BigInt(fields.epoch),
			afSuiAmountGiven: BigInt(fields.provided_afsui_amount),
			suiUnstakeAmount: BigInt(fields.withdrawn_sui_amount),
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
			suiId: fields.sui_id,
			staker: fields.staker,
			epoch: BigInt(fields.epoch),
			afSuiMintAmount: BigInt(fields.minted_afsui_amount),
			suiStakeAmount: BigInt(fields.staked_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Staking Positions
	// =========================================================================

	// TODO: use this func in staking api helpers
	public static stakePositionFromStakeRequestEvent = (
		event: StakeRequestEvent
	): StakePosition => {
		throw new Error("TODO");

		return {
			...event,
			state: "REQUEST",
		};
	};

	// TODO: use this func in staking api helpers
	public static unstakePositionFromUnstakeEvent = (
		event: UnstakeEvent
	): UnstakePosition => {
		throw new Error("TODO");

		return {
			...event,
		};
	};
}

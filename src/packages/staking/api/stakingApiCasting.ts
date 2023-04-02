import {
	StakeBalanceDynamicField,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
} from "../../../types";
import {
	StakeBalanceDynamicFieldOnChain,
	StakingCancelDelegationRequestEventOnChain,
	StakingRequestAddDelegationEventOnChain,
	StakingRequestWithdrawDelegationEventOnChain,
} from "./stakingApiCastingTypes";

export class StakingApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Dynamic Fields
	/////////////////////////////////////////////////////////////////////

	public static stakeBalanceDynamicFieldFromOnChain = (
		dataOnChain: StakeBalanceDynamicFieldOnChain
	) => {
		return {
			objectId: dataOnChain.fields.id.id,
			value: BigInt(dataOnChain.fields.value),
		} as StakeBalanceDynamicField;
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static requestAddDelegationEventFromOnChain = (
		eventOnChain: StakingRequestAddDelegationEventOnChain
	): StakeRequestAddDelegationEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static requestWithdrawDelegationEventFromOnChain = (
		eventOnChain: StakingRequestWithdrawDelegationEventOnChain
	): StakeRequestWithdrawDelegationEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};

	public static cancelDelegationRequestEventFromOnChain = (
		eventOnChain: StakingCancelDelegationRequestEventOnChain
	): StakeCancelDelegationRequestEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
		};
	};
}

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
		const event = eventOnChain.event.moveEvent;
		const fields = event.fields;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};

	public static requestWithdrawDelegationEventFromOnChain = (
		eventOnChain: StakingRequestWithdrawDelegationEventOnChain
	): StakeRequestWithdrawDelegationEvent => {
		const event = eventOnChain.event.moveEvent;
		const fields = event.fields;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};

	public static cancelDelegationRequestEventFromOnChain = (
		eventOnChain: StakingCancelDelegationRequestEventOnChain
	): StakeCancelDelegationRequestEvent => {
		const event = eventOnChain.event.moveEvent;
		const fields = event.fields;
		return {
			issuer: fields.issuer,
			amount: BigInt(fields.amount),
			validator: fields.validator,
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};
}

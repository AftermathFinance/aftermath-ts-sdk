import { DelegatedStake, ValidatorMetaData } from "@mysten/sui.js";
import {
	DelegatedStakePosition,
	StakeBalanceDynamicField,
	StakeCancelDelegationRequestEvent,
	StakeRequestAddDelegationEvent,
	StakeRequestWithdrawDelegationEvent,
	StakeValidator,
} from "../../../types";
import {
	StakeBalanceDynamicFieldOnChain,
	StakingCancelDelegationRequestEventOnChain,
	StakingRequestAddDelegationEventOnChain,
	StakingRequestWithdrawDelegationEventOnChain,
} from "./stakingApiCastingTypes";
import { Casting } from "../../../general/utils/casting";

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

	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static stakeValidatorFromValidatorMetadata = (
		validator: ValidatorMetaData
	): StakeValidator => {
		const stringFromBytesOrUndefined = (data: any[] | null) =>
			data === null || data.length === 0
				? undefined
				: Casting.stringFromBytes(data);

		const stringFromStringBytesOrUndefined = (
			data: string | any[] | null
		) =>
			typeof data === "string" ? data : stringFromBytesOrUndefined(data);

		const name =
			typeof validator.name === "string"
				? validator.name
				: Casting.stringFromBytes(validator.name);

		return {
			name,
			description: stringFromStringBytesOrUndefined(
				validator.description
			),
			projectUrl: stringFromStringBytesOrUndefined(validator.project_url),
			imageUrl: stringFromStringBytesOrUndefined(validator.image_url),
			suiAddress: validator.sui_address,
			nextEpoch: {
				commissionRate: validator.next_epoch_commission_rate,
				delegation: BigInt(validator.next_epoch_delegation),
				gasPrice: BigInt(validator.next_epoch_gas_price),
				stake: BigInt(validator.next_epoch_stake),
			},
		};
	};

	public static delegatedStakePositionFromDelegatedStake = (
		delegatedStake: DelegatedStake
	): DelegatedStakePosition => {
		const stakedSui = delegatedStake.staked_sui;
		const delegationStatus = delegatedStake.delegation_status;
		const status =
			delegationStatus === "Pending"
				? "pending"
				: {
						active: {
							id: delegationStatus.Active.id.id,
							stakedSuiId: delegationStatus.Active.staked_sui_id,
							principalSuiAmount: BigInt(
								delegationStatus.Active.principal_sui_amount
							),
							poolCoinsAmount: BigInt(
								delegationStatus.Active.pool_tokens.value
							),
						},
				  };

		return {
			stakedSuiId: stakedSui.id.id,
			validatorAddress: stakedSui.validator_address,
			poolStartingEpoch: stakedSui.pool_starting_epoch,
			delegationRequestEpoch: stakedSui.delegation_request_epoch,
			principalAmount: BigInt(stakedSui.principal.value),
			suiCoinLock:
				stakedSui.sui_token_lock === null
					? undefined
					: stakedSui.sui_token_lock,
			status: status,
		};
	};
}

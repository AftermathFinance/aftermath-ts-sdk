import { SuiObjectResponse } from "@mysten/sui.js/client";
import {
	AfSuiMintedEvent,
	UnstakeEvent,
	StakeRequestEvent,
	ValidatorConfigObject,
} from "../../../types";
import {
	AfSuiMintedEventOnChain,
	AfSuiMintedIndexerEventOnChain,
	StakeRequestEventOnChain,
	StakeRequestIndexerEventOnChain,
	UnstakeEventOnChain,
	UnstakeIndexerEventOnChain,
	ValidatorConfigFieldsOnChain,
} from "./stakingApiCastingTypes";
import { Helpers } from "../../../general/utils";
import { FixedUtils } from "../../../general/utils/fixedUtils";

export class StakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static validatorConfigObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): ValidatorConfigObject => {
		const objectType = Helpers.getObjectType(data);

		const allFields = Helpers.getObjectFields(data) as {
			value: {
				fields: {
					value: {
						fields: ValidatorConfigFieldsOnChain;
					};
				};
			};
		};
		const fields = allFields.value.fields.value.fields;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			suiAddress: Helpers.addLeadingZeroesToType(fields.sui_address),
			operationCapId: Helpers.addLeadingZeroesToType(
				fields.operation_cap_id
			),
			fee: FixedUtils.directCast(BigInt(fields.fee)),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static stakeRequestEventFromOnChain = (
		eventOnChain: StakeRequestEventOnChain
	): StakeRequestEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			stakedSuiId: Helpers.addLeadingZeroesToType(fields.staked_sui_id),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			validatorAddress: Helpers.addLeadingZeroesToType(fields.validator),
			epoch: BigInt(fields.epoch),
			suiStakeAmount: BigInt(fields.sui_amount),
			validatorFee: FixedUtils.directCast(BigInt(fields.validator_fee)),
			isRestaked: fields.is_restaked,
			referrer: fields.referrer ? fields.referrer : undefined,
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
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			paybackCoinId: Helpers.addLeadingZeroesToType(
				fields.payback_coin_id
			),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
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
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			staker: Helpers.addLeadingZeroesToType(fields.staker),
			epoch: BigInt(fields.epoch),
			afSuiMintAmount: BigInt(fields.minted_afsui_amount),
			suiStakeAmount: BigInt(fields.staked_sui_amount),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	// =========================================================================
	//  Indexer Events
	// =========================================================================

	public static stakeRequestEventFromIndexerOnChain = (
		eventOnChain: StakeRequestIndexerEventOnChain
	): StakeRequestEvent => {
		return {
			suiId: Helpers.addLeadingZeroesToType(eventOnChain.sui_id),
			stakedSuiId: Helpers.addLeadingZeroesToType(
				eventOnChain.staked_sui_id
			),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			validatorAddress: Helpers.addLeadingZeroesToType(
				eventOnChain.validator
			),
			epoch: BigInt(eventOnChain.epoch),
			suiStakeAmount: BigInt(eventOnChain.sui_amount),
			validatorFee: FixedUtils.directCast(
				BigInt(eventOnChain.validator_fee)
			),
			isRestaked: eventOnChain.is_restaked,
			referrer: eventOnChain.referrer ? eventOnChain.referrer : undefined,
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeEventFromIndexerOnChain = (
		eventOnChain: UnstakeIndexerEventOnChain
	): UnstakeEvent => {
		return {
			afSuiId: Helpers.addLeadingZeroesToType(eventOnChain.afsui_id),
			paybackCoinId: Helpers.addLeadingZeroesToType(
				eventOnChain.payback_coin_id
			),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			epoch: BigInt(eventOnChain.epoch),
			afSuiAmountGiven: BigInt(eventOnChain.provided_afsui_amount),
			suiUnstakeAmount: BigInt(eventOnChain.withdrawn_sui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};

	public static afSuiMintedEventFromIndexerOnChain = (
		eventOnChain: AfSuiMintedIndexerEventOnChain
	): AfSuiMintedEvent => {
		return {
			suiId: Helpers.addLeadingZeroesToType(eventOnChain.sui_id),
			staker: Helpers.addLeadingZeroesToType(eventOnChain.staker),
			epoch: BigInt(eventOnChain.epoch),
			afSuiMintAmount: BigInt(eventOnChain.minted_afsui_amount),
			suiStakeAmount: BigInt(eventOnChain.staked_sui_amount),
			timestamp: eventOnChain.timestamp ?? undefined,
			txnDigest: eventOnChain.txnDigest,
			type: eventOnChain.type,
		};
	};
}

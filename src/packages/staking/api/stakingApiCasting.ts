import {
	ValidatorConfigObject,
	ValidatorOperationCapObject,
	UnstakedEvent,
	UnstakeRequestedEvent,
	StakedEvent,
	EpochWasChangedEvent,
	StakedSuiVaultStateObject,
	ObjectId,
	SuiAddress,
	AnyObjectType,
	IFixedAsString,
} from "../../../types";
import {
	EpochWasChangedEventOnChain,
	StakedEventOnChain,
	StakedSuiVaultStateV1FieldsOnChain,
	UnstakeRequestedEventOnChain,
	UnstakedEventOnChain,
	ValidatorOperationCapFieldsOnChain,
} from "./stakingApiCastingTypes";
import {
	GrpcCasting,
	Helpers,
	type SuiObjectView,
} from "../../../general/utils";
import { FixedUtils } from "../../../general/utils/fixedUtils";

export class StakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static validatorOperationCapObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): ValidatorOperationCapObject => {
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as ValidatorOperationCapFieldsOnChain;

		return {
			objectType,
			objectId: Helpers.getObjectId(data),
			authorizerValidatorAddress: Helpers.addLeadingZeroesToType(
				fields.authorizer_validator_address
			),
		};
	};

	public static stakedSuiVaultStateObjectFromSuiObjectResponse = (
		data: SuiObjectView
	): StakedSuiVaultStateObject => {
		const objectId = Helpers.getObjectId(data);
		const objectType = Helpers.getObjectType(data);
		const fields = Helpers.getObjectFields(
			data
		) as StakedSuiVaultStateV1FieldsOnChain;

		// @dev: the deepest nested read in the SDK. JSON-RPC wrapped every nested
		// struct in `{ type, fields }`; gRPC's `json` view returns them bare. Unwrap
		// at **every** level — `protocol_config` and, inside it,
		// `atomic_unstake_protocol_fee`. A missed level reads `undefined` and
		// `BigInt(undefined)` throws, but a missed level on a *sibling* read would
		// not, so both levels are asserted in `tests/objectCasters.test.ts`.
		const protocolConfig = GrpcCasting.unwrapStructField(
			fields.protocol_config
		);
		const atomicUnstakeProtocolFee = GrpcCasting.unwrapStructField(
			protocolConfig.atomic_unstake_protocol_fee
		);

		return {
			objectId,
			objectType,
			atomicUnstakeSuiReservesTargetValue: BigInt(
				protocolConfig.atomic_unstake_sui_reserves_target_value
			),
			atomicUnstakeSuiReserves: BigInt(fields.atomic_unstake_sui_reserves),
			minAtomicUnstakeFee: BigInt(atomicUnstakeProtocolFee.min_fee),
			maxAtomicUnstakeFee: BigInt(atomicUnstakeProtocolFee.max_fee),
			totalSuiAmount: BigInt(fields.total_sui_amount),
			totalRewardsAmount: BigInt(fields.total_rewards_amount),
			activeEpoch: BigInt(fields.active_epoch),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static stakedEventFromOnChain = (
		eventOnChain: StakedEventOnChain
	): StakedEvent => {
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
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			afSuiAmount: BigInt(fields.afsui_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakedEventFromOnChain = (
		eventOnChain: UnstakedEventOnChain
	): UnstakedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			suiId: Helpers.addLeadingZeroesToType(fields.sui_id),
			requester: Helpers.addLeadingZeroesToType(fields.requester),
			epoch: BigInt(fields.epoch),
			providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
			returnedSuiAmount: BigInt(fields.returned_sui_amount),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeRequestedEventFromOnChain = (
		eventOnChain: UnstakeRequestedEventOnChain
	): UnstakeRequestedEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			afSuiId: Helpers.addLeadingZeroesToType(fields.afsui_id),
			providedAfSuiAmount: BigInt(fields.provided_afsui_amount),
			requester: Helpers.addLeadingZeroesToType(fields.requester),
			epoch: BigInt(fields.epoch),
			timestamp: Number(eventOnChain.timestampMs),
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

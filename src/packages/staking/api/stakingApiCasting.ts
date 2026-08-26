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

/**
 * Converts staking object and event responses into the SDK's normalized types.
 *
 * These static methods perform local parsing only. They accept the transport
 * shapes used by the Sui object and event clients, convert decimal integer
 * strings to `bigint`, normalize addresses, and convert 18-decimal validator
 * fees to decimal ratios. They do not perform network I/O.
 */
export class StakingApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	/**
	 * Casts a validator operation-cap object response to its normalized shape.
	 *
	 * The caster reads `authorizer_validator_address` from the Move fields and
	 * expands it to the SDK's normalized Sui address format.
	 *
	 * @param data - Sui object response containing validator operation-cap fields.
	 * @returns The normalized `ValidatorOperationCapObject`.
	 * @throws Errors from object-field or address parsing when the response shape
	 * is incomplete or malformed.
	 */
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

	/**
	 * Casts a stakedSui vault state object response to its normalized shape.
	 *
	 * The caster accepts both bare gRPC JSON fields and JSON-RPC-style nested
	 * `{ type, fields }` structs. It returns raw balances and epochs as `bigint`
	 * and preserves atomic-unstake fees as 18-decimal fixed-point `bigint`s.
	 *
	 * @param data - Sui object response containing `StakedSuiVaultStateV1` fields.
	 * @returns The normalized `StakedSuiVaultStateObject`.
	 * @throws When a required nested field is missing or a numeric field cannot
	 * be converted to `bigint`.
	 */
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

	/**
	 * Casts an on-chain `StakedEvent` to the normalized `StakedEvent` type.
	 *
	 * Decimal amount and epoch strings become `bigint`, the validator fee's
	 * 18-decimal fixed-point value becomes a decimal ratio, and a nullable
	 * on-chain referrer becomes an omitted value when it is `null`.
	 *
	 * @param eventOnChain - Event envelope with a parsed staking payload.
	 * @returns The normalized staking event, including timestamp and transaction digest.
	 * @throws When a required address or numeric event field cannot be parsed.
	 */
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

	/**
	 * Casts a completed on-chain unstake event to `UnstakedEvent`.
	 *
	 * The afSUI and SUI amounts and epoch become `bigint`; address fields are
	 * normalized; `timestampMs` becomes the event timestamp number.
	 *
	 * @param eventOnChain - Event envelope with a parsed completed-unstake payload.
	 * @returns The normalized completed-unstake event.
	 * @throws When a required address or numeric event field cannot be parsed.
	 */
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

	/**
	 * Casts a queued on-chain unstake request to `UnstakeRequestedEvent`.
	 *
	 * The afSUI amount and epoch become `bigint`; address fields are normalized;
	 * `timestampMs` becomes the event timestamp number. A request has no returned
	 * SUI coin or amount.
	 *
	 * @param eventOnChain - Event envelope with a parsed request payload.
	 * @returns The normalized queued-unstake event.
	 * @throws When a required address or numeric event field cannot be parsed.
	 */
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

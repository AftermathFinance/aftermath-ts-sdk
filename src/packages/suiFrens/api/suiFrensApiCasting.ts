import {
	SuiObjectResponse,
	getObjectDisplay,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	MixSuiFrensEvent,
	StakeSuiFrenEvent,
	StakedSuiFrenMetadataV1Object,
	UnstakeSuiFrenEvent,
	SuiFrenObject,
	SuiFrenAttributes,
	CapyLabsAppObject,
	SuiFrenVaultStateV1Object,
	SuiFrenAccessoryObject,
} from "../suiFrensTypes";
import {
	MixSuiFrensEventOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
	SuiFrenFieldsOnChain,
	SuiFrenDisplayOnChain,
	CapyLabsAppFieldsOnChain,
	SuiFrenAccessoryDisplayOnChain,
	SuiFrenAccessoryFieldsOnChain,
	StakedSuiFrenMetadataV1FieldsOnChain,
	SuiFrenVaultStateV1FieldsOnChain,
} from "./suiFrensApiCastingTypes";

export class SuiFrensApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static capyLabsAppObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): CapyLabsAppObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(data) as CapyLabsAppFieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			mixingLimit: BigInt(fields.mixing_limit),
			coolDownPeriodEpochs: BigInt(fields.cool_down_period),
			mixingPrice: BigInt(fields.mixing_price),
			suiProfits: BigInt(fields.profits),
		};
	};

	public static partialSuiFrenObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): Omit<SuiFrenObject, "mixLimit" | "lastEpochMixed"> => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(data) as SuiFrenFieldsOnChain;
		const display = getObjectDisplay(data)
			.data as unknown as SuiFrenDisplayOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			generation: BigInt(fields.generation),
			birthdate: Number(fields.birthdate),
			cohort: BigInt(fields.cohort),
			genes: fields.genes.map((gene) => BigInt(gene)),
			attributes: {
				skin: fields.attributes[0],
				mainColor: fields.attributes[1],
				secondaryColor: fields.attributes[2],
				expression: fields.attributes[3],
				ears: fields.attributes[4],
			} as SuiFrenAttributes,
			birthLocation: fields.birth_location,
			display: {
				link: display.link,
				imageUrl: display.image_url,
				description: display.description,
				projectUrl: display.project_url,
			},
		};
	};

	public static stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakedSuiFrenMetadataV1Object => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(
			data
		) as StakedSuiFrenMetadataV1FieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			suiFrenId: fields.suifren_id,
			collectedFees: BigInt(fields.collected_fees),
			autoStakeFees: fields.auto_stake_fees,
			mixFee: BigInt(fields.mix_fee),
			feeIncrementPerMix: BigInt(fields.fee_increment_per_mix),
			minRemainingMixesToKeep: BigInt(fields.min_remaining_mixes_to_keep),

			// TOOD: create suifren from info below

			// lastEpochMixed: BigInt(fields.last_epoch_mixed),
			// generation: BigInt(fields.generation),
			// birthdate: BigInt(fields.birthdate),
			// cohort: BigInt(fields.cohort),
			// genes: BigInt(fields.genes),
			// birthLocation: fields.birth_location,
			// attributes: fields.attributes,
		};
	};

	public static suiFrenVaultStateV1ObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): SuiFrenVaultStateV1Object => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(
			data
		) as SuiFrenVaultStateV1FieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			totalMixes: BigInt(fields.mixed),
		};
	};

	public static accessoryObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): SuiFrenAccessoryObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(data) as SuiFrenAccessoryFieldsOnChain;
		const display = getObjectDisplay(data)
			.data as unknown as SuiFrenAccessoryDisplayOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			name: fields.name,
			type: fields.type,
			imageUrl: display.image_url,
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static mixSuiFrensEventFromOnChain = (
		eventOnChain: MixSuiFrensEventOnChain
	): MixSuiFrensEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			mixer: eventOnChain.mixer,
			parentOneId: fields.parent_one_id,
			parentTwoId: fields.parent_two_id,
			childId: fields.child_id,
			fee: BigInt(fields.fee),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static stakeSuiFrenEventFromOnChain = (
		eventOnChain: StakeSuiFrenEventOnChain
	): StakeSuiFrenEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			staker: fields.issuer,
			suiFrenId: fields.suifren_id,
			// TODO: generalize casting of event types with passing of
			// timestamp and txnDigest (create wrapper)
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static unstakeSuiFrenEventFromOnChain = (
		eventOnChain: UnstakeSuiFrenEventOnChain
	): UnstakeSuiFrenEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			unstaker: fields.issuer,
			suiFrenId: fields.suifren_id,
			fees: BigInt(fields.fees),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

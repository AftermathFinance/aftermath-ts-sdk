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
	SuiFrenAttributes,
	CapyLabsAppObject,
	SuiFrenVaultStateV1Object,
	SuiFrenAccessoryObject,
	HarvestSuiFrenFeesEvent,
	PartialSuiFrenObject,
	StakedSuiFrenPositionObject,
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
	HarvestSuiFrenFeesEventOnChain,
	StakedSuiFrenPositionFieldsOnChain,
} from "./suiFrensApiCastingTypes";
import { Helpers } from "../../../general/utils";
import { Coin } from "../..";

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
	): PartialSuiFrenObject => {
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

	public static partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse =
		(data: SuiObjectResponse): PartialSuiFrenObject => {
			const fields = getObjectFields(
				data
			) as StakedSuiFrenMetadataV1FieldsOnChain;
			const display = getObjectDisplay(data)
				.data as unknown as SuiFrenDisplayOnChain;

			return {
				objectType: "TODO",
				objectId: fields.suifren_id,
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
		};
	};

	public static partialSuiFrenAndStakedSuiFrenMetadataV1ObjectFromSuiObjectResponse =
		(
			data: SuiObjectResponse
		): {
			stakedSuiFrenMetadata: StakedSuiFrenMetadataV1Object;
			partialSuiFren: PartialSuiFrenObject;
		} => {
			return {
				stakedSuiFrenMetadata:
					this.stakedSuiFrenMetadataV1ObjectFromSuiObjectResponse(
						data
					),
				partialSuiFren:
					this.partialSuiFrenObjectFromStakedSuiFrenMetadataV1ObjectSuiObjectResponse(
						data
					),
			};
		};

	public static stakedSuiFrenPositionFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakedSuiFrenPositionObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const fields = getObjectFields(
			data
		) as StakedSuiFrenPositionFieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			suiFrenId: fields.suifren_id,
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
			stakedSuiFrens: BigInt(fields.suifrens_metadata.fields.size),
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

	public static harvestSuiFrenFeesEventFromOnChain = (
		eventOnChain: HarvestSuiFrenFeesEventOnChain
	): HarvestSuiFrenFeesEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			harvester: fields.issuer,
			fees: BigInt(fields.fees),
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static mixSuiFrensEventFromOnChain = (
		eventOnChain: MixSuiFrensEventOnChain
	): MixSuiFrensEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			mixer: fields.issuer,
			// parentOneId: fields.parent_one_id,
			// parentTwoId: fields.parent_two_id,
			parentOneId: "0x123",
			parentTwoId: "0x321",
			childId: fields.suifren_id,
			// fee: BigInt(fields.fee),
			fee: BigInt(0),
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

import {
	SuiObjectResponse,
	getObjectDisplay,
	getObjectFields,
	getObjectId,
	getObjectType,
} from "@mysten/sui.js";
import {
	MixSuiFrensEvent,
	SuiFrenBornEvent,
	StakeSuiFrenEvent,
	StakedSuiFrenMetadataV1Object,
	UnstakeSuiFrenEvent,
	SuiFrenObject,
	SuiFrenAttributes,
	CapyLabsAppObject,
	SuiFrenVaultObject,
} from "../suiFrensTypes";
import {
	MixSuiFrenEventOnChain,
	SuiFrenBornEventOnChain,
	SuiFrenVaultFieldsOnChain,
	StakeSuiFrenEventOnChain,
	UnstakeSuiFrenEventOnChain,
	SuiFrenFieldsOnChain,
	SuiFrenDisplayOnChain,
	CapyLabsAppFieldsOnChain,
} from "./suiFrensApiCastingTypes";
import { SuiFrens } from "../suiFrens";

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
				name: display.name,
				link: display.link,
				imageUrl: display.image_url,
				description: display.description,
				projectUrl: display.project_url,
			},
		};
	};

	public static stakedSuiFrenReceiptObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
		// ): { metadata: StakedSuiFrenMetadataV1Object; suiFren: SuiFren } => {
	): StakedSuiFrenMetadataV1Object => {
		throw new Error("TODO");

		// const objectType = getObjectType(data);
		// if (!objectType) throw new Error("no object type found");

		// const objectFields = getObjectFields(
		// 	data
		// ) as StakedSuiFrenReceiptFieldsOnChain;

		// return {
		// 	objectType,
		// 	objectId: getObjectId(data),
		// 	suiFrenId: objectFields.suiFren_id,
		// 	unlockEpoch: objectFields.unlock_epoch.fields,
		// };
	};

	// public static stakedSuiFrenReceiptWithSuiFrenObjectFromSuiObjectResponse = async (
	// 	data: SuiObjectResponse
	// ): Promise<StakedSuiFrenReceiptWithSuiFrenObject> => {
	// 	const objectFields = getObjectFields(data) as StakedSuiFrenReceiptFieldsOnChain;

	// 	return {
	// 		objectId: getObjectId(data),
	// 		suiFren: this.suiFrenObjectFromSuiObjectResponse(
	// 			await provider.getObject(objectFields.suiFren_id)
	// 		),
	// 		unlockEpoch: objectFields.unlock_epoch.fields,
	// 	};
	// };

	public static suiFrenVaultObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): SuiFrenVaultObject => {
		const objectType = getObjectType(data);
		if (!objectType) throw new Error("no object type found");

		const objectFields = getObjectFields(data) as SuiFrenVaultFieldsOnChain;

		return {
			objectType,
			objectId: getObjectId(data),
			bredSuiFrens: BigInt(objectFields.bred_suiFrens),
			stakedSuiFrens: BigInt(objectFields.staked_suiFrens),
			globalFees: BigInt(objectFields.global_fees),
		};
	};

	// =========================================================================
	//  Events
	// =========================================================================

	public static suiFrenBornEventFromOnChain = (
		eventOnChain: SuiFrenBornEventOnChain
	): SuiFrenBornEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			mixer: fields.bred_by,
			suiFrenParentOneId: fields.parent_one,
			suiFrenParentTwoId: fields.parent_two,
			suiFrenChildId: fields.id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static mixSuiFrensEventFromOnChain = (
		eventOnChain: MixSuiFrenEventOnChain
	): MixSuiFrensEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			mixer: eventOnChain.sender,
			suiFrenParentOneId: fields.parentOneId,
			suiFrenParentTwoId: fields.parentTwoId,
			suiFrenChildId: fields.id,
			feeCoinWithBalance: {
				coin: SuiFrens.constants.mixingFeeCoinType,
				balance: BigInt(fields.fee),
			},
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
			suiFrenId: fields.suiFren_id,
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
			suiFrenId: fields.suiFren_id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};
}

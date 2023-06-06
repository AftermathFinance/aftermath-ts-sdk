import {
	SuiObjectResponse,
	getObjectFields,
	getObjectId,
} from "@mysten/sui.js";
import {
	BreedSuiFrensEvent,
	SuiFrenBornEvent,
	SuiFrenObject,
	SuiFrenVaultObject,
	StakeSuiFrenEvent,
	StakedSuiFrenReceiptObject,
	UnstakeSuiFrenEvent,
} from "../suiFrensTypes";
import {
	BreedSuiFrenEventOnChain as BreedSuiFrensEventOnChain,
	SuiFrenBornEventOnChain,
	SuiFrenFieldsOnChain,
	SuiFrenVaultFieldsOnChain,
	StakeSuiFrenEventOnChain,
	StakedSuiFrenReceiptFieldsOnChain,
	UnstakeSuiFrenEventOnChain,
} from "./suiFrensApiCastingTypes";
import { SuiFrens } from "../suiFrens";

export class SuiFrensApiCasting {
	// =========================================================================
	//  Objects
	// =========================================================================

	public static suiFrenObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): SuiFrenObject => {
		const suiFrenObjectFields = getObjectFields(data) as SuiFrenFieldsOnChain;
		return {
			objectId: getObjectId(data),
			fields: {
				gen: suiFrenObjectFields.gen,
				url: suiFrenObjectFields.url,
				link: suiFrenObjectFields.link,
				genes: suiFrenObjectFields.genes.fields,
				devGenes: suiFrenObjectFields.dev_genes.fields,
				itemCount: suiFrenObjectFields.item_count,
				attributes: suiFrenObjectFields.attributes.map(
					(attr) => attr.fields
				),
			},
		};
	};

	public static stakedSuiFrenReceiptObjectFromSuiObjectResponse = (
		data: SuiObjectResponse
	): StakedSuiFrenReceiptObject => {
		const objectFields = getObjectFields(
			data
		) as StakedSuiFrenReceiptFieldsOnChain;
		return {
			objectId: getObjectId(data),
			suiFrenId: objectFields.suiFren_id,
			unlockEpoch: objectFields.unlock_epoch.fields,
		};
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
		const objectFields = getObjectFields(data) as SuiFrenVaultFieldsOnChain;

		return {
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
			breeder: fields.bred_by,
			suiFrenParentOneId: fields.parent_one,
			suiFrenParentTwoId: fields.parent_two,
			suiFrenChildId: fields.id,
			timestamp: eventOnChain.timestampMs,
			txnDigest: eventOnChain.id.txDigest,
			type: eventOnChain.type,
		};
	};

	public static breedSuiFrensEventFromOnChain = (
		eventOnChain: BreedSuiFrensEventOnChain
	): BreedSuiFrensEvent => {
		const fields = eventOnChain.parsedJson;
		return {
			breeder: eventOnChain.sender,
			suiFrenParentOneId: fields.parentOneId,
			suiFrenParentTwoId: fields.parentTwoId,
			suiFrenChildId: fields.id,
			feeCoinWithBalance: {
				coin: SuiFrens.constants.breedingFees.coinType,
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

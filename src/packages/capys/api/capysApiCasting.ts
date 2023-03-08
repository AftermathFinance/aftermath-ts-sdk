import {
	GetObjectDataResponse,
	getObjectFields,
	getObjectId,
} from "@mysten/sui.js";
import {
	BreedCapysEvent,
	CapyBornEvent,
	CapyObject,
	CapyVaultObject,
	StakeCapyEvent,
	StakedCapyReceiptObject,
	UnstakeCapyEvent,
} from "../capysTypes";
import {
	BreedCapyEventOnChain,
	CapyBornEventOnChain,
	CapyFieldsOnChain,
	CapyVaultFieldsOnChain,
	StakeCapyEventOnChain,
	StakedCapyReceiptFieldsOnChain,
	UnstakeCapyEventOnChain,
} from "./capysApiCastingTypes";
import { Capys } from "../capys";

export class CapysApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Objects
	/////////////////////////////////////////////////////////////////////

	public static capyObjectFromGetObjectDataResponse = (
		data: GetObjectDataResponse
	): CapyObject => {
		const capyObjectFields = getObjectFields(data) as CapyFieldsOnChain;
		return {
			objectId: getObjectId(data),
			fields: {
				gen: capyObjectFields.gen,
				url: capyObjectFields.url,
				link: capyObjectFields.link,
				genes: capyObjectFields.genes.fields,
				devGenes: capyObjectFields.dev_genes.fields,
				itemCount: capyObjectFields.item_count,
				attributes: capyObjectFields.attributes.map(
					(attr) => attr.fields
				),
			},
		};
	};

	public static stakedCapyReceiptObjectFromGetObjectDataResponse = (
		data: GetObjectDataResponse
	): StakedCapyReceiptObject => {
		const objectFields = getObjectFields(
			data
		) as StakedCapyReceiptFieldsOnChain;
		return {
			objectId: getObjectId(data),
			capyId: objectFields.capy_id,
			unlockEpoch: objectFields.unlock_epoch.fields,
		};
	};

	// public static stakedCapyReceiptWithCapyObjectFromGetObjectDataResponse = async (
	// 	data: GetObjectDataResponse
	// ): Promise<StakedCapyReceiptWithCapyObject> => {
	// 	const objectFields = getObjectFields(data) as StakedCapyReceiptFieldsOnChain;

	// 	return {
	// 		objectId: getObjectId(data),
	// 		capy: this.capyObjectFromGetObjectDataResponse(
	// 			await provider.getObject(objectFields.capy_id)
	// 		),
	// 		unlockEpoch: objectFields.unlock_epoch.fields,
	// 	};
	// };

	public static capyVaultObjectFromGetObjectDataResponse = (
		data: GetObjectDataResponse
	): CapyVaultObject => {
		const objectFields = getObjectFields(data) as CapyVaultFieldsOnChain;

		return {
			objectId: getObjectId(data),
			bredCapys: BigInt(objectFields.bred_capys),
			stakedCapys: BigInt(objectFields.staked_capys),
			globalFees: BigInt(objectFields.global_fees),
		};
	};

	/////////////////////////////////////////////////////////////////////
	//// Events
	/////////////////////////////////////////////////////////////////////

	public static capyBornEventFromOnChain = (
		eventOnChain: CapyBornEventOnChain
	): CapyBornEvent => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			breeder: fields.bred_by,
			capyParentOneId: fields.parent_one,
			capyParentTwoId: fields.parent_two,
			capyChildId: fields.id,
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};

	public static breedCapyEventFromOnChain = (
		eventOnChain: BreedCapyEventOnChain
	): BreedCapysEvent => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			breeder: eventOnChain.event.moveEvent.sender,
			capyParentOneId: fields.parentOneId,
			capyParentTwoId: fields.parentTwoId,
			capyChildId: fields.id,
			feeCoinWithBalance: {
				coin: Capys.constants.breedingFees.coinType,
				balance: BigInt(fields.fee),
			},
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};

	public static stakeCapyEventFromOnChain = (
		eventOnChain: StakeCapyEventOnChain
	): StakeCapyEvent => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			staker: fields.issuer,
			capyId: fields.capy_id,
			// TODO: generalize casting of event types with passing of
			// timestamp and txnDigest (create wrapper)
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};

	public static unstakeCapyEventFromOnChain = (
		eventOnChain: UnstakeCapyEventOnChain
	): UnstakeCapyEvent => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			unstaker: fields.issuer,
			capyId: fields.capy_id,
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		};
	};
}
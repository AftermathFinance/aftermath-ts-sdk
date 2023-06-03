import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	BigIntAsString,
	CapyAttribute,
	CapyGenes,
	EpochTimeLock,
	Url,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface StakedCapyReceiptFieldsOnChain {
	capy_id: ObjectId;
	unlock_epoch: {
		fields: EpochTimeLock;
	};
}

export interface CapyVaultFieldsOnChain {
	bred_capys: BigIntAsString;
	staked_capys: BigIntAsString;
	global_fees: BigIntAsString;
}

export interface CapyFieldsOnChain {
	genes: {
		fields: CapyGenes;
	};
	dev_genes: {
		fields: CapyGenes;
	};
	attributes: {
		type: AnyObjectType;
		fields: CapyAttribute;
	}[];
	item_count: number;
	url: Url;
	link: Url;
	gen: number;
}

// =========================================================================
//  Events
// =========================================================================

export type CapyBornEventOnChain = EventOnChain<{
	bred_by: SuiAddress;
	id: ObjectId;
	parent_one: ObjectId;
	parent_two: ObjectId;
}>;

export type BreedCapyEventOnChain = EventOnChain<{
	id: ObjectId;
	parentOneId: ObjectId;
	parentTwoId: ObjectId;
	fee: BigIntAsString;
}>;

export type StakeCapyEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	capy_id: ObjectId;
}>;

export type UnstakeCapyEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	capy_id: ObjectId;
}>;

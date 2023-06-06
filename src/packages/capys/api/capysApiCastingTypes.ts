import { ObjectId, SuiAddress } from "@mysten/sui.js";
import {
	AnyObjectType,
	BigIntAsString,
	SuiFrenAttribute,
	SuiFrenGenes,
	EpochTimeLock,
	Url,
} from "../../../types";
import { EventOnChain } from "../../../general/types/castingTypes";

// =========================================================================
//  Objects
// =========================================================================

export interface StakedSuiFrenReceiptFieldsOnChain {
	suiFren_id: ObjectId;
	unlock_epoch: {
		fields: EpochTimeLock;
	};
}

export interface SuiFrenVaultFieldsOnChain {
	bred_suiFrens: BigIntAsString;
	staked_suiFrens: BigIntAsString;
	global_fees: BigIntAsString;
}

export interface SuiFrenFieldsOnChain {
	genes: {
		fields: SuiFrenGenes;
	};
	dev_genes: {
		fields: SuiFrenGenes;
	};
	attributes: {
		type: AnyObjectType;
		fields: SuiFrenAttribute;
	}[];
	item_count: number;
	url: Url;
	link: Url;
	gen: number;
}

// =========================================================================
//  Events
// =========================================================================

export type SuiFrenBornEventOnChain = EventOnChain<{
	bred_by: SuiAddress;
	id: ObjectId;
	parent_one: ObjectId;
	parent_two: ObjectId;
}>;

export type BreedSuiFrenEventOnChain = EventOnChain<{
	id: ObjectId;
	parentOneId: ObjectId;
	parentTwoId: ObjectId;
	fee: BigIntAsString;
}>;

export type StakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suiFren_id: ObjectId;
}>;

export type UnstakeSuiFrenEventOnChain = EventOnChain<{
	issuer: SuiAddress;
	suiFren_id: ObjectId;
}>;

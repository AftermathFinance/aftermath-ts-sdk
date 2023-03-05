import { ObjectId, SuiAddress } from "@mysten/sui.js";
import { Balance } from "./generalTypes";

/////////////////////////////////////////////////////////////////////
//// Network
/////////////////////////////////////////////////////////////////////

// TODO: change this once mainnet is live
// also is this deprecated within mysten's sui js ?
export type SuiNetwork = "DEVNET" | "TESTNET" | "LOCAL";
export type SuiNetworkOrNone = SuiNetwork | "NONE";

/////////////////////////////////////////////////////////////////////
//// Objects
/////////////////////////////////////////////////////////////////////

export interface ObjectTable<K, V> {
	objectId: ObjectId;
	size: number;
}
export interface Table<K, V> {
	objectId: ObjectId;
	size: number;
}

export interface SuiBalance {
	objectId: ObjectId;
	value: Balance;
}

export interface EpochTimeLock {
	epoch: EpochTimeStamp;
}

export interface StakedSui {
	objectId: ObjectId;
	validatorAddress: SuiAddress;
	poolStartingEpoch: number;
	delegationRequestEpoch: number;
	principal: Balance;
}

export interface Delegation {
	objectId: ObjectId;
	stakedSuiId: ObjectId;
	poolTokens: Balance;
	principalSuiAmount: Balance;
}

export interface StakedSuiWithDelegation {
	stakedSui: StakedSui;
	delegation?: Delegation;
}

export interface AuthorityPublicKeyBytes {
	pubKey: string;
	bytes: bigint;
}

export interface CommitteeInfo {
	committeeInfo: AuthorityPublicKeyBytes[];
	epoch: EpochTimeStamp;
}

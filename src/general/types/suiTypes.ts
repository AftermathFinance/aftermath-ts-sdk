import { Balance, ObjectId } from "./generalTypes";

// =========================================================================
//  Network
// =========================================================================

export type SuiNetwork = "DEVNET" | "TESTNET" | "LOCAL" | "MAINNET";

// =========================================================================
//  Objects
// =========================================================================

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

// export interface StakedSui {
// 	objectId: ObjectId;
// 	validatorAddress: SuiAddress;
// 	poolStartingEpoch: number;
// 	delegationRequestEpoch: number;
// 	principal: Balance;
// }

// export interface Delegation {
// 	objectId: ObjectId;
// 	stakedSuiId: ObjectId;
// 	poolTokens: Balance;
// 	principalSuiAmount: Balance;
// }

// export interface StakedSuiWithDelegation {
// 	stakedSui: StakedSui;
// 	delegation?: Delegation;
// }

// export interface AuthorityPublicKeyBytes {
// 	pubKey: string;
// 	bytes: bigint;
// }

// export interface CommitteeInfo {
// 	committeeInfo: AuthorityPublicKeyBytes[];
// 	epoch: EpochTimeStamp;
// }

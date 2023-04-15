import { ObjectId, SuiAddress } from "@mysten/sui.js";

/////////////////////////////////////////////////////////////////////
//// Name Only
/////////////////////////////////////////////////////////////////////

export type RpcEndpoint = string;

/////////////////////////////////////////////////////////////////////
//// All Addresses
/////////////////////////////////////////////////////////////////////

export type ConfigAddresses = RequiredConfigAddresses &
	Partial<OptionalConfigAddresses>;

interface RequiredConfigAddresses {}

interface OptionalConfigAddresses {
	faucet: FaucetAddresses;
	staking: StakingAddresses;
	pools: PoolsAddresses;
	utilies: UtilitiesAddresses;
	capys: CapysAddresses;
	nftAmm: NftAmmAddresses;
}

/////////////////////////////////////////////////////////////////////
//// Addresses By Package
/////////////////////////////////////////////////////////////////////

export interface FaucetAddresses {
	packages: {
		faucet: SuiAddress;
	};
	objects: {
		faucet: ObjectId;
		faucetRegistry: ObjectId;
	};
}

export interface StakingAddresses {
	packages: {
		liquidStakingDerivative: SuiAddress;
	};
}

export interface PoolsAddresses {
	packages: {
		cmmm: SuiAddress;
	};
	objects: {
		poolRegistry: ObjectId;
		protocolFeeVault: ObjectId;
		treasury: ObjectId;
		insuranceFund: ObjectId;
	};
}

export interface UtilitiesAddresses {
	packages: {
		utilities: SuiAddress;
	};
}

export interface CapysAddresses {
	packages: {
		capy: SuiAddress;
		capyVault: SuiAddress;
	};
	objects: {
		capyVault: ObjectId;
		capyRegistry: ObjectId;
	};
}

export interface NftAmmAddresses {
	packages: {};
	objects: {};
}

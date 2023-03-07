import { ObjectId, SuiAddress } from "@mysten/sui.js";

/////////////////////////////////////////////////////////////////////
//// All Addresses
/////////////////////////////////////////////////////////////////////

export interface ConfigAddresses {
	faucet: FaucetAddresses;
	staking: StakingAddresses;
	pools: PoolsAddresses;
	utilies: UtilitiesAddresses;
	capys: CapysAddresses;
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

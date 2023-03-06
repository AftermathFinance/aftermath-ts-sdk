import { ObjectId, SuiAddress } from "@mysten/sui.js";

/////////////////////////////////////////////////////////////////////
//// Addresses
/////////////////////////////////////////////////////////////////////

export interface ConfigAddresses {
	capys: {
		packages: {
			capy: SuiAddress;
			capyVault: SuiAddress;
		};
		objects: {
			capyVault: ObjectId;
			capyRegistry: ObjectId;
		};
	};
	utilies: {
		packages: {
			utilities: SuiAddress;
		};
	};
	pools: {
		packages: {
			cmmm: SuiAddress;
		};
	};
	faucet: {
		packages: {
			faucet: SuiAddress;
		};
		objects: {
			faucet: ObjectId;
			faucetRegistry: ObjectId;
		};
	};
	staking: {
		packages: {
			liquidStakingDerivative: SuiAddress;
		};
	};
}

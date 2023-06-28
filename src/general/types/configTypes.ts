import { ObjectId, SuiAddress } from "@mysten/sui.js";

// =========================================================================
//  Name Only
// =========================================================================

export type RpcEndpoint = string;

// =========================================================================
//  All Addresses
// =========================================================================

export type ConfigAddresses = RequiredConfigAddresses &
	Partial<OptionalConfigAddresses>;

interface RequiredConfigAddresses {}

interface OptionalConfigAddresses {
	faucet: FaucetAddresses;
	staking: StakingAddresses;
	pools: PoolsAddresses;
	utilies: UtilitiesAddresses;
	suiFrens: SuiFrensAddresses;
	nftAmm: NftAmmAddresses;
	router: RouterAddresses;
	referralVault: ReferralVaultAddresses;
	perpetuals: PerpetualsAddresses;
}

// =========================================================================
//  Addresses By Package
// =========================================================================

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
		lsd: SuiAddress;
		afsui: SuiAddress;
	};
	objects: {
		staking: ObjectId;
	};
	accounts: {
		bot: SuiAddress;
	};
}

export interface PoolsAddresses {
	packages: {
		amm: SuiAddress;
		ammInterface: SuiAddress;
		events: SuiAddress;
	};
	objects: {
		poolRegistry: ObjectId;
		protocolFeeVault: ObjectId;
		treasury: ObjectId;
		insuranceFund: ObjectId;
		lpCoinsTable: ObjectId;
	};
	other: {
		createLpCoinPackageCompilation: string;
	};
}

export interface UtilitiesAddresses {
	packages: {
		utilities: SuiAddress;
	};
}

export interface SuiFrensAddresses {
	packages: {
		suiFrens: SuiAddress;
		accessories: SuiAddress;
		suiFrensVault: SuiAddress;
		suiFrensVaultCapyLabsExtension: SuiAddress;
	};
	objects: {
		capyLabsApp: ObjectId;
		suiFrensVault: ObjectId;
		suiFrensVaultState: ObjectId;
		suiFrensVaultCapyLabsExtension: ObjectId;
	};
}

export interface NftAmmAddresses {
	packages: {
		nftAmm: SuiAddress;
	};
	objects: {
		protocolFeeVault: ObjectId;
		treasury: ObjectId;
		insuranceFund: ObjectId;
		referralVault: ObjectId;
	};
}

export type RouterAddresses = RequiredRouterAddresses &
	Partial<OptionalRouterAddresses>;

export interface RequiredRouterAddresses {
	packages: {
		utils: SuiAddress;
	};
}

export interface OptionalRouterAddresses {
	deepBook: DeepBookAddresses;
	cetus: CetusAddresses;
	turbos: TurbosAddresses;
	interest: InterestAddresses;
	kriya: KriyaAddresses;
	baySwap: BaySwapAddresses;
	suiswap: SuiswapAddresses;
	blueMove: BlueMoveAddresses;
	aftermath: AftermathRouterAddresses;
}

export interface DeepBookAddresses {
	packages: {
		clob: SuiAddress;
		wrapper: SuiAddress;
	};
}

export interface CetusAddresses {
	packages: {
		scripts: SuiAddress;
		clmm: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		globalConfig: ObjectId;
		poolsTable: ObjectId;
	};
}

export interface TurbosAddresses {
	packages: {
		clmm: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		versioned: ObjectId;
		poolsTable: ObjectId;
	};
}

export interface InterestAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		poolsBag: ObjectId;
		dexStorage: ObjectId;
	};
}

export interface KriyaAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
}

export interface BaySwapAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		poolsBag: ObjectId;
		globalStorage: ObjectId;
	};
}

export interface SuiswapAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
}

export interface BlueMoveAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		dexInfo: ObjectId;
		dexStableInfo: ObjectId;
	};
}

export interface AftermathRouterAddresses {
	packages: {
		wrapper: SuiAddress;
	};
}

export interface ReferralVaultAddresses {
	packages: {
		referralVault: SuiAddress;
	};
	objects: {
		referralVault: ObjectId;
	};
}

export interface PerpetualsAddresses {
	packages: {
		perpetuals: SuiAddress;
	};
	objects: {
		adminCapability: ObjectId;
		registry: ObjectId;
		exchanges: ExchangeAddresses[]; // Probably a Map<CoinType, ExchangeAddresses> is better
		oracle: OracleAddresses;
	};
}

export interface ExchangeAddresses {
	accountManager: ObjectId;
	marketManager: ObjectId;
	vault: ObjectId;
	insuranceFund: ObjectId;
}

export interface OracleAddresses {
	packages: {
		oracle: SuiAddress;
	};
	objects: {
		authorityCapability: ObjectId;
		priceFeedStorage: ObjectId;
	};
}

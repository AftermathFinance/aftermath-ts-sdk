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
		suiFrensGenesisWrapper: SuiAddress;
	};
	objects: {
		faucet: ObjectId;
		faucetRegistry: ObjectId;
		suiFrensMint: ObjectId;
	};
}

export interface StakingAddresses {
	packages: {
		lsd: SuiAddress;
		afsui: SuiAddress;
	};
	objects: {
		stakedSuiVault: ObjectId;
		safe: ObjectId;
		treasury: ObjectId;
		referralVault: ObjectId;
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
		suiFrensBullshark: SuiAddress;
		accessories: SuiAddress;
		suiFrensVault: SuiAddress;
		suiFrensVaultCapyLabsExtension: SuiAddress;
	};
	objects: {
		capyLabsApp: ObjectId;
		suiFrensVault: ObjectId;
		suiFrensVaultStateV1: ObjectId;
		suiFrensVaultStateV1MetadataTable: ObjectId;
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
	aftermath: AftermathRouterWrapperAddresses;
	deepBook: DeepBookAddresses;
	cetus: CetusAddresses;
	turbos: TurbosAddresses;
	flowX: FlowXAddresses;
	interest: InterestAddresses;
	kriya: KriyaAddresses;
	baySwap: BaySwapAddresses;
	suiswap: SuiswapAddresses;
	blueMove: BlueMoveAddresses;
}

export interface AftermathRouterWrapperAddresses {
	packages: {
		wrapper: SuiAddress;
	};
	objects: {
		wrapperApp: ObjectId;
	};
}

export interface DeepBookAddresses {
	packages: {
		clob: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		wrapperApp: ObjectId;
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
		wrapperApp: ObjectId;
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
		wrapperApp: ObjectId;
	};
}

export interface FlowXAddresses {
	packages: {
		wrapper: SuiAddress;
	};
	objects: {
		container: ObjectId;
		pairsBag: ObjectId;
		wrapperApp: ObjectId;
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
		wrapperApp: ObjectId;
	};
}

export interface KriyaAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		wrapperApp: ObjectId;
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
		wrapperApp: ObjectId;
	};
}

export interface SuiswapAddresses {
	packages: {
		dex: SuiAddress;
		wrapper: SuiAddress;
	};
	objects: {
		wrapperApp: ObjectId;
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
		wrapperApp: ObjectId;
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

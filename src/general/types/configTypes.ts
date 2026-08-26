import type { CoinDecimal } from "../../types";
import type { ObjectId, SuiAddress } from "./generalTypes";

// =========================================================================
//  Name Only
// =========================================================================

/** A URL string for an RPC endpoint used to access a Sui network. */
export type RpcEndpoint = string;

// =========================================================================
//  All Addresses
// =========================================================================

/**
 * Network-specific package and object addresses used by Aftermath providers.
 *
 * Each section is optional. Pass addresses for the same network as the
 * configured Sui client to `Aftermath.create({ addresses })` to skip address
 * discovery. A provider that requires an omitted section throws when it is
 * created.
 */
export interface ConfigAddresses {
	/** Addresses required by the faucet provider. */
	faucet?: FaucetAddresses;
	/** Addresses required by the liquid-staking provider. */
	staking?: StakingAddresses;
	/** Addresses required by the pool and AMM providers. */
	pools?: PoolsAddresses;
	/** Addresses required by DAO fee-pool operations. */
	daoFeePools?: DaoFeePoolsAddresses;
	/** Addresses required by the SuiFrens provider. */
	suiFrens?: SuiFrensAddresses;
	/** Addresses required by the NFT AMM provider. */
	nftAmm?: NftAmmAddresses;
	/** Addresses required by the smart router provider. */
	router?: RouterAddresses;
	/** Addresses required by the referral-vault provider. */
	referralVault?: ReferralVaultAddresses;
	/** Addresses required by the perpetuals provider. */
	perpetuals?: PerpetualsAddresses;
	/** Auxiliary compilation data used by perpetual-vault operations. */
	perpetualsVaults?: PerpetualsVaultsAddresses;
	/** Addresses required by the farms provider. */
	farms?: FarmsAddresses;
	/** Sponsor address used by dynamic-gas operations. */
	dynamicGas?: DynamicGasAddresses;
	/** Addresses required by Scallop integrations. */
	scallop?: ScallopAddresses;

	/** Addresses required by the dollar-cost-averaging provider. */
	dca?: DcaAddresses;
	/** Addresses required by the limit-orders provider. */
	limitOrders?: LimitAddresses;
	/** Shared-custody address and public-key configuration for multisig flows. */
	sharedCustody?: SharedCustodyAddresses;
	/** Package addresses required by NFT object queries. */
	nfts?: NftsAddresses;
}

// =========================================================================
//  Addresses By Package
// =========================================================================

/** Package and object addresses used by the faucet provider. */
export interface FaucetAddresses {
	/** Published Move package IDs used by faucet entry points. */
	packages: {
		/** Faucet package ID that exposes coin minting and administration calls. */
		faucet: SuiAddress;
		/** SuiFrens genesis-wrapper package ID used by SuiFren faucet calls. */
		suiFrensGenesisWrapper: SuiAddress;
	};
	/** Shared object IDs consumed by faucet transactions. */
	objects: {
		/** Faucet shared object used to mint configured coin amounts. */
		faucet: ObjectId;
		/** Faucet configuration shared object. */
		config: ObjectId;
		/** SuiFrens mint object used by SuiFren faucet calls. */
		suiFrensMint: ObjectId;
	};
}

/** Package and object addresses used by liquid-staking operations. */
export interface StakingAddresses {
	/** Published Move package IDs used by the staking contracts. */
	packages: {
		/** Liquid-staking package ID for stake and unstake entry points. */
		lsd: SuiAddress;
		/** AFSUI package ID used to construct the AFSUI coin type. */
		afsui: SuiAddress;
		/** Package ID that defines staking events and validator types. */
		events: SuiAddress;
	};
	/** Shared object IDs consumed by staking transactions. */
	objects: {
		/** Staked SUI vault shared object. */
		stakedSuiVault: ObjectId;
		/** Staked SUI vault state shared object. */
		stakedSuiVaultState: ObjectId;
		/** Staking safe shared object. */
		safe: ObjectId;
		/** Staking treasury shared object. */
		treasury: ObjectId;
		/** Referral-vault shared object used by staking transactions. */
		referralVault: ObjectId;
		/** Validator configuration table shared object. */
		validatorConfigsTable: ObjectId;
		/** Aftermath validator object used by staking and farms operations. */
		aftermathValidator: ObjectId;
	};
}

/** Package, object, and optional compilation addresses used by pool operations. */
export interface PoolsAddresses {
	/** Published Move package IDs used by the pool contracts. */
	packages: {
		/** AMM package ID used by pool transactions. */
		amm: SuiAddress;
		/** AMM interface package ID used by interface-compatible transactions. */
		ammInterface: SuiAddress;
		/** Package ID that defines the v1 pool and event types. */
		events: SuiAddress;
		/** Package ID that defines the v2 pool and event types. */
		eventsV2: SuiAddress;
	};
	/** Shared object IDs consumed by pool transactions. */
	objects: {
		/** Pool registry shared object. */
		poolRegistry: ObjectId;
		/** Protocol-fee vault shared object. */
		protocolFeeVault: ObjectId;
		/** Pool treasury shared object. */
		treasury: ObjectId;
		/** Pool insurance-fund shared object. */
		insuranceFund: ObjectId;
		/** LP-coin registry table shared object. */
		lpCoinsTable: ObjectId;
	};
	/** Optional data required to publish LP-coin packages. */
	other?: {
		/** JSON-serialized Move modules and dependencies keyed by LP-coin decimals. */
		createLpCoinPackageCompilations: Record<CoinDecimal, string>;
	};
}

/** Package and object addresses used by DAO fee-pool operations. */
export interface DaoFeePoolsAddresses {
	/** Published Move package IDs used by DAO fee-pool contracts. */
	packages: {
		/** DAO fee-pool AMM package ID. */
		amm: SuiAddress;
		/** Package ID that defines DAO fee-pool events and types. */
		events: SuiAddress;
	};
	/** Shared object IDs consumed by DAO fee-pool transactions. */
	objects: {
		/** DAO fee-pool version shared object. */
		version: ObjectId;
	};
}

/** Package and object addresses used by SuiFrens operations. */
export interface SuiFrensAddresses {
	/** Published Move package IDs used by SuiFrens contracts. */
	packages: {
		/** SuiFrens package ID that defines the base SuiFren type. */
		suiFrens: SuiAddress;
		/** Bullshark package ID used by SuiFrens type definitions. */
		suiFrensBullshark: SuiAddress;
		/** Accessories package ID used by SuiFren accessory operations. */
		accessories: SuiAddress;
		/** SuiFrens vault package ID used by staking operations. */
		suiFrensVault: SuiAddress;
		/** CapyLabs extension package ID for SuiFrens vault operations. */
		suiFrensVaultCapyLabsExtension: SuiAddress;
	};
	/** Shared object IDs consumed by SuiFrens transactions and queries. */
	objects: {
		/** CapyLabs application object. */
		capyLabsApp: ObjectId;
		/** SuiFrens vault shared object. */
		suiFrensVault: ObjectId;
		/** Version-one SuiFrens vault state object. */
		suiFrensVaultStateV1: ObjectId;
		/** Dynamic-field table containing version-one vault metadata. */
		suiFrensVaultStateV1MetadataTable: ObjectId;
		/** CapyLabs extension object for the SuiFrens vault. */
		suiFrensVaultCapyLabsExtension: ObjectId;
	};
}

/** Package and object addresses used by the NFT AMM provider. */
export interface NftAmmAddresses {
	/** Published Move package IDs used by NFT AMM contracts. */
	packages: {
		/** NFT AMM package ID used by buy, sell, and liquidity transactions. */
		nftAmm: SuiAddress;
	};
	/** Shared object IDs consumed by NFT AMM transactions. */
	objects: {
		/** Protocol-fee vault shared object. */
		protocolFeeVault: ObjectId;
		/** NFT AMM treasury shared object. */
		treasury: ObjectId;
		/** NFT AMM insurance-fund shared object. */
		insuranceFund: ObjectId;
		/** Referral-vault shared object used by NFT AMM transactions. */
		referralVault: ObjectId;
	};
}

/** Package addresses used by the smart router provider. */
export interface RouterAddresses {
	/** Published Move package IDs used by router contracts. */
	packages: {
		/** Router utility package ID used to build router targets. */
		utils: SuiAddress;
	};
}

/** Package and object addresses used by the referral-vault provider. */
export interface ReferralVaultAddresses {
	/** Published Move package IDs used by referral-vault contracts. */
	packages: {
		/** Referral-vault package ID used by referral transactions. */
		referralVault: SuiAddress;
	};
	/** Shared object IDs consumed by referral-vault transactions. */
	objects: {
		/** Referral-vault shared object. */
		referralVault: ObjectId;
	};
}

/** Package and object addresses used by perpetuals operations. */
export interface PerpetualsAddresses {
	/** Published Move package IDs used by perpetuals contracts. */
	packages: {
		// perpetuals: SuiAddress;
		/** Package ID that defines perpetuals events and account types. */
		events: SuiAddress;
	};
	/** Shared object IDs consumed by perpetuals operations. */
	objects: {
		/** Perpetuals registry object. */
		registry: ObjectId;
	};
}

/** Auxiliary compilation data used by perpetual-vault operations. */
export interface PerpetualsVaultsAddresses {
	/** Additional package-compilation data used by LP-coin publishing. */
	other: {
		/** Serialized Move package compilation for creating an LP-coin package. */
		createLpCoinPackageCompilation: string;
	};
}

/** Package and object addresses used by farms operations. */
export interface FarmsAddresses {
	/** Published Move package IDs used by the v1 and v2 farm contracts. */
	packages: {
		/** Published v1 vault package ID used by farms transactions and error mappings. */
		vaults: SuiAddress;
		/** Earlier v1 vault package ID used by legacy staking object types. */
		vaultsInitial: SuiAddress;
		/** Version-two vault package ID used by v2 staking operations. */
		vaultsV2: SuiAddress;
		/** Package ID that defines version-two farm events. */
		eventsV2: SuiAddress;
	};
	/** Shared object IDs consumed by farms transactions. */
	objects: {
		/** Farms version shared object. */
		version: ObjectId;
	};
}

/** Address configuration used by dynamic-gas sponsorship. */
export interface DynamicGasAddresses {
	/** Sui address of the account that sponsors dynamic-gas transactions. */
	sponsorAddress: SuiAddress;
}

/** Object addresses used by Scallop integrations. */
export interface ScallopAddresses {
	/** Shared object IDs consumed by Scallop operations. */
	objects: {
		/** Scallop version shared object. */
		version: ObjectId;
		/** afSUI market shared object. */
		afSuiMarket: ObjectId;
		/** Coin-decimals registry shared object. */
		coinDecimalsRegistry: ObjectId;
		/** Scallop xOracle shared object. */
		xOracle: ObjectId;
	};
}

/** Package and object addresses used by dollar-cost-averaging operations. */
export interface DcaAddresses {
	/** Published Move package IDs used by DCA contracts. */
	packages: {
		/** DCA package ID used by order transactions. */
		dca: SuiAddress;
		/** Package ID that defines version-one DCA events. */
		events: SuiAddress;
		/** Package ID that defines version-two DCA events. */
		eventsV2: SuiAddress;
	};
	/** Shared object IDs consumed by DCA transactions. */
	objects: {
		/** DCA configuration shared object. */
		readonly config: ObjectId;
	};
}

/** Package addresses used by limit-order operations. */
export interface LimitAddresses {
	/** Published Move package IDs used by limit-order contracts. */
	packages: {
		/** Limit-order package ID used by order transactions. */
		limitOrders: SuiAddress;
		/** Package ID that defines limit-order events. */
		events: SuiAddress;
	};
}

/** Shared-custody configuration used to derive Aftermath multisig keys. */
export interface SharedCustodyAddresses {
	/** Configured shared-custody Sui address or object ID. */
	address: ObjectId;
	/** Base64-encoded Ed25519 public key, including its Sui scheme flag byte. */
	publicKey: ObjectId;
}

/** Package addresses used by NFT object queries. */
export interface NftsAddresses {
	/** Published Move package IDs used by NFT object types. */
	packages: {
		/** Mysten transfer-policy package ID used to identify personal kiosks. */
		mystenTransferPolicy: SuiAddress;
	};
}

import process from "node:process";
import fs from "fs";
import YAML from "yaml";
import {
	FaucetAddresses,
	ObjectId,
	OracleAddresses,
	PerpetualsAddresses,
} from "../src/types.ts";

export function getConfigs(): [
	PerpetualsAddresses,
	FaucetAddresses,
	OracleAddresses
] {
	if (!process.env.RUST_CFG_PATH) {
		throw "RUST_CFG_PATH not set, set it to the path returned by the `config path` command of the Rust api";
	}
	const file = fs.readFileSync(process.env.RUST_CFG_PATH, "utf8");
	const rustCfg = YAML.parse(file) as RustAddresses;

	let exchanges = {};
	for (const value of Object.entries(rustCfg.perpetuals?.exchanges!)) {
		let [name, cfg] = value;
		exchanges[name] = {
			accountManager: cfg.account_manager,
			marketManager: cfg.market_manager,
			vault: cfg.vault,
			insuranceFunds: cfg.insurance_funds,
		};
	}

	let oracleCfg: OracleAddresses = {
		packages: {
			oracle: rustCfg.perpetuals?.oracle?.package!,
		},
		objects: {
			authorityCapability:
				rustCfg.perpetuals?.oracle?.authority_capability!,
			priceFeedStorage: rustCfg.perpetuals?.oracle?.price_feed_storage!,
		},
	};

	let perpetualsCfg: PerpetualsAddresses = {
		packages: {
			perpetuals: rustCfg.perpetuals?.package!,
			events: rustCfg.perpetuals?.package!,
		},
		objects: {
			adminCapability: rustCfg.perpetuals?.admin_capability!,
			registry: rustCfg.perpetuals?.registry!,
			exchanges,
		},
	};

	let faucetCfg = {
		packages: {
			faucet: rustCfg.faucet?.package_id!,
			suiFrensGenesisWrapper: "",
		},
		objects: {
			faucet: rustCfg.faucet?.faucet!,
			faucetRegistry: rustCfg.faucet?.faucet_registry!,
			suiFrensMint: "",
		},
	};

	return [perpetualsCfg, faucetCfg, oracleCfg];
}

// =========================================================================
//  Config used in the Rust SDK
// =========================================================================

export interface RustAddresses {
	faucet?: {
		package_id: ObjectId;
		faucet: ObjectId;
		faucet_registry: ObjectId;
		treasury_caps: Map<string, ObjectId>;
	};
	perpetuals?: {
		package: ObjectId;
		admin_capability: ObjectId;
		registry: ObjectId;
		exchanges: Map<string, RustExchangeAddresses>;
		oracle?: RustOracleAddresses;
		curr_collateral?: string;
	};
	oracle?: RustOracleAddresses;
	spot_orderbook?: any;
}

export interface RustExchangeAddresses {
	account_manager: ObjectId;
	account_capabilities: Map<number, ObjectId>;
	market_manager: ObjectId;
	vault: ObjectId;
	insurance_fund: ObjectId;
}

export interface RustOracleAddresses {
	package: ObjectId;
	authority_capability: ObjectId;
	price_feed_storage: ObjectId;
}

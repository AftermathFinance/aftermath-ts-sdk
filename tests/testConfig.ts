import process from "node:process";
import fs from "fs";
import YAML from "yaml";
import { Helpers } from "../src/general/utils";
import {
	ExchangeAddresses,
	FaucetAddresses,
	OracleAddresses,
	PerpetualsAddresses,
	RustAddresses,
} from "../src/types";

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

	let exchanges = new Map<string, ExchangeAddresses>();
	for (const value of Object.entries(rustCfg.perpetuals?.exchanges!)) {
		let [name, cfg] = value;
		exchanges.set(name, {
			accountManager: cfg.account_manager,
			marketManager: cfg.market_manager,
			vault: cfg.vault,
			insuranceFunds: cfg.insurance_funds,
		});
	}

	let oracleCfg = {
		packages: {
			oracle: rustCfg.perpetuals?.oracle?.package!,
		},
		objects: {
			authorityCapability:
				rustCfg.perpetuals?.oracle?.authority_capability!,
			priceFeedStorage: rustCfg.perpetuals?.oracle?.price_feed_storage!,
		},
	};

	let perpetualsCfg = {
		packages: {
			perpetuals: rustCfg.perpetuals?.package!,
		},
		objects: {
			adminCapability: rustCfg.perpetuals?.admin_capability!,
			registry: rustCfg.perpetuals?.registry!,
			exchanges,
			oracle: Helpers.deepCopy(oracleCfg),
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

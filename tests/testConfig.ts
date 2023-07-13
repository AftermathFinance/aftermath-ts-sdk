import fs from "fs";
import YAML from "yaml";
import { Helpers } from "../src/general/utils";
import { ExchangeAddresses, FaucetAddresses, OracleAddresses, PerpetualsAddresses, RustAddresses } from "../src/types";

const RUST_CFG_PATH = "";
// Point this to the path returned by the `config path` command of the Rust api

export function getConfigs(): [PerpetualsAddresses, FaucetAddresses, OracleAddresses] {
	const file = fs.readFileSync(RUST_CFG_PATH, "utf8");
	const rustCfg = YAML.parse(file) as RustAddresses;

	let exchanges = new Map<string, ExchangeAddresses>();
	for (const value of Object.entries(rustCfg.perpetuals?.exchanges!)) {
		let [name, cfg] = value;
		exchanges.set(
			name,
			{
				accountManager: cfg.account_manager,
				marketManager: cfg.market_manager,
				vault: cfg.vault,
				insuranceFund: cfg.insurance_fund,
			}
		);
	}

	let oracleCfg = {
		packages: {
			oracle: rustCfg.perpetuals?.oracle?.package!,
		},
		objects: {
			authorityCapability: rustCfg.perpetuals?.oracle?.authority_capability!,
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
		},
		objects: {
			faucet: rustCfg.faucet?.faucet!,
			faucetRegistry: rustCfg.faucet?.faucet_registry!,
		},
	};

	return [perpetualsCfg, faucetCfg, oracleCfg];
}

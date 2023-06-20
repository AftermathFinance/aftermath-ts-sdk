import fs from "fs";
import YAML from "yaml";
import { Helpers } from "../src/general/utils";
import { FaucetAddresses, OracleAddresses, PerpetualsAddresses, RustAddresses } from "../src/types";

const RUST_CFG_PATH = "";
// Point this to the path returned by the `config path` command of the Rust api

export function getConfigs(): [PerpetualsAddresses, FaucetAddresses, OracleAddresses] {
	const file = fs.readFileSync(RUST_CFG_PATH, "utf8");
	const rustCfg = YAML.parse(file) as RustAddresses;
	let faucetPkgId = rustCfg.faucet?.package_id;
	let exchanges = new Map(Object.entries(rustCfg.perpetuals?.exchanges!));
	let usdcExchange = exchanges.get(faucetPkgId + "::usdc::USDC")!;
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
			exchanges: [{
				accountManager: usdcExchange.account_manager,
				marketManager: usdcExchange.market_manager,
				vault: usdcExchange.vault,
				insuranceFund: usdcExchange.insurance_fund,
			}],
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

import { Connection, JsonRpcProvider } from "@mysten/sui.js";
import { Aftermath, AftermathApi } from "../src/general/providers";
import {
	ASK,
	BID,
	adminPrivateKey,
	user1PrivateKey,
	user2PrivateKey,
	user3PrivateKey,
	user4PrivateKey,
	LOT_SIZE,
	TICK_SIZE,
	MARKET_ID0,
	ACCOUNT_ID,
	fromOraclePriceToOrderbookPrice,
	getSigner,
} from "./utils";

import { perpetualsConfig, faucetConfig } from "./testConfig";

const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";

// =========================================================================
// TEST CASE FLOW
// =========================================================================
describe("Perpetuals Tests", () => {
	test("Test Case 1", async () => {
		const connection = new Connection({
			fullnode: "http://127.0.0.1:9000",
		});
		const provider = new JsonRpcProvider(connection);
		const aftermathApi = new AftermathApi(provider, {
			perpetuals: perpetualsConfig,
		});

		// Create package provider
		let admin = getSigner(adminPrivateKey, aftermathApi);
		let user1 = getSigner(user1PrivateKey, aftermathApi);
		let user2 = getSigner(user2PrivateKey, aftermathApi);
		let user3 = getSigner(user3PrivateKey, aftermathApi);
		let user4 = getSigner(user4PrivateKey, aftermathApi);

		// Publish + initialization for USDC has been done with rust-sdk

		// Create perpetuals main objects
		// let tx = await aftermathApi
		// 	.Perpetuals()
		// 	.fetchPerpetualsInitializeForCollateralTx({
		// 		walletAddress: await admin.getAddress(),
		// 		coinType: usdcType,
		// 	});
		// await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// Transfer and transfer back admin_capability
		let tx = await aftermathApi
			.Perpetuals()
			.fetchPereptualsTransferAdminCapTx({
				walletAddress: await admin.getAddress(),
				targetAddress: await user1.getAddress(),
			});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPereptualsTransferAdminCapTx({
			walletAddress: await user1.getAddress(),
			targetAddress: await admin.getAddress(),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// // Create price feed for "BTC" perpetual (BTC/USD oracle price feed)
		tx = await aftermathApi.Perpetuals().fetchOracleCreatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			decimal: BigInt(9),
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// Update price for "BTC" to 10000$ in fixed representation
		tx = await aftermathApi.Perpetuals().fetchOracleUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: BigInt(10000_000000000_000000000),
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// Create perpetuals market for BTC/USD with USDC as collateral
		tx = await aftermathApi.Perpetuals().fetchPerpetualsCreateMarketTx({
			walletAddress: await admin.getAddress(),
			coinType: usdcType,
			marketId: MARKET_ID0,
			marginRatioInitial: BigInt(100000000000000000),
			marginRatioMaintenance: BigInt(50000000000000000),
			baseAssetSymbol: "BTC",
			fundingFrequencyMs: BigInt(3600000),
			fundingPeriodMs: BigInt(86400000),
			twapPeriodMs: BigInt(3600000),
			makerFee: BigInt(0),
			takerFee: BigInt(0),
			liquidationFee: BigInt(0),
			forceCancelFee: BigInt(0),
			insuranceFundFee: BigInt(0),
			priceImpactFactor: BigInt(0),
			lotSize: BigInt(1),
			tickSize: BigInt(1),
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// All users gets 10000 USDC
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			amount: BigInt(10000_000000000),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			amount: BigInt(10000_000000000),
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			amount: BigInt(10000_000000000),
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			amount: BigInt(10000_000000000),
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// All users create an account
		tx = await aftermathApi.Perpetuals().fetchPerpetualsCreateAccountTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsCreateAccountTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsCreateAccountTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsCreateAccountTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// All users deposit 10000 USDC
		let coin = await aftermathApi.Coin().fetchCoinWithAmountTx({
			walletAddress: await user1.getAddress(),
			tx,
			coinType: usdcType,
			coinAmount: BigInt(10000_000000000),
		});
		console.log(coin);
		// tx = await aftermathApi
		// 	.Perpetuals()
		// 	.fetchPerpetualsDepositCollateralTx({
		// 		walletAddress: await user1.getAddress(),
		// 		coinType: usdcType,
		// 		coin: "",
		// 		accountId: ACCOUNT_ID,
		// 	});
		// await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });
	}, 50000000);
});

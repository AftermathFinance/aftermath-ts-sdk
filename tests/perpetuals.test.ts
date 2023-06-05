import { Connection, JsonRpcProvider, TransactionBlock } from "@mysten/sui.js";
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
import { orderId } from "../src/packages/perpetuals/utils/critBitTreeUtils";

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
			faucet: faucetConfig,
		});

		const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";
		const initialOrderbookPrice = fromOraclePriceToOrderbookPrice(
			BigInt(10000_000000000),
			LOT_SIZE,
			TICK_SIZE
		);
		const finalOrderbookPrice = fromOraclePriceToOrderbookPrice(
			BigInt(9400_000000000),
			LOT_SIZE,
			TICK_SIZE
		);

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

		//Create perpetuals market for BTC/USD with USDC as collateral
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
			lotSize: LOT_SIZE,
			tickSize: TICK_SIZE,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		//All users gets 10000 USDC
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
		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsDepositCollateralTx({
				walletAddress: await user1.getAddress(),
				coinType: usdcType,
				coinAmount: BigInt(10000_000000000),
				accountId: ACCOUNT_ID,
			});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsDepositCollateralTx({
				walletAddress: await user2.getAddress(),
				coinType: usdcType,
				coinAmount: BigInt(10000_000000000),
				accountId: ACCOUNT_ID,
			});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsDepositCollateralTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				coinAmount: BigInt(10000_000000000),
				accountId: ACCOUNT_ID,
			});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsDepositCollateralTx({
				walletAddress: await user4.getAddress(),
				coinType: usdcType,
				coinAmount: BigInt(10000_000000000),
				accountId: ACCOUNT_ID,
			});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// User1 place limit ask for 1 BTC at price 10000
		// User1 cancel limit ask
		// User1 place limit bid for 10 BTC at price 10000
		// User2 place market ask for 10 BTC at price 10000
		// User3 place limit bid for 10 BTC at price 9400
		// Admin set index price BTC/USDC=9400$
		// User4 liquidate user1 BTC position
		tx = await aftermathApi.Perpetuals().fetchPerpetualsPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(1_000000000),
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsCancelOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: ASK,
			orderId: orderId(initialOrderbookPrice, BigInt(0), ASK),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(10_000000000),
			price: initialOrderbookPrice,
			orderType: BigInt(0),
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: ASK,
			size: BigInt(10_000000000),
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsPlaceLimitOrderTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(10_000000000),
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchOracleUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: BigInt(9400_000000000_000000000),
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsLiquidateTx({
			walletAddress: await user4.getAddress(),
			coinType: usdcType,
			liqee: await user1.getAddress(),
			liqeeAccountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			liqorAccountId: ACCOUNT_ID,
		});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// User1 close_position (matched against user3's remainder. He is now 10 BTC long)
		// User2 place limit bid for 10 BTC at price 9400
		// User3 close_position (matched against user2, closing the circle)
		tx = await aftermathApi.Perpetuals().fetchPerpetualsClosePositionTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
		});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsPlaceLimitOrderTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
			side: BID,
			size: BigInt(10_000000000),
			price: finalOrderbookPrice,
			orderType: BigInt(0),
		});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi.Perpetuals().fetchPerpetualsClosePositionTx({
			walletAddress: await user3.getAddress(),
			coinType: usdcType,
			accountId: ACCOUNT_ID,
			marketId: MARKET_ID0,
		});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// Admin set timestamp to 90000
		// Admin call update funding (might fail because of update frequency)
		// User1 withdraw collateral 2000 USDC
		// User2 withdraw collateral 2000 USDC
		// User3 withdraw collateral 2000 USDC
		// User4 withdraw collateral 2000 USDC
		tx = await aftermathApi.Perpetuals().fetchOracleUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			symbol: "BTC",
			price: BigInt(9400_000000000_000000000),
			timestamp: 1687975495000,
		});
		await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		// tx = await aftermathApi
		// 	.Perpetuals()
		// 	.fetchPerpetualsUpdateFundingTx({
		// 		walletAddress: await admin.getAddress(),
		// 		coinType: usdcType,
		// 		marketId: MARKET_ID0,
		// 	});
		// await admin.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsWithdrawCollateralTx({
				walletAddress: await user1.getAddress(),
				coinType: usdcType,
				accountId: ACCOUNT_ID,
				amount: BigInt(2000_000000000),
			});
		await user1.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsWithdrawCollateralTx({
				walletAddress: await user2.getAddress(),
				coinType: usdcType,
				accountId: ACCOUNT_ID,
				amount: BigInt(2000_000000000),
			});
		await user2.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsWithdrawCollateralTx({
				walletAddress: await user3.getAddress(),
				coinType: usdcType,
				accountId: ACCOUNT_ID,
				amount: BigInt(2000_000000000),
			});
		await user3.signAndExecuteTransactionBlock({ transactionBlock: tx });

		tx = await aftermathApi
			.Perpetuals()
			.fetchPerpetualsWithdrawCollateralTx({
				walletAddress: await user4.getAddress(),
				coinType: usdcType,
				accountId: ACCOUNT_ID,
				amount: BigInt(2000_000000000),
			});
		await user4.signAndExecuteTransactionBlock({ transactionBlock: tx });
	}, 50000000);
});

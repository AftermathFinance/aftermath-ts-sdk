import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { AftermathApi } from "../src/general/providers";
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
	BRANCH_MIN,
	BRANCH_MAX,
	LEAF_MIN,
	LEAF_MAX,
	BRANCHES_MERGE_MAX,
	LEAVES_MERGE_MAX,
	MARKET_ID0,
	ONE_F18,
	fromOraclePriceToOrderbookPrice,
	getSigner,
	ONE_B9,
	createAndFetchAccountCap,
	getPerpetualsAccount,
	printAccountMetrics,
	getPerpetualsMarket,
	MARKET_ID1,
} from "./utils";

import { getConfigs } from "./testConfig";
import {
	Perpetuals,
	PerpetualsAccount,
	PerpetualsMarket,
	Sui,
} from "../src/packages";
import { IFixedUtils } from "../src/general/utils/iFixedUtils";
import { PerpetualsOrderSide, PerpetualsOrderType } from "../src/types";
import { Helpers, IndexerCaller } from "../src/general/utils";

// =========================================================================
//
// =========================================================================
// =========================================================================
//  THIS TESTS ARE OUTDATED
// =========================================================================
// =========================================================================
//
// =========================================================================

// =========================================================================
// TEST CASE FLOW
// =========================================================================
describe("Perpetuals Tests", () => {
	test("Account Margin", async () => {
		const provider = new SuiClient({
			url: "http://127.0.0.1:9000",
		});
		const [perpetualsConfig, faucetConfig, oracleConfig] = getConfigs();
		const aftermathApi = new AftermathApi(
			provider,
			{
				perpetuals: perpetualsConfig,
				faucet: faucetConfig,
				oracle: oracleConfig,
			},
			new IndexerCaller()
		);

		const usdcType = faucetConfig.packages.faucet + "::usdc::USDC";
		const initialOraclePrice0 = BigInt(10000) * ONE_F18;
		const initialOrderbookPrice0 = fromOraclePriceToOrderbookPrice(
			initialOraclePrice0,
			LOT_SIZE,
			TICK_SIZE
		);
		const finalOraclePrice0 = BigInt(9600) * ONE_F18;
		const finalOrderbookPrice0 = fromOraclePriceToOrderbookPrice(
			finalOraclePrice0,
			LOT_SIZE,
			TICK_SIZE
		);

		const initialOraclePrice1 = BigInt(2000) * ONE_F18;
		const initialOrderbookPrice1 = fromOraclePriceToOrderbookPrice(
			initialOraclePrice1,
			LOT_SIZE,
			TICK_SIZE
		);
		const finalOraclePrice1 = BigInt(1700) * ONE_F18;
		const finalOrderbookPrice1 = fromOraclePriceToOrderbookPrice(
			finalOraclePrice1,
			LOT_SIZE,
			TICK_SIZE
		);
		let onchainTime = Helpers.getObjectFields(
			await aftermathApi
				.Objects()
				.fetchObject({ objectId: Sui.constants.addresses.suiClockId })
		)?.timestamp_ms;
		console.log(`Time onchain vs TS:\n${onchainTime}, ${Date.now()}`);

		// Create package provider
		let admin = getSigner(adminPrivateKey, aftermathApi);
		let user1 = getSigner(user1PrivateKey, aftermathApi);
		let user2 = getSigner(user2PrivateKey, aftermathApi);
		// let user3 = getSigner(user3PrivateKey, aftermathApi);
		// let user4 = getSigner(user4PrivateKey, aftermathApi);

		let tx: TransactionBlock;
		const requestType = "WaitForLocalExecution";

		// // Create price feed for "BTC" perpetual (BTC/USD oracle price feed)
		// console.log("Create BTC price feed");
		// tx = await aftermathApi.Oracle().buildDevCreatePriceFeedTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinSymbol: "BTC",
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		// // Update price for "BTC" to 10000$ in fixed representation
		// console.log("Update BTC price feed");
		// tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinSymbol: "BTC",
		// 	price: initialOraclePrice0,
		// 	timestamp: 0,
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		// // Create price feed for "ETH" perpetual (ETH/USD oracle price feed)
		// console.log("Create ETH price feed");
		// tx = await aftermathApi.Oracle().buildDevCreatePriceFeedTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinSymbol: "ETH",
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		// // Update price for "ETH" to 2000$ in fixed representation
		// console.log("Update ETH price feed");
		// tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinSymbol: "ETH",
		// 	price: initialOraclePrice1,
		// 	timestamp: 0,
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		//Create perpetuals market for BTC/USD with USDC as collateral
		console.log("Create market 0");
		tx = await aftermathApi.Perpetuals().buildCreateMarketTx({
			walletAddress: await admin.getAddress(),
			collateralCoinType: usdcType,
			marketId: MARKET_ID0,
			marginRatioInitial: BigInt(100000000000000000),
			marginRatioMaintenance: BigInt(50000000000000000),
			baseAssetSymbol: "BTC",
			fundingFrequencyMs: BigInt(60000), // 1 min
			fundingPeriodMs: BigInt(86400000),
			premiumTwapFrequencyMs: BigInt(5000),
			premiumTwapPeriodMs: BigInt(60000),
			spreadTwapFrequencyMs: BigInt(5000),
			spreadTwapPeriodMs: BigInt(60000),
			makerFee: BigInt(0),
			takerFee: BigInt(0),
			liquidationFee: BigInt(0),
			forceCancelFee: BigInt(0),
			insuranceFundFee: BigInt(0),
			insuranceFundId: BigInt(0),
			lotSize: LOT_SIZE,
			tickSize: TICK_SIZE,
			branchMin: BRANCH_MIN,
			branchMax: BRANCH_MAX,
			leafMin: LEAF_MIN,
			leafMax: LEAF_MAX,
			branchesMergeMax: BRANCHES_MERGE_MAX,
			leavesMergeMax: LEAVES_MERGE_MAX,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Fetch market 0");
		let market0 = await getPerpetualsMarket(
			aftermathApi,
			MARKET_ID0,
			usdcType
		);
		console.log(market0);

		// Create perpetuals market for ETH/USD with USDC as collateral
		console.log("Create market 1");
		tx = await aftermathApi.Perpetuals().buildCreateMarketTx({
			walletAddress: await admin.getAddress(),
			collateralCoinType: usdcType,
			marketId: MARKET_ID1,
			marginRatioInitial: BigInt(100000000000000000),
			marginRatioMaintenance: BigInt(50000000000000000),
			baseAssetSymbol: "ETH",
			fundingFrequencyMs: BigInt(60000), // 1 min
			fundingPeriodMs: BigInt(86400000),
			premiumTwapFrequencyMs: BigInt(5000),
			premiumTwapPeriodMs: BigInt(60000),
			spreadTwapFrequencyMs: BigInt(5000),
			spreadTwapPeriodMs: BigInt(60000),
			makerFee: BigInt(0),
			takerFee: BigInt(0),
			liquidationFee: BigInt(0),
			forceCancelFee: BigInt(0),
			insuranceFundFee: BigInt(0),
			insuranceFundId: BigInt(0),
			lotSize: LOT_SIZE,
			tickSize: TICK_SIZE,
			branchMin: BRANCH_MIN,
			branchMax: BRANCH_MAX,
			leafMin: LEAF_MIN,
			leafMax: LEAF_MAX,
			branchesMergeMax: BRANCHES_MERGE_MAX,
			leavesMergeMax: LEAVES_MERGE_MAX,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Fetch market 1");
		let market1 = await getPerpetualsMarket(
			aftermathApi,
			MARKET_ID1,
			usdcType
		);
		console.log(market1);

		// All users gets 10000 USDC
		console.log("Mint USDC for User1");
		let tenThousandB9 = BigInt(10000) * ONE_B9;
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user1.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Mint USDC for User2");
		tx = await aftermathApi.Faucet().fetchRequestCustomCoinAmountTx({
			walletAddress: await user2.getAddress(),
			coinType: usdcType,
			amount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		// All users create an account
		console.log("Create Account for User1");
		let user1AccountCap = await createAndFetchAccountCap(
			user1,
			aftermathApi,
			usdcType
		);

		console.log("Create Account for User2");
		let user2AccountCap = await createAndFetchAccountCap(
			user2,
			aftermathApi,
			usdcType
		);

		// All users deposit 10000 USDC
		console.log("Deposit USDC for User1");
		tx = await aftermathApi.Perpetuals().fetchBuildDepositCollateralTx({
			walletAddress: await user1.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user1AccountCap,
			amount: tenThousandB9,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Deposit USDC for User2");
		tx = await aftermathApi.Perpetuals().fetchBuildDepositCollateralTx({
			walletAddress: await user2.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user2AccountCap,
			amount: tenThousandB9,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Fetch user1 account");
		let accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		console.log("Fetch user2 account");
		let accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

		console.log("Place limit order market0");
		let orderSize = BigInt(5000);
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID0,
			side: PerpetualsOrderSide.Bid,
			size: orderSize,
			price: initialOrderbookPrice0,
			orderType: PerpetualsOrderType.Standard,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order market0");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID0,
			side: PerpetualsOrderSide.Ask,
			size: orderSize,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place limit order market1");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user1AccountCap,
			marketId: MARKET_ID1,
			side: PerpetualsOrderSide.Ask,
			size: orderSize,
			price: initialOrderbookPrice1,
			orderType: PerpetualsOrderType.Standard,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order market1");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: user2AccountCap,
			marketId: MARKET_ID1,
			side: PerpetualsOrderSide.Bid,
			size: orderSize,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		printAccountMetrics(
			accountUser1,
			[market0, market1],
			[
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		let liqPriceUser1 = accountUser1.calcLiquidationPriceForPosition({
			market: market0,
			indexPrice: IFixedUtils.numberFromIFixed(initialOraclePrice0),
			markets: [market0, market1],
			indexPrices: [
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			collateralPrice: IFixedUtils.numberFromIFixed(ONE_F18),
		});

		console.log("Liquidation price BTC user1 : ", liqPriceUser1);

		liqPriceUser1 = accountUser1.calcLiquidationPriceForPosition({
			market: market1,
			indexPrice: IFixedUtils.numberFromIFixed(initialOraclePrice1),
			markets: [market0, market1],
			indexPrices: [
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			collateralPrice: IFixedUtils.numberFromIFixed(ONE_F18),
		});
		console.log("Liquidation price ETH user1 : ", liqPriceUser1);

		accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

		printAccountMetrics(
			accountUser2,
			[market0, market1],
			[
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		let liqPriceUser2 = accountUser2.calcLiquidationPriceForPosition({
			market: market0,
			indexPrice: IFixedUtils.numberFromIFixed(initialOraclePrice0),
			markets: [market0, market1],
			indexPrices: [
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			collateralPrice: IFixedUtils.numberFromIFixed(ONE_F18),
		});
		console.log("Liquidation price BTC user2 : ", liqPriceUser2);

		liqPriceUser2 = accountUser2.calcLiquidationPriceForPosition({
			market: market1,
			indexPrice: IFixedUtils.numberFromIFixed(initialOraclePrice1),
			markets: [market0, market1],
			indexPrices: [
				IFixedUtils.numberFromIFixed(initialOraclePrice0),
				IFixedUtils.numberFromIFixed(initialOraclePrice1),
			],
			collateralPrice: IFixedUtils.numberFromIFixed(ONE_F18),
		});
		console.log("Liquidation price ETH user2 : ", liqPriceUser2);

		// Update price for "BTC" to finalOraclePrice0 in fixed representation
		// console.log("Update BTC price feed");
		// tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
		// 	walletAddress: await admin.getAddress(),
		// 	coinSymbol: "BTC",
		// 	price: finalOraclePrice0,
		// 	timestamp: 0,
		// });
		// await admin.signAndExecuteTransactionBlock({
		// 	transactionBlock: tx,
		// 	requestType,
		// });

		// Update price for "ETH" to finalOraclePrice1 in fixed representation
		console.log("Update ETH price feed");
		tx = await aftermathApi.Oracle().buildDevUpdatePriceFeedTx({
			walletAddress: await admin.getAddress(),
			coinSymbol: "ETH",
			price: finalOraclePrice1,
			timestamp: 0,
		});
		await admin.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place order to close BTC position");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user2.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: accountUser2.accountCap.objectId,
			marketId: MARKET_ID0,
			side: PerpetualsOrderSide.Bid,
			size: orderSize,
			price: finalOrderbookPrice0,
			orderType: PerpetualsOrderType.Standard,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order to close BTC position");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user1.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: accountUser1.accountCap.objectId,
			marketId: MARKET_ID0,
			side: PerpetualsOrderSide.Ask,
			size: orderSize,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place order to close ETH position");
		tx = await aftermathApi.Perpetuals().buildPlaceLimitOrderTx({
			walletAddress: await user1.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: accountUser1.accountCap.objectId,
			marketId: MARKET_ID1,
			side: PerpetualsOrderSide.Bid,
			size: orderSize,
			price: finalOrderbookPrice1,
			orderType: PerpetualsOrderType.Standard,
		});
		await user1.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Place market order to close ETH position");
		tx = await aftermathApi.Perpetuals().buildPlaceMarketOrderTx({
			walletAddress: await user2.getAddress(),
			collateralCoinType: usdcType,
			accountCapId: accountUser2.accountCap.objectId,
			marketId: MARKET_ID1,
			side: PerpetualsOrderSide.Ask,
			size: orderSize,
		});
		await user2.signAndExecuteTransactionBlock({
			transactionBlock: tx,
			requestType,
		});

		console.log("Fetch user1 account");
		accountUser1 = await getPerpetualsAccount(
			aftermathApi,
			await user1.getAddress(),
			BigInt(0),
			usdcType
		);

		printAccountMetrics(
			accountUser1,
			[market0, market1],
			[
				IFixedUtils.numberFromIFixed(finalOraclePrice0),
				IFixedUtils.numberFromIFixed(finalOraclePrice1),
			],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);

		console.log("Fetch user2 account");
		accountUser2 = await getPerpetualsAccount(
			aftermathApi,
			await user2.getAddress(),
			BigInt(1),
			usdcType
		);

		printAccountMetrics(
			accountUser2,
			[market0, market1],
			[
				IFixedUtils.numberFromIFixed(finalOraclePrice0),
				IFixedUtils.numberFromIFixed(finalOraclePrice1),
			],
			IFixedUtils.numberFromIFixed(ONE_F18)
		);
	}, 5000000);
});
